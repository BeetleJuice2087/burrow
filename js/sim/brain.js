// Burrow sim · brain.js — The goal ladder, survival jobs (food, sleep, hiding, fights) and job choice.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

const hasDef = (m, slot, def) => { const k = armorPiece(m, slot); return !!k && ARMOR[k].def >= def; };
const hasTool = (m, kind, rank) => { const k = equipped(m, kind); return !!k && MAT_RANK[TOOL_MAT[k]] >= rank; };
const GOALS = [
  {id: 'log', label: 'Punch some trees', done: (g, m) => cnt(m, 'log') + cnt(m, 'planks') / 4 >= 3 || tier(m) >= 1, item: ['log', 3]},
  {id: 'bench', label: 'Set up a workbench', done: (g, m) => m.stations.some(s => s.t === T.BENCH) || tier(m) >= 1, station: 'bench'},
  {id: 'wood_pick', label: 'Make a wood pickaxe', done: (g, m) => tier(m) >= 1, item: ['wood_pick', 1]},
  {id: 'woodstock', label: 'Stock up on wood', done: (g, m) => cnt(m, 'log') + cnt(m, 'planks') / 4 >= 8 || tier(m) >= 2, item: ['log', 9]},
  {id: 'stone_pick', label: 'Make a stone pickaxe', done: (g, m) => tier(m) >= 2, item: ['stone_pick', 1]},
  {id: 'stone_sword', label: 'Make a stone sword', done: (g, m) => swordDmg(m) >= 5, item: ['stone_sword', 1]},
  {id: 'furnace', label: 'Build a furnace', done: (g, m) => m.stations.some(s => s.t === T.FURNACE) || g.stats.milestones.some(s => s.id === 'place_furnace'), station: 'furnace'},
  {id: 'torch', label: 'Make torches', done: (g, m) => g.stats.crafted.torch >= 8, item: ['torch', 8]},
  {id: 'bed', label: 'Make a bed at home', done: (g, m) => !!m.bed, special: 'bed'},
  {id: 'hut', label: 'Build a hut', done: (g, m) => m.hut, special: 'hut'},
  {id: 'farm', label: 'Plant a farm', done: (g, m) => !!m.farmDone, special: 'farm'},
  {id: 'copper_armor', label: 'Make copper armor', done: (g, m) => hasDef(m, 'chest', 0.25), item: ['copper_armor', 1]},
  {id: 'bow', label: 'Make a bow and arrows', set: m => [['bow', cnt(m, 'bow') > 0], ['copper_arrow', arrowCount(m) > 0]]},
  {id: 'iron_pick', label: 'Make an iron pickaxe', done: (g, m) => tier(m) >= 3, item: ['iron_pick', 1]},
  {id: 'iron_sword', label: 'Make an iron sword', done: (g, m) => swordDmg(m) >= 7, item: ['iron_sword', 1]},
  {id: 'iron_armor', label: 'Make iron armor', done: (g, m) => hasDef(m, 'chest', 0.45), item: ['iron_armor', 1]},
  {id: 'gem_pick', label: 'Make the gem pickaxe', done: (g, m) => tier(m) >= 4, item: ['gem_pick', 1]},
  // after the gem pickaxe: better gear, a workshop, a decorated home, and one of every recipe
  {id: 'iron_set', label: 'Forge a full iron armor set', set: m => [['iron_helmet', hasDef(m, 'helmet', 0.07)], ['iron_legs', hasDef(m, 'legs', 0.12)], ['iron_boots', hasDef(m, 'boots', 0.06)], ['shield', !!m.inv.shield]]},
  {id: 'toolkit', label: 'Make an axe, shovel and shears', set: m => [['iron_axe', hasTool(m, 'axe', 3)], ['iron_shovel', hasTool(m, 'shovel', 3)], ['shears', !!m.inv.shears]]},
  {id: 'rod', label: 'Make a fishing rod', done: g => g.stats.crafted.fishing_rod >= 1, item: ['fishing_rod', 1]},
  {id: 'fish', label: 'Catch a fish', done: g => g.stats.fish >= 1 || g.stats.noWater, special: 'fish'},
  {id: 'workshop', label: 'Build a stone workshop', done: (g, m) => !!(m.built && m.built.workshop2), special: 'workshop'},
  {id: 'decorate', label: 'Decorate the homestead', done: (g, m) => !!(m.built && m.built.decorate2), special: 'decorate'},
  {id: 'finish', label: 'Finish furnishing the home', done: (g, m) => !!(m.built && m.built.finish), special: 'finish'},
  {id: 'storage', label: 'Set up storage chests', done: (g, m) => !!(m.built && m.built.storage), special: 'storage'},
  {id: 'gem_set', label: 'Make gem armor and a gem sword', set: m => [['gem_armor', hasDef(m, 'chest', 0.5)], ['gem_sword', swordDmg(m) >= 9], ['gem_helmet', hasDef(m, 'helmet', 0.1)], ['gem_legs', hasDef(m, 'legs', 0.14)], ['gem_boots', hasDef(m, 'boots', 0.08)]]},
  {id: 'reinforced', label: 'Make a reinforced pickaxe', done: (g, m) => tier(m) >= 5, item: ['reinforced_pick', 1]},
  {id: 'apples', label: 'Pack golden apples', done: (g, m) => cnt(m, 'golden_apple') >= 2, item: ['golden_apple', 2]},
  {id: 'collection', label: 'Craft one of everything', done: g => collectionCount(g) >= COLLECTION.length, special: 'collection'},
  {id: 'gate', label: 'Build the Underworld gate', done: (g, m) => !!(m.built && m.built.gate) && gateStands(g), special: 'gate'},
  {id: 'descend', label: 'Enter the Underworld', done: g => (g.stats.underTrips || 0) >= 1, special: 'descend'},
  {id: 'cinder_pick', label: 'Make a cinder pickaxe', done: (g, m) => tier(m) >= 6, item: ['cinder_pick', 1]},
  {id: 'cinder_sword', label: 'Make a cinder sword', done: (g, m) => swordDmg(m) >= 12, item: ['cinder_sword', 1]},
  {id: 'cinder_set', label: 'Make a full set of cinder armor', set: m => [['cinder_armor', hasDef(m, 'chest', 0.55)], ['cinder_helmet', hasDef(m, 'helmet', 0.11)], ['cinder_legs', hasDef(m, 'legs', 0.15)], ['cinder_boots', hasDef(m, 'boots', 0.09)]]},
  // the Underworld proper: walk its regions, then take on what lives at the far end (underJob does the work)
  {id: 'q_ember', label: 'Reach the Emberwood', done: (g, m) => quested(m, 'q_ember'), special: 'quest'},
  {id: 'q_fruit', label: 'Gather emberfruit', done: (g, m) => quested(m, 'q_fruit'), special: 'quest'},
  {id: 'q_shard', label: 'Reach the Shardfall', done: (g, m) => quested(m, 'q_shard'), special: 'quest'},
  {id: 'q_glimmer', label: 'Mine glimmer crystals', done: (g, m) => quested(m, 'q_glimmer'), special: 'quest'},
  {id: 'q_sea', label: 'See the Cinder Sea', done: (g, m) => quested(m, 'q_sea'), special: 'quest'},
  {id: 'q_ruins', label: 'Search four old watchtowers', done: (g, m) => quested(m, 'q_ruins'), special: 'quest'},
  {id: 'q_vaults', label: 'Clear three deep vaults', done: (g, m) => quested(m, 'q_vaults'), special: 'quest'},
  {id: 'q_key', label: 'Forge the Warden key', done: (g, m) => quested(m, 'q_open') || cnt(m, 'ward_key') > 0, item: ['ward_key', 1]},
  {id: 'q_wastes', label: 'Cross the Hollow Wastes', done: (g, m) => quested(m, 'q_wastes'), special: 'quest'},
  {id: 'q_citadel', label: 'Find the Ashen Citadel', done: (g, m) => quested(m, 'q_citadel'), special: 'quest'},
  {id: 'q_open', label: 'Open the Citadel door', done: (g, m) => quested(m, 'q_open'), special: 'quest'},
  {id: 'q_warden', label: 'Defeat the Ember Warden', done: (g, m) => quested(m, 'q_warden'), special: 'quest'},
  {id: 'q_home', label: 'Bring the crown home', done: (g, m) => quested(m, 'q_home'), special: 'retire'},
  {id: 'hoard', label: 'Hoard gems and gold', done: () => false, special: 'hoard'}
];
for (const G of GOALS) if (G.set) G.done = (g, m) => G.set(m).every(s => s[1]);

// the overworld checklist past the gem pickaxe stays ticked once it's done, and all of it does after the gate: eating
// a golden apple, or losing a pack down below, shouldn't send the miner back to dig up sixteen gold for a new one
{
  const late = GOALS.findIndex(G => G.id === 'gem_pick');
  GOALS.forEach((G, i) => {
    if (G.id === 'gate' || G.id === 'hoard' || G.id === 'farm' || G.id.startsWith('cinder') || G.id.startsWith('q_')) return; // a world from before the farm still gets one
    const done = G.done;
    G.done = (g, m) => {
      if (g.stats.underTrips > 0 || (m.latched && m.latched[G.id])) return true;
      const d = done(g, m);
      if (d && i > late) (m.latched = m.latched || {})[G.id] = 1;
      return d;
    };
  });
}
function bedJob(g) {
  const m = g.m;
  if (cnt(m, 'bed') <= 0) return null;
  const h = m.home;
  const near = Math.abs(m.x - h.x) <= 1 && Math.abs(m.y - h.y) <= 1;
  if (!near) return gotoJob(g, 'Heading home to set up the bed', h.x, h.y, 1);
  return {
    name: 'bed', label: 'Setting up the bed',
    run(g) {
      const spots = [];
      for (let dy = 0; dy >= -1; dy--) for (const dx of [-1, -2, 1, 2, 0, -3, 3]) spots.push([h.x + dx, h.y + dy]);
      for (const dx of [-1, 1, -2, 2]) spots.push([m.x + dx, m.y]); // or right beside the miner
      for (const [x, y] of spots) {
        const t = get(g, x, y);
        if ((t === T.AIR || DECOR.has(t)) && solidAt(g, x, y + 1) && !bodyHas(m, x, y)) {
          m.act = {type: 'place', t: 0, fn: () => { take(m, 'bed', 1); setTile(g, x, y, T.BED); m.bed = {x, y}; milestone(g, 'bed', 'Made a bed at home'); }};
          return 'done';
        }
      }
      // no room: clear a spot right next to us
      const cx = m.x + m.facing, ct = get(g, cx, m.y);
      if (isSolid(ct) && solidAt(g, cx, m.y + 1) && digTicks(ct, tier(m)) < INF) { m.act = {type: 'dig', x: cx, y: m.y, t: 0, need: digTicks(ct, tier(m))}; return 'run'; }
      m.facing = -m.facing;
      return 'fail';
    }
  };
}
function hutPlan(g) {
  const h = g.m.bed || g.m.home, x0 = g.m.home.x, y0 = g.m.home.y;
  const cells = [];
  for (let dx = -3; dx <= 3; dx++) cells.push({x: x0 + dx, y: y0 + 1, want: 'solid'});
  for (let dy = 0; dy >= -3; dy--) for (let dx = -2; dx <= 2; dx++) cells.push({x: x0 + dx, y: y0 + dy, want: 'clear'});
  for (let dy = 0; dy >= -3; dy--) cells.push({x: x0 - 3, y: y0 + dy, want: 'solid'});
  for (let dy = 0; dy >= -3; dy--) cells.push({x: x0 + 3, y: y0 + dy, want: dy >= -1 ? 'door' : 'solid'});
  for (let dx = -3; dx <= 3; dx++) cells.push({x: x0 + dx, y: y0 - 4, want: 'solid'});
  cells.push({x: x0 + 1, y: y0 - 3, want: 'torch'});
  return cells;
}
function hutCellOk(g, c) {
  const t = get(g, c.x, c.y);
  if (c.want === 'solid') return isSolid(t);
  if (c.want === 'clear') return !isSolid(t) && t !== T.LOG && t !== T.LEAVES && t !== T.PINE;
  if (c.want === 'door') return t === T.DOOR;
  if (c.want === 'torch') return t === T.TORCH;
}
function hutJob(g) {
  const m = g.m;
  const cells = hutPlan(g);
  if (!g.protect) { g.protect = new Set(); for (const c of cells) if (c.want === 'solid') g.protect.add(c.y * W + c.x); }
  g.hutBox = {x0: m.home.x - 3, x1: m.home.x + 3, y0: m.home.y - 4, y1: m.home.y + 1};
  m.hutWork = (m.hutWork || 0) + 1;
  if (m.hutWork > 160) { m.hut = true; logEvent(g, 'Called the hut good enough'); return null; }
  const todo = cells.filter(c => !hutCellOk(g, c));
  if (!todo.length) { m.hut = true; milestone(g, 'hut', 'Built a hut'); logEvent(g, 'Finished the hut'); return null; }
  const chain = ['Build a hut'];
  const solids = todo.filter(c => c.want === 'solid').length;
  if (blocksAvail(m) < solids) { const j = need(g, 'cobble', cnt(m, 'cobble') + solids - blocksAvail(m) + 2, chain); if (j) return j; }
  if (todo.some(c => c.want === 'door') && cnt(m, 'door') < todo.filter(c => c.want === 'door').length) { const j = need(g, 'door', 2, chain); if (j) return j; }
  if (todo.some(c => c.want === 'torch') && cnt(m, 'torch') < 1) { const j = need(g, 'torch', 2, chain); if (j) return j; }
  const c = todo[0];
  return {
    name: 'hut', label: 'Building the hut',
    run(g) {
      const near = (x, y) => Math.hypot(c.x - x, c.y - (y - 0.5)) <= 3.2 && !(x === c.x && (y === c.y || y - 1 === c.y)) && !(c.want === 'solid' && x === c.x && y + 1 === c.y && false);
      if (!near(m.x, m.y)) {
        const path = findPath(g, {goal: near, h: (x, y) => Math.max(0, Math.hypot(c.x - x, c.y - y) - 3) * 5, maxNodes: 6000, range: 40});
        if (!path) { m.hut = true; logEvent(g, 'Gave up on part of the hut'); return 'fail'; }
        m.path = path; return 'run';
      }
      const t = get(g, c.x, c.y);
      if (c.want === 'clear' || (c.want !== 'solid' && isSolid(t)) || (t === T.LOG || t === T.LEAVES || t === T.PINE)) {
        const need = isSolid(t) ? digTicks(t, tier(m)) : 6;
        if (need === INF) { m.hut = true; return 'fail'; }
        m.act = {type: 'dig', x: c.x, y: c.y, t: 0, need};
        return 'done';
      }
      m.act = {type: 'place', t: 0, fn: () => {
        if (c.want === 'solid') { if (cnt(m, 'cobble') > 0) { take(m, 'cobble', 1); setTile(g, c.x, c.y, T.COBBLE); } else placeBlock(g, c.x, c.y); }
        else if (c.want === 'door' && cnt(m, 'door') > 0) { take(m, 'door', 1); setTile(g, c.x, c.y, T.DOOR); }
        else if (c.want === 'torch' && cnt(m, 'torch') > 0) { take(m, 'torch', 1); setTile(g, c.x, c.y, T.TORCH); }
      }};
      m.facing = Math.sign(c.x - m.x) || m.facing;
      return 'done';
    }
  };
}

function lootJob(g) {
  // nearby chests / own graves
  const m = g.m;
  let best = null, bd = INF;
  const consider = (k, kind) => {
    const x = k % W, y = (k / W) | 0;
    if (blacklisted(g, k)) return;
    if (kind === 'chest' && g.w.t[k] !== T.CHEST) { delete g.w.chests[k]; return; } // tile was overwritten
    if (kind === 'chest' && !g.seen[k]) return;
    const d = Math.abs(x - m.x) + Math.abs(y - m.y);
    if (d < bd && d < (kind === 'grave' ? 300 : 40)) { bd = d; best = {x, y, k, kind}; }
  };
  for (const k in g.w.graves) consider(+k, 'grave');
  if (!best) for (const k in g.w.chests) consider(+k, 'chest');
  if (!best) return null;
  const tgt = best;
  return {
    name: 'loot', label: tgt.kind === 'grave' ? 'Going back for my dropped pack' : 'Checking out a chest',
    run(g) {
      if (inReach(m, tgt.x, tgt.y)) {
        m.act = {type: 'place', t: 0, fn: () => {
          const store = tgt.kind === 'grave' ? g.w.graves : g.w.chests;
          const items = store[tgt.k]; if (!items) return;
          for (const it in items) add(g, it, items[it]);
          delete store[tgt.k];
          if (tgt.kind === 'grave') { setTile(g, tgt.x, tgt.y, T.AIR); logEvent(g, 'Got my pack back'); }
          else { logEvent(g, 'Looted a chest: ' + Object.keys(items).map(i => items[i] + ' ' + ITEMS[i].toLowerCase()).join(', ')); milestone(g, 'chest', 'Found a treasure chest'); }
        }};
        return 'done';
      }
      const path = Math.abs(tgt.x - m.x) > 40 ? travel(g, tgt.x, tgt.y, 1) : findPath(g, {goal: reachGoal([tgt]), h: nearestH([tgt]), maxNodes: 20000, range: 150});
      if (!path) {
        blacklist(g, tgt.k, 3000);
        if (tgt.kind === 'grave') { // can't reach it: after a few tries, let it go
          g.graveFails = g.graveFails || {}; g.graveFails[tgt.k] = (g.graveFails[tgt.k] || 0) + 1;
          if (g.graveFails[tgt.k] >= 3) { delete g.w.graves[tgt.k]; setTile(g, tgt.x, tgt.y, T.AIR); logEvent(g, 'Gave up on a dropped pack it couldn\u2019t reach'); }
        }
        return 'fail';
      }
      m.path = path; return 'run';
    }
  };
}

function eatJob(g, allowRaw) {
  const m = g.m;
  const order = ['cooked_meat', 'cooked_fish', 'fruit_pie', 'bread', 'baked_potato', 'apple', 'berries'].concat(allowRaw ? ['golden_apple', 'raw_meat', 'raw_fish', 'potato'] : []);
  for (const k of order) if (cnt(m, k) > 0) return {
    name: 'eat', label: 'Eating ' + ITEMS[k].toLowerCase(),
    run(g) { m.act = {type: 'eat', t: 0, item: k}; return 'done'; }
  };
  return null;
}
function foodJob(g) {
  const m = g.m;
  // cook if possible
  if (cnt(m, 'raw_meat') > 0 && cnt(m, 'coal') > 0 && (stationNear(g, 'furnace', 30) || cnt(m, 'furnace') > 0 || cnt(m, 'cobble') >= 8)) {
    const j = need(g, 'cooked_meat', cnt(m, 'cooked_meat') + cnt(m, 'raw_meat'), []);
    if (j) return j;
  }
  if (cnt(m, 'raw_fish') > 0 && cnt(m, 'coal') > 0 && (stationNear(g, 'furnace', 30) || cnt(m, 'furnace') > 0 || cnt(m, 'cobble') >= 8)) {
    const j = need(g, 'cooked_fish', cnt(m, 'cooked_fish') + cnt(m, 'raw_fish'), []);
    if (j) return j;
  }
  // berries nearby
  const s = surfaceFirst(g, 'to find food'); if (s) return s;
  const bushes = scanTiles(g, [T.BUSH], 40, 10);
  if (bushes.length) return collectJob(g, 'berries', cnt(m, 'berries') + 4, [T.BUSH], 'Picking berries', {find: g => scanTiles(g, [T.BUSH], 40, 10), fallback: () => 'fail'});
  // no pudgeons about, but there's a rod in the pack and water close by
  if (cnt(m, 'fishing_rod') > 0 && !g.critters.some(c => Math.abs(c.x - m.x) < 40) && shoreSpot(g, 60)) return fishJob(g, cnt(m, 'raw_fish') + 3, 'Fishing for supper');
  return huntJob(g);
}
function sleepJob(g) {
  const m = g.m, b = m.bed;
  return {
    name: 'sleep', label: 'Heading to bed for the night',
    run(g) {
      if (!isNight(g)) return 'done';
      if (get(g, b.x, b.y) !== T.BED) { m.bed = null; return 'fail'; }
      if (m.x === b.x && m.y === b.y) { m.sleeping = true; m.act = {type: 'sleep', t: 0}; return 'done'; }
      const path = travel(g, b.x, b.y, 0);
      if (!path) { m.sleptDay = g.day; return 'fail'; }
      m.path = path; return 'run';
    }
  };
}
function needsShelter(g) {
  const m = g.m;
  if (!isNight(g) || m.hidDay === g.day) return false;
  if (villageNear(g, m.x, VILLAGE_SAFE, true)) return false; // nothing comes near the lamps, and there's an inn
  if ((m.campCells || m.growCells) && m.journey && m.journey.stage === 'camp') return false; // it keeps building: a hole here would go through the keep's own floor
  if (m.bed && m.sleptDay !== g.day && Math.abs(m.x - m.bed.x) + Math.abs(m.y - m.bed.y) < 50) return false;
  return m.y - g.w.top[m.x] <= 3;
}
function hideJob(g) {
  const m = g.m;
  const y0 = m.y;
  let tries = 0;
  return {
    name: 'hide', label: 'Digging in for the night',
    run(g) {
      if (!isNight(g)) return 'done';
      if (++tries > 12) { m.hidDay = g.day; return 'fail'; }
      const sealed = isSolid(get(g, m.x, m.y - 2)) && !skyAt(g, m.x, m.y - 1);
      if (sealed && m.y >= y0 + 2) { m.hiding = true; m.act = {type: 'hide', t: 0}; return 'done'; }
      if (m.y < y0 + 2) {
        if (solidAt(g, m.x, m.y + 1) && solidAt(g, m.x, m.y + 2) && cellCost(g, m.x, m.y + 1, tier(m), false) < INF) { m.path = [{x: m.x, y: m.y + 1, m: 'D'}]; return 'run'; }
        const p = findPath(g, {goal: (x, y) => x !== m.x && solidAt(g, x, y + 1) && solidAt(g, x, y + 2) && cellCost(g, x, y + 1, tier(m), false) < INF, h: () => 0, maxNodes: 300});
        if (p && p.length) { m.path = p; return 'run'; }
        m.hidDay = g.day; return 'fail';
      }
      if (passable(get(g, m.x, m.y - 2)) && blocksAvail(m) > 0) {
        m.act = {type: 'place', t: 0, fn: () => placeBlock(g, m.x, m.y - 2)};
        return 'run';
      }
      m.hidDay = g.day; return 'fail';
    }
  };
}
function fightJob(g, e) {
  const m = g.m;
  return {
    name: 'fight', label: 'Fighting ' + (e.type === 'warden' ? 'the ' : /^[aeiou]/.test(MON[e.type].name) ? 'an ' : 'a ') + MON[e.type].name,
    run(g) {
      if (e.hp <= 0 || !g.monsters.includes(e)) return 'done';
      if (Math.abs(e.x - m.x) <= 1 && Math.abs(e.y - m.y) <= 1) {
        m.facing = Math.sign(e.x - m.x) || m.facing;
        m.act = {type: 'swing', t: 0, target: e}; e.chased = 0;
        return 'run';
      }
      if (Math.abs(e.x - m.x) + Math.abs(e.y - m.y) > 10) return 'done';
      // the only way to it can lead off the other way: walk that for long enough to see it's going nowhere, then leave it
      e.chased = (e.chased || 0) + 1;
      if (e.chased > 24) { e.chased = 0; e.misses = (e.misses || 0) + 1; e.ignore = g.tick + 160 * Math.pow(2, Math.min(4, e.misses - 1)); return 'done'; }
      const path = findPath(g, {goal: (x, y) => Math.abs(x - e.x) <= 1 && Math.abs(y - e.y) <= 1, h: (x, y) => Math.abs(x - e.x) * 5 + Math.abs(y - e.y) * 5, maxNodes: 600, noDig: true, noPillar: true});
      if (!path || !path.length) { // can't get at it: ignore it, for longer each time, so it can't keep pulling the miner off its work
        e.misses = (e.misses || 0) + 1; e.ignore = g.tick + 160 * Math.pow(2, Math.min(4, e.misses - 1));
        m.act = {type: 'wait', t: 0, dur: 8}; return 'done';
      }
      m.path = path.slice(0, 1);
      return 'run';
    }
  };
}
function strandedJob(g) {
  const m = g.m;
  if (blocksAvail(m) < 6) { const j = gatherJob(g, 'dirt', cnt(m, 'dirt') + 12); if (j && scanTiles(g, [T.DIRT, T.GRASS, T.SNOW], 14, 8).length) { m.chain = ['Dig out blocks to climb with']; return j; } }
  const p = findPath(g, {goal: (x, y) => Math.abs(x - m.x) + Math.abs(y - m.y) >= 10, h: () => 0, maxNodes: 6000, range: 30, maxFall: 40});
  if (!p || !p.length) return null;
  for (const n of p) n.drop = true; // the step checks need to know this drop was chosen on purpose
  return {name: 'stranded', label: 'No way down but to jump', run(g) { m.path = p; m.stillAt = g.tick; return 'done'; }};
}
function wanderJob(g) {
  const m = g.m;
  return {
    name: 'wander', label: 'Hmm, rethinking the plan',
    run(g) {
      // nothing can be stacked under its feet while it stands in a bench or furnace, so one set down in a pit can be the only thing keeping it there
      const stood = get(g, m.x, m.y);
      if (MOVABLE[stood] && !travel(g, m.home.x, m.home.y, 2)) {
        m.thought = 'Boxed in by my own furniture. Packing it up';
        m.act = {type: 'place', t: 0, fn: () => {
          if (get(g, m.x, m.y) !== stood) return;
          setTile(g, m.x, m.y, T.AIR); add(g, MOVABLE[stood], 1);
          m.stations = m.stations.filter(s => s.x !== m.x || s.y !== m.y);
        }};
        return 'done';
      }
      const tx = m.x + (g.rng() < 0.5 ? -8 : 8);
      let p = findPath(g, {goal: (x, y) => Math.abs(x - tx) <= 2, h: (x, y) => Math.abs(x - tx) * 5, maxNodes: 3000, partial: true});
      if (!p || !p.length) { // boxed in (every way out touches lava): risk it rather than wait forever
        pathLavaRisk = true;
        try { p = findPath(g, {goal: (x, y) => Math.abs(x - m.x) + Math.abs(y - m.y) >= 4 && !inLavaAt(g, x, y), h: () => 0, maxNodes: 3000, range: 12}); }
        finally { pathLavaRisk = false; }
        if (p) for (const n of p) n.risk = true; // the step checks need to know this path accepted the risk
      }
      if (p && p.length) m.path = p;
      else m.act = {type: 'wait', t: 0, dur: 20};
      return 'done';
    }
  };
}

function inLavaAt(g, x, y) { return get(g, x, y) === T.LAVA || get(g, x, y - 1) === T.LAVA; }
function inLava(g) { const m = g.m; return get(g, m.x, m.y) === T.LAVA || get(g, m.x, m.y - 1) === T.LAVA; }
function escapeJob(g) {
  const m = g.m;
  return {
    name: 'escape', label: 'Hot hot hot! Getting out of the lava',
    run(g) {
      if (!inLava(g)) return 'done';
      const ok = (x, y) => get(g, x, y) !== T.LAVA && get(g, x, y - 1) !== T.LAVA;
      const p = findPath(g, {goal: ok, h: () => 0, maxNodes: 600, range: 12});
      if (p && p.length) { m.path = p.slice(0, 3); return 'run'; }
      return 'fail';
    }
  };
}
// Deep down and pacing the same few tiles for minutes: the everyday route search only looks so far, and can settle on a dead end below the goal every time.
// So search as far as it takes for the open air, rather than keep going round. Risking lava is the last resort
const WAY_OUT_AFTER = 3600, WAY_OUT_DEEP = 12;
function wayOutJob(g) {
  const m = g.m, deep = m.y > g.w.surf[m.x] + WAY_OUT_DEEP;
  if (!deep || g.tick - (m.stillAt || g.tick) < WAY_OUT_AFTER || g.tick < (m.wayOutNext || 0)) return null;
  m.wayOutNext = g.tick + 400;
  const search = () => findPath(g, {goal: (x, y) => y <= g.w.surf[x], h: (x, y) => Math.max(0, y - g.w.surf[x]) * 5, maxNodes: 200000, range: 300});
  let path = search(), risky = false;
  if (!path || !path.length) {
    pathLavaRisk = true;
    try { path = search(); } finally { pathLavaRisk = false; }
    risky = true;
  }
  if (!path || !path.length) return null;
  if (risky) for (const n of path) n.risk = true;
  return {name: 'wayout', label: 'Lost down here. Finding a way up', run(g) { m.path = path; path = []; return m.path.length ? 'run' : 'done'; }};
}
function chooseJob(g) {
  const m = g.m;
  m.chain = [];
  if (inLava(g)) return escapeJob(g);
  { const j = gateTrapJob(g); if (j) return j; }
  // starving in the same few tiles: stranded with no blocks to climb out. Dig some up, or failing that, take a hard landing
  if (Math.abs(m.x - (m.stillX || 0)) + Math.abs(m.y - (m.stillY || 0)) > 8) { m.stillX = m.x; m.stillY = m.y; m.stillAt = g.tick; }
  if (m.hunger <= 8 && g.tick - (m.stillAt || g.tick) > 1500) { const j = strandedJob(g); if (j) return j; }
  // danger
  let close = null, cd = INF;
  for (const e of g.monsters) { if (e.ignore > g.tick || capAsleep(e)) continue; const d = Math.abs(e.x - m.x) + Math.abs(e.y - m.y); if (d < cd && d <= 6) { cd = d; close = e; } }
  if (m.hp <= 9 && hasFood(m) && m.hunger < 20) { const j = eatJob(g, m.hp <= 5); if (j) return j; }
  { const e = capToFlee(g), j = e && backAwayJob(g, e); if (j) return j; }
  { const e = !close || cd >= BOW_NEAR ? bowTarget(g) : null; if (e) return shootJob(g, e); } // while it's still a way off
  if (close) return fightJob(g, close);
  if (m.hunger <= 12) { const j = eatJob(g, m.hunger <= 4); if (j) return j; }
  if (inUnder(g)) return underJob(g);
  { const j = wayOutJob(g); if (j) return j; }
  if (m.hunger <= 3) { m.chain = ['Find food']; const j = foodJob(g); if (j) return j; }
  if (isNight(g) && m.bed && m.sleptDay !== g.day && Math.abs(m.x - m.bed.x) + Math.abs(m.y - m.bed.y) < 50) return sleepJob(g);
  if (needsShelter(g)) return hideJob(g);
  if (weatherCalls(g)) { m.chain = ['Stay dry']; return shelterJob(g); }
  if (m.hunger <= 9) { m.chain = ['Find food']; const j = foodJob(g); if (j) return j; }
  { const j = spawnerJob(g); if (j) { m.chain = ['Clear the dungeon']; return j; } }
  const loot = lootJob(g);
  if (loot && loot.label.startsWith('Going back')) return loot;
  if (loot) return loot;
  { const j = villageJob(g); if (j) return j; }
  // fix or replace the gear in use before it breaks
  { const j = maintainJob(g); if (j) return j; }
  // keep torches topped up once we know how
  if (g.stats.crafted.torch >= 8 && cnt(m, 'torch') < 3 && cnt(m, 'coal') > 0) {
    const j = need(g, 'torch', 8, ['Restock torches']); if (j) return j;
  }
  // keep blocks on hand for climbing and bridging
  if (tier(m) >= 2) { const j = quiverJob(g); if (j) return j; }
  if (tier(m) >= 1 && blocksAvail(m) < 10) { m.chain = ['Keep blocks for climbing']; const j = gatherJob(g, 'cobble', cnt(m, 'cobble') + 20); if (j) return j; }
  // food stock before long trips
  if (m.hunger <= 14 && !hasFood(m) && tier(m) >= 2) { m.chain = ['Pack some food']; const j = foodJob(g); if (j) return j; }
  // every other evening, once the hard work is done, a little fishing near home
  if (eveningFishing(g)) { m.fishDay = g.day; m.chain = ['Evening fishing']; return fishJob(g, cnt(m, 'raw_fish') + 3, 'Fishing as the sun goes down'); }
  { const j = kitchenJob(g); if (j) return j; }
  { const c = []; const j = stashJob(g, c); if (j) { m.chain = c; return j; } }
  { const j = farmUpkeep(g); if (j) return j; }
  { const j = traderJob(g); if (j) { m.chain = ['See the trader']; return j; } }
  if (m.journey) return journeyJob(g) || wanderJob(g);
  // progression
  for (let i = 0; i < GOALS.length; i++) {
    const G = GOALS[i];
    if (G.done(g, m)) continue;
    if ((G.id.startsWith('cinder') || G.id.startsWith('q_')) && G.id !== 'q_home' && !gateStands(g)) continue; // only reachable through the gate
    g.goalIdx = i;
    const chain = [G.label];
    let j = null;
    if (G.item) j = need(g, G.item[0], G.item[1], chain);
    else if (G.set) { for (const [k, ok] of G.set(m)) if (!ok) { j = need(g, k, cnt(m, k) + 1, chain); if (j) break; } if (!j) continue; }
    else if (G.special === 'workshop') { j = workshopJob(g, chain); if (!j) continue; }
    else if (G.special === 'decorate') { j = decorateJob(g, chain); if (!j) continue; }
    else if (G.special === 'finish') { j = finishJob(g, chain); if (!j) continue; }
    else if (G.special === 'gate') { j = gateJob(g, chain); if (!j) continue; }
    else if (G.special === 'descend') j = tripJob(g, 12, chain);
    else if (G.special === 'quest') j = tripJob(g, 0, chain);
    else if (G.special === 'retire') j = retireJob(g);
    else if (G.special === 'storage') { j = storageJob(g, chain); if (!j) continue; }
    else if (G.special === 'fish') j = need(g, 'raw_fish', cnt(m, 'raw_fish') + 1, chain);
    else if (G.special === 'collection') { j = collectionJob(g, chain); if (!j) continue; }
    else if (G.station) {
      if (cnt(m, G.station) > 0) j = placeStationJob(g, G.station);
      else j = need(g, G.station, 1, chain);
    } else if (G.special === 'bed') {
      if (cnt(m, 'bed') > 0) j = bedJob(g); else j = need(g, 'bed', 1, chain);
    } else if (G.special === 'farm') {
      j = farmGoal(g, chain);
      if (!j) continue;
    } else if (G.special === 'hut') {
      j = hutJob(g);
      if (!j) continue;
    } else if (G.special === 'hoard') {
      const held = k => cnt(m, k) + ((m.stash || {})[k] || 0);
      const want = held('gem') < held('raw_gold') + held('gold_ingot') ? 'gem' : 'raw_gold';
      j = need(g, want, cnt(m, want) + 3, chain);
    }
    m.chain = chain;
    if (j) return j; // nothing doable on this goal right now: get on with the next one rather than stand about
  }
  return wanderJob(g);
}

// with an iron pickaxe, a spawner it can see gets broken before anything else
function spawnerNear(g, r) {
  const m = g.m;
  if (tier(m) < P[T.SPAWNER].tier) return null;
  let best = null, bd = r;
  for (const s of g.w.spawners || []) {
    const k = s.y * W + s.x, d = Math.abs(s.x - m.x) + Math.abs(s.y - m.y);
    if (g.w.t[k] === T.SPAWNER && g.seen[k] && !blacklisted(g, k) && d <= bd) { best = s; bd = d; }
  }
  return best;
}
function spawnerJob(g) {
  const m = g.m, s = spawnerNear(g, 40);
  if (!s) return null;
  if (inReach(m, s.x, s.y)) return {
    name: 'spawner', label: 'Breaking the monster spawner',
    run(g) { m.act = {type: 'dig', x: s.x, y: s.y, t: 0, need: digTicks(T.SPAWNER, tier(m))}; return 'done'; }
  };
  return {
    name: 'spawner', label: 'Going to break the monster spawner',
    run(g) {
      if (inReach(m, s.x, s.y)) return 'done';
      const path = findPath(g, {goal: reachGoal([s]), h: nearestH([s]), maxNodes: 12000, range: 60});
      if (!path) { blacklist(g, s.y * W + s.x, 4800); return 'fail'; }
      m.path = path; return 'run';
    }
  };
}
function thinkInterrupts(g) {
  const m = g.m;
  if (!m.job) return;
  if (m.job.name === 'fight' || m.job.name === 'eat' || m.job.name === 'shoot' || m.job.name === 'flee') return;
  for (const e of g.monsters) if (!(e.ignore > g.tick) && !capAsleep(e) && Math.abs(e.x - m.x) + Math.abs(e.y - m.y) <= 4) { m.job = null; m.path = []; return; }
  if (!['hide', 'escape', 'gate', 'stranded'].includes(m.job.name) && bowTarget(g)) { m.job = null; m.path = []; return; }
  if (inUnder(g)) return; // no beds or sunrises down there: chooseJob handles it between jobs
  if (m.hunger <= 9 && m.chain[0] !== 'Find food' && m.job.name !== 'hunt' && m.job.name !== 'collect' && m.job.name !== 'surface') { m.job = null; m.path = []; return; } // (a food job may need coal first, e.g. to cook)
  // only interrupt for something chooseJob would rank above this food run, or it re-picks the food job and loops
  const foodRun = m.hunger <= 9 && m.chain[0] === 'Find food';
  if (foodRun && m.hunger <= 3) return; // starving outranks bed and shelter
  if (isNight(g) && m.bed && m.sleptDay !== g.day && m.job.name !== 'sleep' && m.job.name !== 'loot' && Math.abs(m.x - m.bed.x) + Math.abs(m.y - m.bed.y) < 50) { m.job = null; m.path = []; }
  else if (m.job.name !== 'hide' && needsShelter(g)) { m.job = null; m.path = []; }
  else if (m.hunger > 9 && !['shelter', 'sleep', 'hide', 'fight', 'eat', 'loot', 'escape', 'gate'].includes(m.job.name) && weatherCalls(g)) { m.job = null; m.path = []; }
  else if (!foodRun && !['fish', 'loot', 'build', 'hide', 'sleep', 'escape'].includes(m.job.name) && eveningFishing(g)) { m.job = null; m.path = []; }
  else if (!foodRun && !['spawner', 'hide', 'sleep', 'escape'].includes(m.job.name) && spawnerNear(g, 14)) { m.job = null; m.path = []; }
  else if (!foodRun && !['loot', 'hide', 'sleep', 'escape'].includes(m.job.name)) {
    // a chest came into view while busy with something else: go open it
    for (const s in g.w.chests) {
      const k = +s, x = k % W, y = (k / W) | 0;
      if (g.seen[k] && g.w.t[k] === T.CHEST && !blacklisted(g, k) && Math.abs(x - m.x) + Math.abs(y - m.y) <= 12) { m.job = null; m.path = []; return; }
    }
  }
}
