// Burrow sim · comforts.js — Home comforts: a weathervane, a trophy shelf, a map table, a rain barrel, wind chimes, a bed for the pet, and a kite.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// Once a camp's keep is up (or, before the journey, once the homestead is finished) the miner makes them and puts them about
// the place with buildJob. They stay behind when it moves on: every keep keeps its weathervane. The wind (windNow) comes from
// the clock and the weather, like the weather itself, so nothing about it is saved.
'use strict';

const COMFORT_TILES = [T.WEATHERVANE, T.TROPHY_SHELF, T.MAP_TABLE, T.RAIN_BARREL, T.WIND_CHIMES, T.PET_BED];
const COMFORT_SET = new Set(COMFORT_TILES);
const KITE_TIME = 18 * TPS, BARREL_REACH = 6, BARREL_BOOST = 1.25;

// ---------- the wind ----------
// 0 still .. 1 a gale, and which way it blows. Rain brings a breeze, a storm a gale
function windNow(g) {
  const wx = weatherNow(g), t = g.time / (DAY / 6), seed = (g.seed | 0) % 100000;
  let s = 0.08 + vn1(t, seed + 77) * 0.5;
  if (wx.type === 'rain') s = Math.max(s, 0.45 + 0.2 * wx.level);
  if (wx.type === 'storm') s = Math.max(s, 0.65 + 0.35 * wx.level);
  return {s: Math.min(1, s), dir: vn1(t * 0.3, seed + 91) < 0.5 ? -1 : 1};
}
// how full a rain barrel is: the share of the last half day it rained, read back off the weather clock
function barrelFill(g) {
  let wet = 0;
  for (let i = 0; i < 12; i++) { const w = weatherNow({seed: g.seed, time: g.time - i * DAY / 24}); if (w.type !== 'clear') wet++; }
  return Math.min(1, 0.15 + wet / 8);
}
// a barrel beside the farm waters it: crops near one grow a quarter faster
function barrelNear(g, x, y) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -BARREL_REACH; dx <= BARREL_REACH; dx++) if (get(g, x + dx, y + dy) === T.RAIN_BARREL) return true;
  return false;
}
// what the home is: the keep at a camp, or the homestead
function comfortHome(g) {
  const m = g.m, j = m.journey;
  if (inUnder(g) || g.palTurn) return null;
  if (j) {
    if (j.stage === 'travel' || j.stage === 'pack' || j.keepDone !== j.camps || !m.hut) return null;
    if (j.keepHome === j.camps && j.keep) return {id: 'camp' + j.camps, x0: j.keep.x0, x1: j.keep.x1, F: j.keep.F};
    return {id: 'camp' + j.camps, x0: m.home.x - 4, x1: m.home.x + 4, F: m.home.y};
  }
  if (!m.built || !m.built.storage || !m.hut) return null;
  return {id: 'home', x0: m.home.x - 7, x1: m.home.x + 7, F: m.home.y};
}

// ---------- where things go ----------
const roofed = (g, x, y) => { for (let d = 1; d <= 8; d++) if (isSolid(get(g, x, y - d))) return true; return false; };
const freeCell = (g, x, y) => get(g, x, y) === T.AIR && isSolid(get(g, x, y + 1)) && !(g.w.crops && g.w.crops[y * W + x]);
function comfortPlan(g, h) {
  const m = g.m, cells = [], used = new Set(), have = t => { for (let x = h.x0 - 8; x <= h.x1 + 8; x++) for (let y = h.F - 14; y <= h.F + 2; y++) if (get(g, x, y) === t) return true; return false; };
  const put = (x, y, tile, reach) => { used.add(x); cells.push({x, y, tile, reach}); };
  // inside, on the floor, spread out: the shelf, the map table and the pet's bed
  const inside = [];
  for (let x = h.x0 + 1; x <= h.x1 - 1; x++) for (let y = h.F; y >= h.F - 6; y--) if (freeCell(g, x, y) && roofed(g, x, y) && !(m.bed && m.bed.x === x && m.bed.y === y) && get(g, x - 1, y) !== T.DOOR && get(g, x + 1, y) !== T.DOOR) { inside.push({x, y}); break; }
  const room = tile => { const c = inside.find(c => ![...used].some(u => Math.abs(u - c.x) < 2)); if (c) put(c.x, c.y, tile); };
  if (!have(T.TROPHY_SHELF)) room(T.TROPHY_SHELF);
  if (m.journey && !have(T.MAP_TABLE)) room(T.MAP_TABLE);
  if (m.pet && !have(T.PET_BED)) room(T.PET_BED);
  // up on the roof, in the middle, under the open sky
  if (!have(T.WEATHERVANE)) {
    const mid = (h.x0 + h.x1) >> 1;
    for (const x of [mid, mid + 1, mid - 1]) {
      let y = h.F - 24; while (y < h.F && !isSolid(get(g, x, y))) y++;
      if (y < h.F && y - 1 > 3 && y < g.w.top[x] + 1 && get(g, x, y - 1) === T.AIR) { put(x, y - 1, T.WEATHERVANE, 13); break; }
    }
  }
  // on an outside wall, above head height, where the wind gets at them
  if (!have(T.WIND_CHIMES)) for (const [x, wall] of [[h.x1 + 1, h.x1], [h.x0 - 1, h.x0]]) {
    const y = h.F - 2;
    if (get(g, x, y) === T.AIR && get(g, x, y + 1) === T.AIR && isSolid(get(g, wall, y))) { put(x, y, T.WIND_CHIMES); break; }
  }
  // out under the sky: by the farm if there is one, or just outside
  if (!have(T.RAIN_BARREL)) {
    const near = [];
    if (m.farm) for (const p of m.farm.plots) near.push(p.x0 - 1, p.x0 + PLOT_LEN, p.x0 - 2, p.x0 + PLOT_LEN + 1);
    for (let d = 2; d <= 8; d++) near.push(h.x1 + d, h.x0 - d);
    for (const x of near) {
      const y = groundAt(g, x, h.F);
      if (y !== null && Math.abs(y - h.F) <= 4 && freeCell(g, x, y) && y < g.w.top[x] + 1 && skyAt(g, x, y - 1)) { put(x, y, T.RAIN_BARREL); break; }
    }
  }
  return cells;
}
// a piece it can't make here (no leaves about for the pet's bed, say) is left out rather than holding up the rest
function comfortJob(g) {
  const m = g.m, h = comfortHome(g);
  if (!h) return null;
  m.built = m.built || {};
  if (!m.comfort || m.comfort.id !== h.id) { m.comfort = {id: h.id, cells: comfortPlan(g, h)}; m.built.comfort = false; }
  if (m.built.comfort) return null;
  const chain = ['Make the place homely'];
  if (!m.comfort.checked) { m.comfort.checked = true; m.comfort.cells = m.comfort.cells.filter(c => get(g, c.x, c.y) === c.tile || cnt(m, TILE_ITEM[c.tile]) > 0 || !!need(g, TILE_ITEM[c.tile], 1, [])); }
  return buildJob(g, 'comfort', 'Home comforts', chain, m.comfort.cells, 'Made the place feel like home', null, true);
}

// ---------- every so often ----------
// chimes ring when the wind gets up and the miner is near enough to hear them
function comfortStep(g) {
  const m = g.m;
  if (g.tick % 30 || inUnder(g) || m.dead) return;
  const w = windNow(g);
  if (w.s < 0.3) return;
  for (let x = m.x - 18; x <= m.x + 18; x++) for (let y = m.y - 8; y <= m.y + 6; y++) if (get(g, x, y) === T.WIND_CHIMES && g.rng() < w.s * 0.8) { sfx(g, 'chime', x, y, w.s); return; }
}

// ---------- the map table ----------
// before breaking camp, a long look at the map
function mapTableJob(g) {
  const m = g.m, j = m.journey;
  if (!j || j.mapped === j.camps) return null;
  let at = null;
  for (let x = m.home.x - 14; x <= m.home.x + 14 && !at; x++) for (let y = m.home.y - 8; y <= m.home.y + 2; y++) if (get(g, x, y) === T.MAP_TABLE) { at = {x, y}; break; }
  if (!at) return null;
  if (Math.abs(m.x - at.x) > 1 || Math.abs(m.y - at.y) > 1) {
    const go = gotoJob(g, 'Going to look at the map', at.x, at.y, 1);
    if (go) return go;
    j.mapped = j.camps; return null;
  }
  return {name: 'map', label: 'Studying the map before moving on', run(g) {
    m.facing = Math.sign(at.x - m.x) || m.facing;
    m.act = {type: 'wait', t: 0, dur: 4 * TPS, map: at};
    j.mapped = j.camps; g.stats.mapLooks = (g.stats.mapLooks || 0) + 1;
    return 'done';
  }};
}

// ---------- the kite ----------
// a clear, breezy afternoon at home, every other day or so: out under the sky with the kite for a while
function kiteJob(g) {
  const m = g.m;
  if (!comfortHome(g) || !(m.built || {}).comfort || m.kiteDay === g.day || isNight(g) || m.hunger < 12) return null;
  const f = dayFrac(g), w = windNow(g), wx = weatherNow(g);
  if (f < 0.32 || f > 0.62 || wx.type !== 'clear' || w.s < 0.18 || w.s > 0.7 || skyHash(g.seed, g.day * 7 + 3) % 2) return null;
  if (!cnt(m, 'kite')) { const chain = ['Make a kite'], j = need(g, 'kite', 1, chain); if (j) { m.chain = chain; return j; } m.kiteDay = g.day; return null; }
  if (!skyAt(g, m.x, m.y - 1) || !skyAt(g, m.x + m.facing, m.y - 3)) {
    for (let d = 2; d <= 16; d++) for (const s of [1, -1]) {
      const x = m.home.x + d * s, y = groundAt(g, x, m.home.y);
      if (y === null || Math.abs(y - m.home.y) > 4 || !skyAt(g, x, y - 1) || !skyAt(g, x + s, y - 4)) continue;
      const go = gotoJob(g, 'Taking the kite out', x, y, 0);
      if (go) { m.chain = ['Fly the kite']; return go; }
    }
    m.kiteDay = g.day; return null;
  }
  return {name: 'kite', label: 'Flying the kite', run(g) {
    m.kiteDay = g.day; m.facing = w.dir;
    m.act = {type: 'kite', t: 0, dur: KITE_TIME};
    g.stats.kites = (g.stats.kites || 0) + 1;
    milestone(g, 'first_kite', 'Flew a kite on a breezy afternoon');
    return 'done';
  }};
}
