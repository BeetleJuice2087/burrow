// Burrow sim · camps.js — What the pack is for: a stone keep to live in at each camp, and a chest of leftovers when the miner moves on.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// What shape it takes is up to the miner: see design.js. Here is the fitting, the supplies and the building of it.
'use strict';

const KEEP_MOST_WORK = 420; // the camp's time is for exploring underground: a big plan just gets called good enough
const KEEP_RESERVE = 96; // blocks held back for the next hut, and for bridges and pillars on the road
const KEEP_WALLS = ['cobble', 'stone_bricks', 'stone', 'smooth_stone', 'sandstone'];
const KEEP_FURNISH = ['anvil', 'wood_stairs', 'wood_slab', 'cauldron', 'stonecutter', 'smoker', 'blast_furnace', 'hopper', 'minecart', 'copper_chest', 'chest_boat', 'boat', 'expedition_pack', 'pressure_plate', 'stone_slab'];
const KEEP_THINK = 70;
const KEEP_UNDER = 8; // the depth below the keep that stays undug: tunnels and sand would bring the floor down

// the stone to build with, and something else for the outer skin if there's plenty
function keepStone(g) {
  const m = g.m, rank = KEEP_WALLS.slice().sort((a, b) => cnt(m, b) - cnt(m, a));
  const here = g.w.biome[m.home.x], wall = (here === B_DUNES || here === B_RED) && cnt(m, 'sandstone') >= 200 ? 'sandstone' : rank[0];
  const trim = rank.concat('planks').find(k => k !== wall && cnt(m, k) >= 40) || wall;
  return {wall, trim};
}
// the column of the keep, counted from the far end, towards the hut
const keepX = (s, c) => s.flip ? s.x + s.wide - 1 - c : s.x + c;
function keepFits(g, s) {
  const m = g.m, h = m.home, grounds = [];
  if (s.x < 3 || s.x + s.wide >= W - 3 || villageOver(g, s.x, s.x + s.wide)) return false;
  for (let x = s.x; x < s.x + s.wide; x++) {
    const gy = groundAt(g, x, h.y);
    if (gy === null || Math.abs(gy - h.y) > 5) return false;
    grounds.push(gy);
  }
  const floor = Math.max(...grounds);
  if (floor - Math.min(...grounds) > 3) return false;
  for (let x = s.x; x < s.x + s.wide; x++) for (let y = floor + 1; y >= floor - s.high - 1; y--) {
    const t = get(g, x, y);
    if ((g.protect && g.protect.has(y * W + x)) || inGateFrame(g, x, y) || !(t === T.AIR || DECOR.has(t) || IN_THE_WAY(t)) || t === T.OBSIDIAN) return false;
  }
  if (m.farm && m.farm.plots.some(p => p.x0 + PLOT_LEN > s.x - 1 && p.x0 <= s.x + s.wide)) return false;
  if (m.gate && m.gate.x + 5 > s.x && m.gate.x - 5 < s.x + s.wide) return false;
  s.floor = floor;
  return true;
}
function keepSite(g, size) {
  const h = g.m.home;
  for (let gap = 0; gap <= 30; gap++) for (const side of gap ? [-1, 1] : [1]) { // as close to where it stopped as the ground allows
    const s = Object.assign({x: h.x - (size.wide >> 1) + gap * side}, size);
    if (keepFits(g, s)) return s;
  }
  return null;
}
// a lamp or a bit of furniture in the room replaces 'keep this cell clear': with both, a torch gets put up and dug out for ever
function keepTidy(cells) {
  const taken = new Set();
  for (const c of cells) if (c.tile !== T.AIR) taken.add(c.y * W + c.x);
  return cells.filter(c => c.tile !== T.AIR || !taken.has(c.y * W + c.x));
}
// the little that every keep has, knocked up from wood the pack is carrying
function keepSupplies(g) {
  const m = g.m;
  const plank = n => { if (cnt(m, 'planks') < n && cnt(m, 'log') > 0) { take(m, 'log', 1); add(g, 'planks', 4); } if (cnt(m, 'planks') < n) return false; take(m, 'planks', n); return true; };
  for (const k of ['wood_stairs', 'wood_slab', 'chest']) if (cnt(m, k) === 0 && plank(2)) add(g, k, 1);
  while (cnt(m, 'door') < 4 && plank(2)) add(g, 'door', 1); // two tall, at each end
}
// the keep is the camp's home: it goes up first, and the bed and stations move in. With no stone or no flat ground, it's the hut as ever
function keepJob(g, chain) {
  const m = g.m, j = m.journey;
  if (inUnder(g) || m.hut || j.keepDone === j.camps) return null;
  const finish = () => { j.keepDone = j.camps; m.campCells = null; m.hut = true; };
  if (!m.campCells) {
    keepSupplies(g);
    const plan = keepPlan(g);
    if (!plan) { j.keepDone = j.camps; logEvent(g, 'No stone or flat ground for a keep here, so a hut will do'); return null; }
    m.campCells = plan.cells; m.home = plan.home; j.keepHome = j.camps; j.keepChest = plan.chest; j.rooms = (j.rooms || []).concat(plan.rooms); j.keepName = plan.name; j.keepWhy = plan.why; j.keep = plan.keep; j.grown = 0; j.growDay = g.day + 1;
    g.protect = g.protect || new Set();
    for (let x = plan.site.x; x < plan.site.x + plan.site.wide; x++) for (let y = plan.site.floor + 1; y <= plan.site.floor + KEEP_UNDER; y++) g.protect.add(y * W + x);
    m.built = m.built || {}; m.buildWork = m.buildWork || {};
    m.built.keep = false; m.buildWork.keep = 0;
    logEvent(g, plan.why);
    return {name: 'plan', label: plan.why, run(g) { m.act = {type: 'wait', t: 0, dur: KEEP_THINK}; return 'done'; }}; // a moment to look the place over
  }
  m.campCells = keepTidy(m.campCells); // a plan in an older save may still have both
  // what's been lost to a knockout or used since gets left out: this is never worth a trip to fetch more
  const want = {};
  for (const c of m.campCells) if (c.tile !== T.AIR && !cellDone(g, c)) { const it = TILE_ITEM[c.tile]; want[it] = (want[it] || 0) + 1; }
  for (const it in want) if (cnt(m, it) < want[it]) m.campCells = m.campCells.filter(c => TILE_ITEM[c.tile] !== it || cellDone(g, c));
  if ((m.buildWork.keep || 0) > KEEP_MOST_WORK) { g.stats.keeps = (g.stats.keeps || 0) + 1; logEvent(g, 'Called the keep good enough'); finish(); return null; } // never worth eating into the exploring
  const job = buildJob(g, 'keep', j.keepName || 'Keep', chain, m.campCells, 'Built a stone keep at camp', null, true); // it's all in reach from the floor: a pillar only ends up in the doorway, to be dug out again
  if (job) return job;
  // nothing it can get at just now is not the same as finished: have another go at what it set aside before calling it a home
  if (!m.built.keep && (j.keepRetry || 0) < 3) {
    j.keepRetry = (j.keepRetry || 0) + 1;
    for (const c of m.campCells) { const k = c.y * W + c.x; if (m.buildSkip[k] < g.tick + 1e8) delete m.buildSkip[k]; }
    return buildJob(g, 'keep', j.keepName || 'Keep', chain, m.campCells, 'Built a stone keep at camp', null, true);
  }
  j.keepRetry = 0;
  // done, or all that's left can't be reached: either way it's home now, and a hut must not start up inside it
  g.stats.keeps = (g.stats.keeps || 0) + 1; g.stats.dayKeep = j.keepName || true; logEvent(g, 'The keep is finished: a ' + (j.keepName || 'stone hall'));
  bookKeep(g, 'A ' + (j.keepName || 'stone hall'), j.keepWhy || '');
  roadMark(g, 'keep', j.keepName || 'stone hall', j.keep ? (j.keep.x0 + j.keep.x1) >> 1 : m.home.x);
  gainGrit(g, GRIT_KEEP); finish();
  return null;
}

// ---------- what gets left behind ----------
// gear that's been outgrown: the gem set stays as a backup, and cinder gear is the point of the whole trip
function oldGear(g) {
  const m = g.m, inUse = new Set();
  for (const kind of new Set(Object.values(TOOL_KIND))) inUse.add(equipped(m, kind));
  for (const s of ARMOR_SLOTS) inUse.add(armorPiece(m, s));
  return Object.keys(m.inv).filter(k => (TOOL_KIND[k] || ARMOR[k]) && !inUse.has(k) && !/^(gem|cinder|reinforced|ember)/.test(k));
}
const PACK_LIMIT = {cobble: 800, stone_bricks: 200, stone: 200, smooth_stone: 200, sandstone: 200, planks: 200, dirt: 128, sand: 128, coal: 128, log: 64, lantern: 8, copper_lantern: 8, glass_pane: 16};
const PACK_KEEP_ALL = new Set(['gate_core', 'obsidian', 'anvil', 'raw_cinderite', 'cinder_ingot', 'glimmer', 'emberfruit', 'ember_crown']);
function leftovers(g) {
  const m = g.m, out = {}, old = new Set(oldGear(g));
  for (const k in m.inv) {
    if (TOOL_KIND[k] || ARMOR[k]) { if (old.has(k)) out[k] = m.inv[k]; continue; }
    if (ALWAYS_CARRY.has(k) || JOURNEY_KIT[k] || PACK_KEEP_ALL.has(k)) continue;
    const limit = PACK_LIMIT[k] !== undefined ? PACK_LIMIT[k] : k === 'gatestone' ? 0 : FOOD[k] ? 64 : BUILD_TILE[k] ? 4 : 64;
    if (m.inv[k] > limit) out[k] = m.inv[k] - limit;
  }
  return out;
}
// into a chest at (x, y), or the old home's chests when there's no spot given
function leaveChest(g, x, y) {
  const m = g.m, j = m.journey, items = leftovers(g), keys = Object.keys(items);
  let total = 0; for (const k of keys) total += items[k];
  if (total < 8) return;
  for (const k of keys) take(m, k, items[k]);
  if (x !== undefined) setTile(g, x, y, T.STORE_CHEST);
  const biome = BIOMES[g.w.biome[m.x]];
  j.chests = (j.chests || []).concat({camp: j.camps, biome, day: g.day, total, items}).slice(-12);
  g.stats.campChests = (g.stats.campChests || 0) + 1; g.stats.leftBehind = (g.stats.leftBehind || 0) + total; g.stats.dayChest = true;
  logEvent(g, 'Left ' + total + ' spare things in a chest');
}

// ---------- spending it with Odalin ----------
// old gear goes for what the miner could use, and a big pile of gems buys the good stuff. Returns how many deals were done
function traderExtras(g) {
  const m = g.m, deal = (text) => { g.stats.trades = (g.stats.trades || 0) + 1; logEvent(g, text); };
  let n = 0, sold = 0, food = 0;
  for (const k in FOOD) if (k !== 'golden_apple') food += cnt(m, k);
  for (const k of oldGear(g)) {
    if (sold >= 4) break;
    const pay = food < 30 ? ['cooked_meat', 2] : cnt(m, 'lantern') < 8 ? ['lantern', 1] : ['gold_ingot', 1];
    take(m, k, 1); add(g, pay[0], pay[1]); food += FOOD[pay[0]] ? pay[1] : 0; sold++; n++;
    deal('Sold an old ' + ITEMS[k].toLowerCase() + ' for ' + pay[1] + ' ' + ITEMS[pay[0]].toLowerCase());
  }
  const buys = [['golden_apple', 6, 4, 1], ['wheat_seeds', 6, 2, 6], ['potato', 3, 2, 3], ['lantern', 8, 2, 2], ['glass_pane', 8, 1, 8]];
  let spent = 0;
  for (const [k, under, gems, out] of buys) {
    if (spent >= 2) break;
    if (cnt(m, k) >= under || cnt(m, 'gem') < 16 + gems) continue;
    take(m, 'gem', gems); add(g, k, out); spent++; n++;
    deal('Bought ' + out + ' ' + ITEMS[k].toLowerCase() + ' for ' + gems + ' gems');
  }
  return n;
}
