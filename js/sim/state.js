// Burrow sim · state.js — Game object, tile edits, inventory, sight, breaking and placing blocks.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// ---------- game ----------
function newGame(seed, gen = GEN_NOW) {
  seed = seed >>> 0;
  const w = generate(seed, null, gen);
  const g = {gen,
    seed, w, tick: 0, time: DAY * 0.08, day: 1, rng: mulberry(seed ^ 0x9e3779b9),
    monsters: [], critters: [], arrows: [], fx: [], torches: [], log: [], trader: null,
    known: new Set(), seen: new Uint8Array(W * H), black: new Map(),
    stats: {mined: {}, crafted: {}, deepest: 0, deaths: 0, kills: 0, walked: 0, distance: 0, torches: 0, eaten: 0, milestones: [], placed: 0},
    dirty: [], sfx: [], goalIdx: 0, fluid: {water: new Set(), lava: new Set(), sand: new Set()}
  };
  const m = g.m = {
    x: w.spawn.x, y: w.spawn.y, px: w.spawn.x, py: w.spawn.y, hp: 20, hunger: 20, inv: {}, facing: 1,
    act: null, path: [], job: null, thought: 'Waking up in a new world', chain: [], home: {x: w.spawn.x, y: w.spawn.y},
    bed: null, stations: [], swing: 0, hurt: 0, dead: 0, sleeping: false, fails: 0, stripDir: 1, sleptDay: 0,
    regenT: 0, hungerT: 0, hut: false, lastTorch: null
  };
  // critters
  for (let x = 6; x < W - 6; x += 12 + Math.floor(g.rng() * 14)) {
    if (lushBiome(w.biome[x])) spawnCritter(g, x);
  }
  look(g, true);
  logEvent(g, 'Woke up in the ' + BIOMES[w.biome[m.x]].toLowerCase());
  return g;
}
const get = (g, x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? T.BEDROCK : g.w.t[y * W + x];
function setTile(g, x, y, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const k = y * W + x, old = g.w.t[k];
  g.w.t[k] = v;
  if (g.w.lv) g.w.lv[k] = isLiquid(v) ? (g.w.lv[k] || 8) : 0;
  recomputeTop(g.w, x);
  g.dirty.push(k);
  wake(g, x, y);
  if (LIGHT_TILES.has(old)) g.torches = g.torches.filter(p => p.x !== x || p.y !== y);
  if (LIGHT_TILES.has(v)) g.torches.push({x, y});
}
function logEvent(g, text) {
  g.log.push({day: g.day, tick: g.tick, text});
  if (g.log.length > 60) g.log.shift();
}
function milestone(g, id, label) {
  if (g.stats.milestones.some(s => s.id === id)) return;
  g.stats.milestones.push({id, label, day: g.day, tick: g.tick});
  logEvent(g, '★ ' + label);
  sfx(g, 'milestone', g.m.x, g.m.y);
  bookMilestone(g, id, label);
  gainGrit(g, GRIT_MILESTONE);
}

// ---------- inventory ----------
const cnt = (m, k) => m.inv[k] || 0;
function add(g, k, n) { if (!k || n <= 0) return; g.m.inv[k] = cnt(g.m, k) + n; checkItemMilestones(g, k); }
function take(m, k, n) { m.inv[k] = cnt(m, k) - n; if (m.inv[k] <= 0) delete m.inv[k]; }
// ---------- equipment & durability ----------
const MAT_RANK = {wood: 1, gold: 1, stone: 2, copper: 2, iron: 3, gem: 4, cinder: 5};
const SWORD_DMG = {wood: 4, gold: 4, stone: 5, copper: 6, iron: 7, gem: 9, cinder: 12};
// the item of a kind the miner is using: its best one (best pickaxe, best sword, best axe...)
function toolValue(kind, k) { return kind === 'pick' ? PICK_TIER[k] * 10 + MAT_RANK[TOOL_MAT[k]] : kind === 'sword' ? SWORD_DMG[TOOL_MAT[k]] : MAT_RANK[TOOL_MAT[k]] * 10 + (TOOL_MAT[k] === 'gold' ? 5 : 0); }
function equipped(m, kind) {
  let best = null, bv = 0;
  for (const k in m.inv) {
    if (TOOL_KIND[k] !== kind) continue;
    const v = toolValue(kind, k);
    if (v > bv) { bv = v; best = k; }
  }
  return best;
}
function armorPiece(m, slot) {
  let best = null, bv = 0;
  for (const k in m.inv) { const a = ARMOR[k]; if (a && a.slot === slot && a.def > bv) { bv = a.def; best = k; } }
  return best;
}
function tier(m) { const k = equipped(m, 'pick'); return k ? PICK_TIER[k] : 0; }
function swordDmg(m) { const k = equipped(m, 'sword'); return k ? SWORD_DMG[TOOL_MAT[k]] : tier(m) >= 2 ? 3 : 2; }
function armor(m) { let d = 0; for (const s of ARMOR_SLOTS) { const k = armorPiece(m, s); if (k) d += ARMOR[k].def; } return Math.min(0.8, d); }
function durLeft(m, k) { return m.dur && m.dur[k] !== undefined ? m.dur[k] : DUR[k]; }
// use up one point of an item; when it runs out, that copy breaks and the next one (if any) starts fresh
function wear(g, k, n) {
  const m = g.m;
  if (!k || !m.inv[k] || !DUR[k]) return;
  m.dur = m.dur || {};
  m.dur[k] = durLeft(m, k) - (n || 1);
  if (m.dur[k] > 0) return;
  take(m, k, 1);
  if (m.inv[k]) m.dur[k] = DUR[k]; else delete m.dur[k];
  logEvent(g, 'My ' + ITEMS[k].toLowerCase() + ' broke');
  g.stats.broken = (g.stats.broken || 0) + 1;
  g.fx.push({type: 'num', x: m.x, y: m.y - 2.5, text: ITEMS[k] + ' broke!', life: 50, color: '#ffb36b'});
  sfx(g, 'snap', m.x, m.y);
}
// a matching tool digs its own kind of block faster: axes for wood, shovels for soil, shears for leaves
const SOFT = new Set([T.DIRT, T.GRASS, T.SNOW, T.SAND]);
function toolFor(m, t) {
  if (t === T.LOG || t === T.PLANKS) return equipped(m, 'axe');
  if (SOFT.has(t)) return equipped(m, 'shovel');
  if (t === T.LEAVES || t === T.PINE) return m.inv.shears ? 'shears' : null;
  if (t === T.BUSH || t === T.TGRASS) return equipped(m, 'hoe');
  if (P[t].solid && P[t].tier >= 1) return equipped(m, 'pick');
  return null;
}
function toolBoost(m, t) {
  const k = toolFor(m, t);
  if (!k || TOOL_KIND[k] === 'pick') return 1;
  return k === 'shears' ? 3 : 1 + MAT_RANK[TOOL_MAT[k]] * 0.6 + (TOOL_MAT[k] === 'gold' ? 1 : 0);
}
function blocksAvail(m) { return cnt(m, 'dirt') + cnt(m, 'cobble') + cnt(m, 'sand') + cnt(m, 'sandstone'); }
function hasFood(m) { for (const k in FOOD) if (cnt(m, k) > 0) return true; return false; }
function checkItemMilestones(g, k) {
  const names = {potato: 'Found a first potato', coal: 'Found first coal', raw_copper: 'Found first copper', raw_iron: 'Found first iron', raw_gold: 'Found first gold', gem: 'Found first gem', raw_cinderite: 'Found first cinderite'};
  if (names[k]) milestone(g, 'first_' + k, names[k]);
}

function digTicks(t, tr) {
  const p = P[t];
  if (!p.solid) return 0;
  if (tr < p.tier) return (tr === 0 && p.tier === 1) ? Math.ceil(p.base * PACE_DIG * 5) : INF; // bare hands can chip stone, very slowly (a way out of a cave)
  return Math.ceil(p.base * PACE_DIG / SPEED[tr]);
}


// ---------- seeing ----------
function look(g, wide) {
  const m = g.m, w = g.w;
  const R = wide ? 14 : 11;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = m.x + dx, y = m.y + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const k = y * W + x;
    if (g.seen[k]) continue;
    const t = w.t[k];
    const close = Math.abs(dx) + Math.abs(dy) <= 4;
    let exposed = false;
    if (!close && isSolid(t)) {
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (passable(get(g, x + ax, y + ay))) { exposed = true; break; } }
    }
    if (close || exposed || !isSolid(t)) {
      g.seen[k] = 1;
      if (ORE_TILES.includes(t) && !(t === T.OBSIDIAN && inGateFrame(g, x, y))) { g.known.add(k); g.spotted = t; }
    }
  }
}

// ---------- tile breaking / placing ----------
// sound events for the UI to play; the sim only records them
function sfx(g, type, x, y, v) { if (g.sfx && g.sfx.length < 80) g.sfx.push({type, x, y, v}); }
function breakTile(g, x, y) {
  const t = get(g, x, y), m = g.m;
  if (t === T.AIR) return;
  wear(g, toolFor(m, t));
  const k = y * W + x;
  g.stats.mined[t] = (g.stats.mined[t] || 0) + 1;
  if (GRIT_ORE[t]) gainGrit(g, GRIT_ORE[t], x, y);
  g.known.delete(k);
  if (ORE_TILES.includes(t)) { m.veinLog = m.veinLog || []; m.veinLog.push({x, y, t, at: g.tick}); if (m.veinLog.length > 40) m.veinLog.shift(); }
  if (t === T.BUSH) { setTile(g, x, y, T.BUSHE); add(g, 'berries', equipped(m, 'hoe') ? 4 : 2); g.w.regrow = g.w.regrow || []; g.w.regrow.push({k, at: g.tick + DAY * 0.6}); return; }
  if (t === T.LEAVES || t === T.PINE) {
    add(g, 'leaf', m.inv.shears ? 2 : 1); if (g.rng() < 0.18) add(g, 'apple', 1);
    g.w.regrow = g.w.regrow || []; g.w.regrow.push({k, at: g.tick + Math.floor(DAY * (0.3 + 0.3 * g.rng())), leaf: t});
  }
  else if (t === T.TGRASS) { if (g.rng() < 1 / 8) add(g, 'wheat_seeds', 1); }
  else if (t === T.TORCH) add(g, 'torch', 1);
  else if (P[t].drop) add(g, P[t].drop, 1);
  setTile(g, x, y, T.AIR);
  if (t === T.SPAWNER) {
    g.stats.spawners = (g.stats.spawners || 0) + 1;
    logEvent(g, 'Broke a monster spawner');
    milestone(g, 'spawner', 'Broke a monster spawner');
  }
  if (t === T.LOG) {
    scheduleDecay(g, x, y);
    if (y <= g.w.surf[x]) { fellTrunk(g, x, y); if (TREE_SOIL.has(get(g, x, y + 1))) plantSapling(g, x, y); }
  }
  g.fx.push({type: 'crumble', x, y, t, life: 12});
  sfx(g, 'break', x, y, t);
}
// ---------- trees grow back ----------
const TREE_SOIL = new Set([T.GRASS, T.SNOW, T.DIRT]);
const inHomeYard = (g, x) => !!g.m.home && Math.abs(x - g.m.home.x) <= 22;
// a tree cut through comes down whole, so its top is never left hanging in the air
function fellTrunk(g, x, y) {
  for (let yy = y - 1; get(g, x, yy) === T.LOG && !(g.protect && g.protect.has(yy * W + x)); yy--) {
    setTile(g, x, yy, T.AIR); add(g, 'log', 1); g.stats.mined[T.LOG] = (g.stats.mined[T.LOG] || 0) + 1;
    g.fx.push({type: 'crumble', x, y: yy, t: T.LOG, life: 12}); scheduleDecay(g, x, yy);
  }
}
function plantSapling(g, x, y) {
  if (inHomeYard(g, x)) return false;
  setTile(g, x, y, T.SAPLING);
  g.w.regrow = g.w.regrow || [];
  g.w.regrow.push({k: y * W + x, at: g.tick + Math.floor(DAY * (1 + g.rng())), tree: 1});
  return true;
}
// false means something's in the way for now
function growTree(g, x, y) {
  const m = g.m, pine = get(g, x, y + 1) === T.SNOW, th = (pine ? 5 : 4) + Math.floor(g.rng() * 3), top = y - th - 3;
  for (let yy = y - 1; yy >= top; yy--) { const t = get(g, x, yy); if (t !== T.AIR && !DECOR.has(t) && t !== T.LOG && t !== T.LEAVES && t !== T.PINE) return false; } // old treetops get grown back into
  const inBox = e => Math.abs(e.x - x) <= 3 && e.y >= top && e.y <= y + 1;
  if (inBox(m) || g.monsters.some(inBox) || g.critters.some(inBox)) return false;
  if ((m.path || []).some(p => Math.abs(p.x - x) <= 2 && p.y >= top && p.y <= y)) { m.path = []; m.job = null; }
  for (let k = 0; k < th; k++) setTile(g, x, y - k, T.LOG);
  growCrown(g, x, y + 1 - th, th, pine);
  return true;
}
// leaves around a trunk whose top log is at (x, top)
function growCrown(g, x, top, th, pine) {
  const leaf = (lx, ly) => { if (get(g, lx, ly) === T.AIR) setTile(g, lx, ly, pine ? T.PINE : T.LEAVES); };
  if (pine) {
    for (let k = 0; k < th - 2; k++) { const hw = Math.min(2, Math.floor(k / 2)); for (let dx = -hw; dx <= hw; dx++) leaf(x + dx, top - 1 + k); }
  } else {
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 1; dy++) if (dx * dx + dy * dy <= 5 && (dx !== 0 || dy < 0)) leaf(x + dx, top + dy);
  }
}
const treeAreaBusy = (g, x, y0, y1) => { const inBox = e => Math.abs(e.x - x) <= 3 && e.y >= y0 && e.y <= y1 + 1; return inBox(g.m) || g.monsters.some(inBox) || g.critters.some(inBox) || (g.m.path || []).some(p => Math.abs(p.x - x) <= 2 && p.y >= y0 && p.y <= y1 + 1); };
// a leaf picked by the miner comes back; returns false to try again later
function regrowLeaf(g, r) {
  const x = r.k % W, y = (r.k / W) | 0, blocked = e => e.x === x && (e.y === y || e.y - 1 === y);
  if (g.w.t[r.k] !== T.AIR || !hasLogNear(g, x, y)) return true;
  if (blocked(g.m) || g.monsters.some(blocked) || g.critters.some(blocked) || (g.m.path || []).some(blocked)) return false;
  setTile(g, x, y, r.leaf); return true;
}
// trunks standing bare, from before leaves came back: a new crown every so often
function refoliate(g) {
  const m = g.m;
  for (let x = Math.max(4, m.x - 60); x <= Math.min(W - 5, m.x + 60); x++) {
    const base = g.w.surf[x] - 1;
    if (get(g, x, base) !== T.LOG) continue;
    let top = base; while (get(g, x, top - 1) === T.LOG) top--;
    let leaves = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const t = get(g, x + dx, top + dy); if (t === T.LEAVES || t === T.PINE) leaves++; }
    if (leaves >= 3 || treeAreaBusy(g, x, top - 3, top + 2)) continue;
    growCrown(g, x, top, base - top + 1, get(g, x, base + 1) === T.SNOW);
  }
}
// new saplings each morning wherever the miner has left the land bare
function seedTrees(g) {
  const m = g.m, standing = x => [T.LOG, T.SAPLING].includes(get(g, x, g.w.surf[x] - 1));
  let trees = 0;
  for (let x = Math.max(4, m.x - 60); x <= Math.min(W - 5, m.x + 60); x++) if (standing(x)) trees++;
  for (let i = 0, left = 3; i < 12 && left > 0 && trees < 6; i++) {
    const x = Math.max(4, Math.min(W - 5, m.x - 60 + Math.floor(g.rng() * 121))), y = g.w.surf[x] - 1, t = get(g, x, y);
    if ((t !== T.AIR && !DECOR.has(t)) || ![T.GRASS, T.SNOW].includes(get(g, x, y + 1))) continue;
    let crowded = false; for (let dx = -3; dx <= 3; dx++) if (standing(x + dx)) crowded = true;
    if (!crowded && plantSapling(g, x, y)) left--;
  }
}
function scheduleDecay(g, x, y) {
  g.decay = g.decay || [];
  for (let dy = -4; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
    const t = get(g, x + dx, y + dy);
    if (t === T.LEAVES || t === T.PINE) g.decay.push({x: x + dx, y: y + dy, at: g.tick + 40 + Math.floor(g.rng() * 400)});
  }
}
function hasLogNear(g, x, y) {
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (get(g, x + dx, y + dy) === T.LOG) return true;
  return false;
}
function placeBlock(g, x, y) {
  const m = g.m, torch = get(g, x, y) === T.TORCH; // a torch in the way comes down and goes back in the pack
  // sand over a gap just falls away (only the miner's own body holds it up)
  const loose = !isSolid(get(g, x, y + 1)) && !(x === m.x && (y + 1 === m.y || y + 1 === m.y - 1));
  for (const k of ['dirt', 'cobble', 'sand', 'sandstone']) if (cnt(m, k) > 0 && !(k === 'sand' && loose)) { take(m, k, 1); if (torch) add(g, 'torch', 1); setTile(g, x, y, PLACE_TILE[k]); sfx(g, 'place', x, y, PLACE_TILE[k]); g.stats.placed++; return true; }
  return false;
}
