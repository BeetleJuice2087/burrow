// Burrow sim · farm.js — The farm: two five-block plots near home, wheat and potatoes, and cooking what comes in.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// A crop remembers the clock time it was planted (w.crops), so it keeps growing while the overworld waits behind the gate.
'use strict';

const GROW_DAYS = {wheat: 3, potato: 4}, CROP_TILE = {wheat: T.WHEAT, potato: T.POTATO_PLANT}, CROP_SEED = {wheat: 'wheat_seeds', potato: 'potato'};
const CROP_TILE_SET = new Set([T.WHEAT, T.POTATO_PLANT]);
const FARM_SOIL = new Set([T.GRASS, T.DIRT, T.SNOW, T.SAND]), PLOT_LEN = 5;
// 0..2 growing, 3 ready to pick
function cropStage(g, k) {
  const c = g.w.crops && g.w.crops[k];
  if (!c) return 0;
  const p = (g.time - c.at) / (GROW_DAYS[c.kind] * DAY);
  return p >= 1 ? 3 : Math.floor(p * 3);
}
function plotAt(g, x0) {
  const m = g.m, h = m.home, feet = [];
  if (m.gate && x0 + PLOT_LEN + 4 > m.gate.x && x0 < m.gate.x + 5) return null;
  for (let x = x0; x < x0 + PLOT_LEN; x++) {
    if (x < 3 || x >= W - 3) return null;
    let f = groundAt(g, x, h.y);
    if (f === null) f = groundAt(g, x, g.w.surf[x] - 1);
    if (f === null || villageOver(g, x, x) || !FARM_SOIL.has(get(g, x, f + 1)) || get(g, x, f) === T.WATER || (g.protect && g.protect.has((f + 1) * W + x))) return null;
    feet.push(f);
  }
  const mid = feet.slice().sort((a, b) => a - b)[2], cost = feet.reduce((n, f) => n + Math.abs(f - mid), 0);
  if (feet.some(f => Math.abs(f - mid) > 2)) return null;
  const level = [], y = mid + 1; // y is the row of the soil itself
  feet.forEach((f, i) => {
    for (let yy = f + 1; yy < y; yy++) level.push({x: x0 + i, y: yy, tile: T.AIR});
    for (let yy = f; yy >= y; yy--) level.push({x: x0 + i, y: yy, tile: T.DIRT});
  });
  return {x0, y, cost, level};
}
// clear of the hut, the workshop and the yard, as flat as can be found, and side by side if there's room
function farmSite(g) {
  const h = g.m.home, spots = [];
  for (let d = 16; d <= 64; d++) for (const x0 of [h.x + d, h.x - d - 3]) { const p = plotAt(g, x0); if (p) spots.push(p); }
  if (!spots.length) return null;
  const score = p => p.cost * 3 + Math.abs(p.x0 - h.x) * 0.05;
  const a = spots.sort((p, q) => score(p) - score(q))[0], rest = spots.filter(p => Math.abs(p.x0 - a.x0) >= PLOT_LEN);
  const b = rest.sort((p, q) => score(p) + Math.abs(p.x0 - a.x0) * 0.2 - score(q) - Math.abs(q.x0 - a.x0) * 0.2)[0];
  a.kind = 'wheat';
  if (!b) return {plots: [a]};
  b.kind = 'potato';
  return {plots: [a, b]};
}
function farmCellJob(g, label, x, y, fn) {
  const m = g.m;
  return {
    name: 'farm', label, to: {x, y},
    run(g) {
      if (bodyHas(m, x, y) || bodyHas(m, x, y + 1)) { // never work the block the miner is standing in, or the ground under this cell from a hole beneath it
        const off = findPath(g, {goal: (a, b) => !(a === x && b >= y && b <= y + 2), h: () => 0, maxNodes: 400});
        if (!off || !off.length) { m.farmNext = g.tick + 1500; return 'fail'; }
        m.path = off;
        return 'run';
      }
      if (Math.abs(m.x - x) <= 2 && Math.abs(m.y - y) <= 2) {
        m.facing = Math.sign(x - m.x) || m.facing;
        m.act = {type: 'place', t: 0, fn};
        return 'done';
      }
      const path = travel(g, x, y, 1);
      if (!path) { m.farmNext = g.tick + 1500; return 'fail'; }
      m.path = path;
      return 'run';
    }
  };
}
function plantCrop(g, plot, x) {
  const m = g.m, k = (plot.y - 1) * W + x;
  if (cnt(m, CROP_SEED[plot.kind]) < 1) return;
  take(m, CROP_SEED[plot.kind], 1);
  setTile(g, x, plot.y - 1, CROP_TILE[plot.kind]);
  g.w.crops = g.w.crops || {};
  g.w.crops[k] = {kind: plot.kind, at: g.time};
  g.noTorch = g.noTorch || new Set(); g.noTorch.add(k);
  wear(g, equipped(m, 'hoe'), 1);
  m.farmDone = true;
  milestone(g, 'farm', 'Planted the first crops');
}
function harvestCrop(g, plot, x) {
  const m = g.m, k = (plot.y - 1) * W + x, c = g.w.crops[k];
  if (plot.kind === 'wheat') { add(g, 'wheat', 1 + Math.floor(g.rng() * 2)); add(g, 'wheat_seeds', 1 + Math.floor(g.rng() * 2)); }
  else add(g, 'potato', 2 + Math.floor(g.rng() * 2));
  take(m, CROP_SEED[plot.kind], 1); // goes straight back in the ground
  c.at = g.time;
  g.stats.harvested = (g.stats.harvested || 0) + 1;
  g.fx.push({type: 'crumble', x, y: plot.y - 1, t: T.DIRT, life: 12});
  milestone(g, 'harvest', 'Brought in the first harvest');
}
const emptyCells = (g, plot) => { let n = 0; for (let x = plot.x0; x < plot.x0 + PLOT_LEN; x++) if (get(g, x, plot.y - 1) !== CROP_TILE[plot.kind]) n++; return n; };
// the next thing that needs doing out there, if any
function farmWork(g, chain) {
  const m = g.m;
  if (g.tick < (m.farmNext || 0)) return null;
  if (!equipped(m, 'hoe')) { const j = need(g, 'stone_hoe', 1, chain); if (j) return j; }
  const plots = m.farm.plots;
  for (let i = 0; i < plots.length; i++) {
    const plot = plots[i], id = 'farmbed' + i;
    if (plot.kind === 'potato' && cnt(m, 'potato') === 0 && emptyCells(g, plot) === PLOT_LEN) { // nothing to plant yet: go and find one
      const j = wildPotatoJob(g);
      if (j) return j;
      continue;
    }
    { const j = buildJob(g, id, 'Farm plot', chain, plot.level, 'Levelled ground for the farm'); if (j) return j; }
    if (!m.built[id]) continue;
    for (let x = plot.x0; x < plot.x0 + PLOT_LEN; x++) {
      const k = (plot.y - 1) * W + x;
      if (get(g, x, plot.y - 1) === CROP_TILE[plot.kind]) {
        if (cropStage(g, k) >= 3) return farmCellJob(g, plot.kind === 'wheat' ? 'Bringing in the wheat' : 'Digging up potatoes', x, plot.y - 1, () => { if (get(g, x, plot.y - 1) === CROP_TILE[plot.kind]) harvestCrop(g, plot, x); });
      } else if (cnt(m, CROP_SEED[plot.kind]) > 0) {
        if (plot.kind === 'wheat' && cnt(m, 'wheat_seeds') < emptyCells(g, plot) && g.tick >= (m.seedNext || 0)) break; // cut enough grass first
        if (get(g, x, plot.y) !== T.FARMLAND) return farmCellJob(g, 'Hoeing the ' + plot.kind + ' plot', x, plot.y - 1, () => { setTile(g, x, plot.y, T.FARMLAND); wear(g, equipped(m, 'hoe'), 1); });
        return farmCellJob(g, plot.kind === 'wheat' ? 'Planting wheat' : 'Planting potatoes', x, plot.y - 1, () => plantCrop(g, plot, x));
      }
    }
    if (plot.kind === 'wheat' && emptyCells(g, plot) > cnt(m, 'wheat_seeds') && g.tick >= (m.seedNext || 0)) return seedJob(g, emptyCells(g, plot));
  }
  return null;
}
// seeds fall out of long grass one time in eight. If there isn't enough about, it can wait a couple of days
function seedJob(g, n) {
  const m = g.m, start = g.stats.mined[T.TGRASS] || 0;
  const wait = () => { m.seedNext = g.tick + DAY * 2; if (!m.farmDone && cnt(m, 'wheat_seeds') === 0) m.farmDone = true; };
  const job = collectJob(g, 'wheat_seeds', n, [T.TGRASS], 'Cutting grass for seeds', {
    find: g => scanTiles(g, [T.TGRASS], 45, 14),
    fallback: () => { wait(); return 'fail'; }
  });
  const go = job.run;
  job.run = g => { if ((g.stats.mined[T.TGRASS] || 0) - start > 70) { wait(); return 'done'; } return go(g); };
  return job;
}
// a few patches grow wild near home, whatever age the world is: they only go in once there's a farm to want them
function seedWildPotatoes(g) {
  const m = g.m;
  if (m.wildPotatoes || inUnder(g)) return;
  m.wildPotatoes = true;
  let placed = 0;
  for (const s of [1, -1]) for (let d = 24, left = 3; d < 300 && left > 0; d += 3) {
    const x = m.home.x + d * s;
    if (x < 3 || x >= W - 3 || !lushBiome(g.w.biome[x]) || (skyHash(g.seed, x) >>> 5) % 4) continue;
    const y = groundAt(g, x, g.w.surf[x] - 1);
    if (y === null || get(g, x, y + 1) !== T.GRASS || (get(g, x, y) !== T.AIR && !DECOR.has(get(g, x, y)))) continue;
    setTile(g, x, y, T.WILD_POTATO); placed++; left--; d += 12;
  }
  logEvent(g, placed ? 'Spotted wild potato plants not far from home' : 'No wild potatoes around here');
}
function wildPotatoJob(g) {
  const m = g.m;
  if (g.tick < (m.potatoNext || 0)) return null;
  seedWildPotatoes(g);
  const wait = () => { m.potatoNext = g.tick + DAY; };
  return collectJob(g, 'potato', 3, [T.WILD_POTATO], 'Digging up wild potatoes', {
    find: g => { const out = []; for (let x = Math.max(1, m.x - 150); x < Math.min(W - 1, m.x + 150); x++) for (let y = g.w.surf[x] - 8; y < g.w.surf[x] + 3; y++) if (y > 0 && get(g, x, y) === T.WILD_POTATO) out.push({x, y, d: Math.abs(x - m.x)}); return out.sort((a, b) => a.d - b.d).slice(0, 8); },
    fallback: () => { wait(); return 'fail'; }
  });
}
function farmGoal(g, chain) {
  const m = g.m;
  if (!m.farm) {
    if (!equipped(m, 'hoe')) { const j = need(g, 'stone_hoe', 1, chain); if (j) return j; }
    m.farm = farmSite(g);
    if (!m.farm) { m.farmDone = true; logEvent(g, 'Nowhere near home flat enough for a farm'); return null; }
  }
  return farmWork(g, chain);
}
// the farm's within reach and it's a fit time to work it
function farmOpen(g) {
  const m = g.m;
  if (!m.farm || inUnder(g) || isNight(g)) return false;
  const wx = weatherNow(g), p = m.farm.plots[0];
  return !(wx.type === 'storm' && wx.level >= 0.2) && Math.abs(p.x0 - m.x) + Math.abs(p.y - m.y) <= 150;
}
function ripeCrops(g) {
  let n = 0;
  for (const plot of g.m.farm.plots) for (let x = plot.x0; x < plot.x0 + PLOT_LEN; x++) if (get(g, x, plot.y - 1) === CROP_TILE[plot.kind] && cropStage(g, (plot.y - 1) * W + x) >= 3) n++;
  return n;
}
function farmUpkeep(g) {
  const m = g.m;
  if (!farmOpen(g)) return null;
  const chain = ['Tend the farm'], j = farmWork(g, chain);
  if (j) m.chain = chain;
  return j;
}
// what's come in gets cooked when a furnace or bench is handy, not just when it's hungry
function kitchenJob(g) {
  const m = g.m;
  if (inUnder(g) || g.tick < (m.cookNext || 0)) return null;
  if (farmOpen(g) && g.tick >= (m.farmNext || 0) && ripeCrops(g)) return null; // bring it all in first, then cook the lot
  const chain = ['Cook what came in'], fire = stationNear(g, 'furnace', 30) && cnt(m, 'coal') > 0, plot = m.farm && m.farm.plots[1];
  let j = null;
  if (fire && cnt(m, 'raw_fish') > 0) j = need(g, 'cooked_fish', cnt(m, 'cooked_fish') + cnt(m, 'raw_fish'), chain);
  else if (fire && cnt(m, 'raw_meat') > 0) j = need(g, 'cooked_meat', cnt(m, 'cooked_meat') + cnt(m, 'raw_meat'), chain);
  else if (cnt(m, 'wheat') >= RECIPES.bread.in.wheat && stationNear(g, 'bench', 30)) j = need(g, 'bread', cnt(m, 'bread') + Math.floor(cnt(m, 'wheat') / RECIPES.bread.in.wheat), chain);
  else if (fire) {
    const spare = Math.min(cnt(m, 'coal'), cnt(m, 'potato') - (plot ? emptyCells(g, plot) : 0));
    if (spare > 0) j = need(g, 'baked_potato', cnt(m, 'baked_potato') + spare, chain);
  }
  if (j) { m.chain = chain; m.cookNext = g.tick + 20; }
  return j;
}
