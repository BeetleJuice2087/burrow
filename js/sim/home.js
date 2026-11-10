// Burrow sim · home.js — Late-game life: keeping gear in repair, the workshop, decorating home, crafting one of everything.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// which placed tiles count as which crafting station
const STATION_TILES = {bench: [T.BENCH], furnace: [T.FURNACE, T.BLAST_FURNACE, T.SMOKER], fastSmelt: [T.BLAST_FURNACE, T.SMOKER], anvil: [T.ANVIL]};
const STATION_TILE_SET = new Set([T.BENCH, T.FURNACE, T.BLAST_FURNACE, T.SMOKER, T.ANVIL]);
const TILE_ITEM = {}; for (const k in BUILD_TILE) if (TILE_ITEM[BUILD_TILE[k]] === undefined) TILE_ITEM[BUILD_TILE[k]] = k;
TILE_ITEM[T.STORE_CHEST] = 'chest';

// ---------- keeping gear in repair ----------
function gearInUse(m) {
  const out = [];
  for (const kind of ['pick', 'sword']) { const k = equipped(m, kind); if (k) out.push(k); }
  const chest = armorPiece(m, 'chest'); if (chest) out.push(chest);
  return out;
}
function repairCost(k) {
  const R = RECIPES[k], main = Object.keys(R.in).find(i => i !== 'stick');
  return {[main]: Math.max(1, Math.ceil(R.in[main] / 2))};
}
// everything else it carries. This only starts once the gem pickaxe is made, and on the journey it waits for camp, so it can't hold up the early game or the road
function fullKit(m) {
  const out = gearInUse(m);
  for (const kind of ['axe', 'shovel']) { const k = equipped(m, kind); if (k) out.push(k); }
  for (const s of ARMOR_SLOTS) { const k = armorPiece(m, s); if (k && s !== 'chest') out.push(k); }
  for (const k of ['shield', 'shears']) if (m.inv[k]) out.push(k);
  return out;
}
const keepsFullKit = m => tier(m) >= 4 && (!m.journey || m.journey.stage === 'camp');
// the best it ever made for each slot, where that has broken and nothing as good took its place
function lostGear(g) {
  const m = g.m, made = g.stats.crafted, out = [];
  const lost = (fits, value, now) => {
    let top = null;
    for (const k in made) if (made[k] && RECIPES[k] && fits(k) && (!top || value(k) > value(top))) top = k;
    if (top && (!now || value(top) > value(now))) out.push(top);
  };
  for (const kind of ['sword', 'axe', 'shovel']) lost(k => TOOL_KIND[k] === kind, k => toolValue(kind, k), equipped(m, kind));
  for (const s of ARMOR_SLOTS) lost(k => ARMOR[k] && ARMOR[k].slot === s, k => ARMOR[k].def, armorPiece(m, s));
  for (const k of ['shield', 'shears']) if (made[k] && !m.inv[k]) out.push(k);
  return out;
}
// best gear that's nearly worn out gets fixed at an anvil, or a spare made before it breaks. Anything that broke anyway gets made again
function maintainJob(g) {
  const m = g.m, full = keepsFullKit(m);
  for (const k of full ? fullKit(m) : gearInUse(m)) {
    if (!RECIPES[k] || cnt(m, k) > 1 || durLeft(m, k) > DUR[k] * (m.journey && k.startsWith('cinder') ? CINDER_WORN : 0.2)) continue; // the Ember crown can't be remade
    if (m.journey && k.startsWith('cinder') && !campGate(g)) continue; // on the road, cinder gear waits for a gate at camp
    const name = ITEMS[k].toLowerCase();
    const anvil = stationNear(g, 'anvil', 150); // worth the walk home: it costs half a new one
    if (anvil) {
      m.chain = ['Repair my ' + name];
      const j = repairJob(g, k, anvil, m.chain); if (j) return j;
    }
    m.chain = ['Make a spare ' + name];
    const j = need(g, k, 2, m.chain); if (j) return j;
  }
  if (full) for (const k of lostGear(g)) {
    if (m.journey && k.startsWith('cinder') && !campGate(g)) continue;
    m.chain = ['Replace my ' + ITEMS[k].toLowerCase()];
    const j = need(g, k, 1, m.chain); if (j) return j;
  }
  return null;
}
function repairJob(g, k, anvil, chain) {
  const m = g.m, cost = repairCost(k);
  for (const i in cost) { const j = need(g, i, cost[i], chain); if (j) return j; }
  if (Math.abs(m.x - anvil.x) > 2 || Math.abs(m.y - anvil.y) > 2 || !canUse(g, anvil)) return gotoJob(g, 'Taking my ' + ITEMS[k].toLowerCase() + ' to the anvil', anvil.x, anvil.y, canUse(g, anvil) ? 2 : 1);
  return {
    name: 'repair', label: 'Repairing my ' + ITEMS[k].toLowerCase(),
    run(g) {
      m.act = {type: 'craft', t: 0, item: null, fn: () => {
        for (const i in cost) if (cnt(m, i) < cost[i]) return;
        for (const i in cost) take(m, i, cost[i]);
        m.dur = m.dur || {}; m.dur[k] = DUR[k];
        g.stats.repaired = (g.stats.repaired || 0) + 1;
        logEvent(g, 'Repaired my ' + ITEMS[k].toLowerCase() + ' at the anvil');
        milestone(g, 'repair', 'Repaired gear at the anvil');
      }};
      return 'done';
    }
  };
}

// ---------- building from a plan ----------
// a plan is a list of cells {x, y, tile}; tile T.AIR means "clear this cell"
const IN_THE_WAY = t => isSolid(t) || t === T.LOG || t === T.LEAVES || t === T.PINE || t === T.BUSH || t === T.BUSHE || t === T.CACTUS || t === T.TORCH;
const MOVABLE = {[T.BENCH]: 'bench', [T.FURNACE]: 'furnace'}; // old stations that are standing where a plan wants something else
function cellDone(g, c) {
  const t = get(g, c.x, c.y);
  if (c.tile === T.AIR) return !IN_THE_WAY(t) && !MOVABLE[t];
  return t === c.tile;
}
// keep a built thing and the ground holding it up out of the digging
function braceCell(g, c) { if (P[c.tile].solid) g.protect.add(c.y * W + c.x); g.protect.add((c.y + 1) * W + c.x); }
function buildJob(g, id, label, chain, cells, doneLabel, keepOut, noPillar) {
  const m = g.m;
  m.built = m.built || {}; m.buildWork = m.buildWork || {}; m.buildSkip = m.buildSkip || {};
  if (m.built[id]) return null;
  g.protect = g.protect || new Set();
  for (const c of cells) if (c.tile !== T.AIR) braceCell(g, c);
  g.noTorch = g.noTorch || new Set(); // a torch dropped here would only have to be cleared again, in the dark, forever
  for (const c of cells) g.noTorch.add(c.y * W + c.x);
  const left = cells.filter(c => !cellDone(g, c));
  const skipUntil = c => m.buildSkip[c.y * W + c.x] || 0;
  const tired = (m.buildWork[id] || 0) > 1500;
  if (!left.length || tired || left.every(c => skipUntil(c) > g.tick + 1e8)) { // finished, or all that's left can't be done
    m.built[id] = true;
    if (tired) logEvent(g, 'Called the ' + label.toLowerCase() + ' good enough');
    else milestone(g, id, doneLabel);
    return null;
  }
  const todo = left.filter(c => skipUntil(c) <= g.tick);
  if (!todo.length) return null; // can't reach what's left right now: on to the next goal, back here later
  // fetch or craft whatever the remaining cells need
  const want = {};
  for (const c of todo) if (c.tile !== T.AIR) { const it = TILE_ITEM[c.tile]; want[it] = (want[it] || 0) + 1; }
  for (const it in want) if (cnt(m, it) < want[it]) { const j = need(g, it, want[it], chain); if (j) return j; }
  const c = todo[0], key = c.y * W + c.x;
  const skip = dur => { m.buildSkip[key] = g.tick + dur; };
  return {
    name: 'build', label: (c.tile === T.AIR ? 'Clearing room for the ' : 'Building the ') + label.toLowerCase(),
    run(g) {
      const near = (x, y) => Math.hypot(c.x - x, c.y - (y - 0.5)) <= (c.reach || 3.9) && !(x === c.x && (y === c.y || y - 1 === c.y)) && !(keepOut && keepOut(x, y));
      if (!near(m.x, m.y)) {
        const far = Math.abs(c.x - m.x) + Math.abs(c.y - m.y) > 30; // the walk home: long legs, not a local search
        const path = far ? travel(g, c.x, c.y, 3) : findPath(g, {goal: near, h: (x, y) => Math.max(0, Math.hypot(c.x - x, c.y - y) - (c.reach || 3.9) + 0.9) * 5, maxNodes: 6000, range: 50, noPillar});
        if (!path) { skip(far ? 600 : 1500); return 'fail'; }
        m.path = path; return 'run';
      }
      m.buildWork[id] = (m.buildWork[id] || 0) + 1;
      m.facing = Math.sign(c.x - m.x) || m.facing;
      const t = get(g, c.x, c.y);
      if (MOVABLE[t]) { // pick it up and carry it
        m.act = {type: 'place', t: 0, fn: () => { if (get(g, c.x, c.y) === t) { setTile(g, c.x, c.y, T.AIR); add(g, MOVABLE[t], 1); } }};
        return 'done';
      }
      if (IN_THE_WAY(t)) { // something's in the way
        const ticks = isSolid(t) ? digTicks(t, tier(m)) : 6;
        if (ticks === INF) { skip(2e9); return 'fail'; }
        m.act = {type: 'dig', x: c.x, y: c.y, t: 0, need: ticks};
        return 'done';
      }
      if (c.tile === T.AIR) return 'done';
      if (t !== T.AIR && t !== T.WATER && !DECOR.has(t)) { skip(2e9); return 'fail'; } // furniture we can't shift
      const it = TILE_ITEM[c.tile];
      m.act = {type: 'place', t: 0, fn: () => {
        const now = get(g, c.x, c.y);
        if (cnt(m, it) <= 0 || (now !== T.AIR && now !== T.WATER && !DECOR.has(now)) || bodyHas(m, c.x, c.y)) return;
        take(m, it, 1); setTile(g, c.x, c.y, c.tile); g.stats.placed++;
        if (STATION_TILE_SET.has(c.tile)) m.stations.push({x: c.x, y: c.y, t: c.tile});
      }};
      return 'done';
    }
  };
}
// where the ground is near column x (feet cell: open, open above, solid below), closest to height y0
function groundAt(g, x, y0) {
  for (let d = 0; d <= 6; d++) for (const y of [y0 - d, y0 + d]) {
    if (!isSolid(get(g, x, y)) && !isSolid(get(g, x, y - 1)) && isSolid(get(g, x, y + 1))) return y;
  }
  return null;
}
// the stone workshop that goes against the hut's left wall
function workshopPlan(g) {
  const x0 = g.m.home.x, y0 = g.m.home.y, L = x0 - 11, cells = [];
  const floor = {[x0 - 9]: T.COAL_BLOCK, [x0 - 8]: T.COPPER_BLOCK, [x0 - 7]: T.IRON_BLOCK, [x0 - 6]: T.GOLD_BLOCK, [x0 - 5]: T.GEM_BLOCK};
  for (let x = L; x <= x0 - 4; x++) cells.push({x, y: y0 + 1, tile: floor[x] || T.STONE_BRICKS});
  cells.push({x: L, y: y0 - 3, tile: T.STONE_BRICKS});
  for (let x = L; x <= x0 - 4; x++) cells.push({x, y: y0 - 4, tile: x === x0 - 8 || x === x0 - 6 ? T.GLASS : T.STONE_BRICKS});
  for (let dy = 0; dy >= -3; dy--) for (let x = L + 1; x <= x0 - 4; x++) cells.push({x, y: y0 + dy, tile: T.AIR});
  cells.push({x: L, y: y0, tile: T.IRON_DOOR}, {x: L, y: y0 - 1, tile: T.IRON_DOOR}, {x: L, y: y0 - 2, tile: T.GLASS_PANE});
  const stations = [T.ANVIL, T.STONECUTTER, T.SMOKER, T.BLAST_FURNACE, T.CAULDRON, T.COPPER_CHEST];
  stations.forEach((t, i) => cells.push({x: L + 1 + i, y: y0, tile: t}));
  cells.push({x: L + 6, y: y0 - 1, tile: T.HOPPER}, {x: L + 2, y: y0 - 3, tile: T.LANTERN}, {x: L + 6, y: y0 - 3, tile: T.COPPER_LANTERN});
  return cells;
}
function workshopJob(g, chain) {
  return buildJob(g, 'workshop2', 'Workshop', chain, workshopPlan(g), 'Built a stone workshop');
}
// a yard past the hut door, a table and chair inside, a ladder up the workshop wall
function decorPlan(g) {
  const m = g.m, x0 = m.home.x, y0 = m.home.y, cells = [];
  const yard = [[5, T.SIGN], [6, T.CAMPFIRE], [8, T.FENCE], [9, T.FENCE_GATE], [10, T.FENCE], [12, T.RAIL], [13, T.MINECART], [14, T.RAIL]];
  for (const [dx, t] of yard) {
    const gy = groundAt(g, x0 + dx, y0); if (gy === null) continue;
    if (t === T.FENCE) cells.push({x: x0 + dx, y: gy - 1, tile: T.LANTERN, after: true});
    cells.push({x: x0 + dx, y: gy, tile: t});
  }
  for (let dx = 4; dx <= 7; dx++) { const gy = groundAt(g, x0 + dx, y0); if (gy !== null) cells.unshift({x: x0 + dx, y: gy + 1, tile: T.SMOOTH_STONE}); }
  const free = [];
  for (let dx = -2; dx <= 2; dx++) { const t = get(g, x0 + dx, y0); if ((t === T.AIR || t === T.WOOD_STAIRS || t === T.WOOD_SLAB) && !(m.bed && m.bed.x === x0 + dx && m.bed.y === y0)) free.push(x0 + dx); }
  if (free.length >= 2) cells.push({x: free[0], y: y0, tile: T.WOOD_STAIRS}, {x: free[1], y: y0, tile: T.WOOD_SLAB});
  if (get(g, x0 - 1, y0 - 3) === T.AIR || get(g, x0 - 1, y0 - 3) === T.LANTERN) cells.push({x: x0 - 1, y: y0 - 3, tile: T.LANTERN});
  if (free.length >= 2 && get(g, free[1], y0 - 1) === T.AIR) cells.push({x: free[1], y: y0 - 1, tile: T.COPPER_LANTERN}); // a lamp on the table
  if (get(g, x0 - 2, y0 - 2) === T.AIR) cells.push({x: x0 - 2, y: y0 - 2, tile: T.TRAPDOOR}); // a shelf
  cells.push({x: x0 + 3, y: y0 - 2, tile: T.GLASS_PANE}, {x: x0 - 3, y: y0 - 1, tile: T.IRON_BARS}); // a window out, a grille through to the workshop
  for (let dy = 0; dy >= -4; dy--) cells.push({x: x0 - 12, y: y0 + dy, tile: T.LADDER});
  // the path out of the yard, in every kind of paving
  const paving = {8: T.CUT_SANDSTONE, 9: T.CHISELED_SANDSTONE, 10: T.CUT_SANDSTONE, 11: T.STONE_TILE, 12: T.SMOOTH_SANDSTONE, 13: T.SMOOTH_SANDSTONE, 14: T.SMOOTH_SANDSTONE};
  for (const dx in paving) { const gy = groundAt(g, x0 + +dx, y0); if (gy !== null) cells.unshift({x: x0 + +dx, y: gy + 1, tile: paving[dx]}); }
  return cells.sort((a, b) => (a.after ? 1 : 0) - (b.after ? 1 : 0));
}
function decorateJob(g, chain) {
  const m = g.m;
  m.decorCells = m.decorCells || decorPlan(g); // fixed once drawn up: the ground rises as things get placed, and a fresh plan would stack them
  return buildJob(g, 'decorate2', 'Homestead', chain, m.decorCells, 'Decorated the homestead');
}
// the last of the crafted things: small touches indoors, a garden on the left, boats drawn up on the right
function finishPlan(g) {
  const x0 = g.m.home.x, y0 = g.m.home.y, L = x0 - 11, cells = [];
  cells.push({x: L + 1, y: y0 - 1, tile: T.BUTTON}, {x: L + 3, y: y0 - 2, tile: T.IRON_TRAPDOOR}, {x: L + 4, y: y0 - 1, tile: T.STONE_SLAB},
    {x: L + 5, y: y0 - 1, tile: T.BUCKET}, {x: L + 7, y: y0, tile: T.PRESSURE_PLATE}, {x: L + 7, y: y0 - 1, tile: T.EXPEDITION_PACK}, {x: L + 7, y: y0 - 2, tile: T.COPPER_TORCH});
  const outdoors = {[-14]: T.COBBLE_WALL, [-15]: T.COBBLE_STAIRS, [-16]: T.STONE_SLAB, [-17]: T.SANDSTONE_STAIRS, [-18]: T.SANDSTONE_SLAB, [-19]: T.SANDSTONE_WALL, 16: T.BOAT, 18: T.CHEST_BOAT};
  for (const dx in outdoors) { const gy = groundAt(g, x0 + +dx, y0); if (gy !== null) cells.push({x: x0 + +dx, y: gy, tile: outdoors[dx]}); }
  return cells;
}
function finishJob(g, chain) {
  const m = g.m;
  m.finishCells = m.finishCells || finishPlan(g);
  g.protect = g.protect || new Set();
  for (const c of m.decorCells || []) if (c.tile !== T.AIR) braceCell(g, c); // the yard went up before this rule did
  return buildJob(g, 'finish', 'Home', chain, m.finishCells, 'Finished furnishing the home');
}
// rooms around home, for the renderer's back walls
function homeRooms(g) {
  const m = g.m, h = m.home, j = m.journey, out = j && j.rooms ? j.rooms.slice() : [];
  if (g.realm === 'under') return out;
  if ((m.hut || g.hutBox) && !(j && j.keepHome === j.camps)) out.push({x0: h.x - 3, x1: h.x + 3, y0: h.y - 4, y1: h.y + 1, wall: 'planks'});
  if ((!j || j.stage === 'pack') && m.built && (m.built.workshop2 || m.buildWork && m.buildWork.workshop2)) out.push({x0: h.x - 11, x1: h.x - 3, y0: h.y - 4, y1: h.y + 1, wall: 'bricks'}); // a camp is only a hut
  return out;
}

// ---------- one of everything ----------
const COLLECTION = Object.keys(RECIPES).filter(k => !/^(cinder|gate|ward|bread|baked|bow)|_arrow$|^(grapple|ember_treads|silk_net|blast_charge|weathervane|trophy_shelf|map_table|rain_barrel|wind_chimes|pet_bed|kite|glow_broth|firewalk_tea|camp_stew|lucky_charm)$/.test(k)); // (the kit is made as the silk and powder turn up: kit.js) // the Underworld's gear has its own goals, and the farm feeds itself
function collectionCount(g) { let n = 0; for (const k of COLLECTION) if (g.stats.crafted[k]) n++; return n; }
function collectionJob(g, chain) {
  const m = g.m;
  for (const k of COLLECTION) {
    if (g.stats.crafted[k] || (k === 'cooked_fish' && g.stats.noWater && !shoreSpot(g, 120))) continue;
    const c = [chain[0], 'Craft a ' + ITEMS[k].toLowerCase()];
    const j = need(g, k, cnt(m, k) + 1, c);
    if (j) { chain.length = 0; chain.push(...c); return j; }
  }
  return null;
}

// ---------- storing spares at home ----------
const ALWAYS_CARRY = new Set(['bow', ...ARROWS.map(a => a.id), 'ward_key', 'torch', 'bench', 'furnace', 'bed', 'door', 'chest', 'shield', 'shears', 'fishing_rod', 'bucket', 'wheat', 'wheat_seeds', 'grapple', 'ember_treads', 'silk_net', 'blast_charge', 'silk', 'blast_powder', 'kite', 'glow_broth', 'firewalk_tea', 'lucky_charm']);
const BLOCK_RESERVE = {cobble: 64, dirt: 16, sand: 16, sandstone: 16};
const USED_IN_RECIPE = new Set(); for (const k in RECIPES) for (const i in RECIPES[k].in) USED_IN_RECIPE.add(i);
function storagePlan(g) {
  const L = g.m.home.x - 11, y0 = g.m.home.y;
  return [[L + 2, y0 - 1], [L + 3, y0 - 1], [L + 6, y0 - 2]].filter(([x, y]) => get(g, x, y) === T.AIR).map(([x, y]) => ({x, y, tile: T.STORE_CHEST}));
}
function storageJob(g, chain) {
  const m = g.m;
  m.storeCells = m.storeCells || storagePlan(g);
  return buildJob(g, 'storage', 'Home', chain, m.storeCells, 'Set up storage chests');
}
// what's worth carrying: the gear in use, food, and enough of each material for the next craft
function spareItems(g) {
  const m = g.m, inUse = new Set(['pick', 'sword', 'axe', 'shovel'].map(s => equipped(m, s)).concat(ARMOR_SLOTS.map(s => armorPiece(m, s))));
  const wanted = {};
  for (const k of COLLECTION) if (!g.stats.crafted[k]) for (const i in RECIPES[k].in) wanted[i] = Math.max(wanted[i] || 0, RECIPES[k].in[i]);
  const out = {}; let total = 0;
  for (const k in m.inv) {
    if (FOOD[k] || ALWAYS_CARRY.has(k) || inUse.has(k)) continue;
    const keep = Math.max(BLOCK_RESERVE[k] || (USED_IN_RECIPE.has(k) ? 16 : 0), wanted[k] || 0);
    if (m.inv[k] > keep) { out[k] = m.inv[k] - keep; total += out[k]; }
  }
  return {items: out, total};
}
// spares go in the chests whenever the miner is home, and it makes a special trip once the pack gets silly
function stashJob(g, chain) {
  const m = g.m;
  if (!m.built || !m.built.storage) return null;
  const L = m.home.x - 11, stores = (m.storeCells || []).concat([{x: L + 6, y: m.home.y}]).filter(c => [T.STORE_CHEST, T.COPPER_CHEST].includes(get(g, c.x, c.y)));
  if (!stores.length) return null;
  const c = stores.reduce((a, b) => Math.abs(b.x - m.x) + Math.abs(b.y - m.y) < Math.abs(a.x - m.x) + Math.abs(a.y - m.y) ? b : a);
  const far = Math.abs(c.x - m.x) + Math.abs(c.y - m.y), spare = spareItems(g);
  if (spare.total < (far <= 40 ? 12 : 600)) return null;
  if (Math.abs(m.x - c.x) > 2 || Math.abs(m.y - c.y) > 2 || !canUse(g, c)) {
    if (g.tick < (m.stashNext || 0)) return null;
    m.stashNext = g.tick + 600;
    chain.push('Store spares at home');
    return gotoJob(g, 'Taking spare items home to the chests', c.x, c.y, canUse(g, c) ? 2 : 1);
  }
  chain.push('Store spares at home');
  return {
    name: 'stash', label: 'Putting spare items in the chest',
    run(g) {
      m.act = {type: 'craft', t: 0, item: null, chest: c.y * W + c.x, fn: () => {
        const s = spareItems(g); m.stash = m.stash || {};
        for (const k in s.items) { take(m, k, s.items[k]); m.stash[k] = (m.stash[k] || 0) + s.items[k]; }
        g.stats.stored = (g.stats.stored || 0) + s.total;
        logEvent(g, 'Stored ' + s.total + ' spare items in the chests');
        milestone(g, 'stored', 'Stored spare items in a chest');
      }};
      return 'done';
    }
  };
}

// ---------- fishing ----------
// the closest place to stand on dry ground and cast into a pond it has seen: {x, y, wx, wy, dir}
function shoreSpot(g, r) {
  const m = g.m, w = g.w;
  for (let d = 0; d <= r; d++) for (const s of d ? [-1, 1] : [1]) {
    const x = m.x + s * d; if (x < 3 || x >= W - 3) continue;
    const wy = w.top[x], k = wy * W + x;
    if (w.t[k] !== T.WATER || !g.seen[k] || blacklisted(g, k)) continue;
    for (const dir of [1, -1]) { // walk back from the water to the bank
      const bx = x - dir, by = w.top[bx] - 1;
      if (w.t[w.top[bx] * W + bx] === T.WATER || !isSolid(get(g, bx, by + 1)) || Math.abs(by + 1 - wy) > 2) continue;
      if (!passable(get(g, bx, by)) || !passable(get(g, bx, by - 1))) continue;
      const far = bx + dir * 3, wx = get(g, far, w.top[far]) === T.WATER ? far : x;
      return {x: bx, y: by, wx, wy: w.top[wx], dir};
    }
  }
  return null;
}
function fishJob(g, n, label) {
  const m = g.m; let casts = 0;
  return {
    name: 'fish', label,
    run(g) {
      if (cnt(m, 'raw_fish') >= n || ++casts > 12) return 'done';
      if (cnt(m, 'fishing_rod') <= 0) return 'done';
      const spot = shoreSpot(g, 120);
      if (!spot) {
        g.stats.pondHunt = (g.stats.pondHunt || 0) + 1;
        if (g.stats.pondHunt > 150) { g.stats.noWater = true; return 'done'; } // long enough: not worth holding up the plan
        const s = surfaceFirst(g, 'to find a pond'); if (s) { m.job = s; return 'run'; }
        return exploreSurface(g, 'a pond');
      }
      if (m.x !== spot.x || m.y !== spot.y) {
        const path = travel(g, spot.x, spot.y, 0);
        if (!path) { blacklist(g, spot.wy * W + spot.wx, 4000); return 'fail'; }
        casts--; m.path = path; return 'run';
      }
      m.facing = spot.dir;
      m.act = {type: 'fish', t: 0, need: 100 + Math.floor(g.rng() * 140), x: spot.wx, y: spot.wy};
      return 'run';
    }
  };
}
function eveningFishing(g) {
  const m = g.m, f = dayFrac(g);
  if (tier(m) < 2 || cnt(m, 'fishing_rod') <= 0 || m.fishDay === g.day || f < 0.46 || f > 0.58) return false;
  if (g.day % 2 && foodCount(m) >= 6) return false; // plenty to eat: every other evening will do
  return !!shoreSpot(g, 70);
}
const CATCHES = [['raw_fish', 74], ['old_boot', 12], ['stick', 6], ['copper_nugget', 4], ['raw_gold', 3], ['gem', 1]];
function landCatch(g) {
  const m = g.m;
  let roll = g.rng() * 100, item = 'raw_fish';
  for (const [k, w] of CATCHES) { if (roll < w) { item = k; break; } roll -= w; }
  add(g, item, 1); wear(g, 'fishing_rod');
  if (item === 'raw_fish') { g.stats.fish = (g.stats.fish || 0) + 1; milestone(g, 'first_fish', 'Caught a first fish'); }
  else if (item === 'old_boot') logEvent(g, 'Fished up an old boot');
  else if (item !== 'stick') logEvent(g, 'Fished up ' + ITEMS[item].toLowerCase() + '!');
  g.fx.push({type: 'num', x: m.x, y: m.y - 2.5, text: '+' + ITEMS[item], life: 50, color: '#bfe8ff'});
}
