// Burrow sim · design.js — The miner designs each keep itself: a kit of shapes, and rules that weigh the ground, the pack, the biome, how the last few days went and its own tastes.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// Choices come from a hash of the seed and the camp, never g.rng. The miner stays on the ground floor, so every shape has doors at both ends it can walk straight through, and the storeys above are built by reaching up (c.reach).
'use strict';

// need: stone it won't start without. towers: columns that go up a storey
const KEEP_KIT = {
  cottage: {name: 'cottage', wide: 9, high: 7, need: 60, pitch: true},
  hall: {name: 'stone hall', wide: 15, high: 5, need: 110, crenel: true},
  great: {name: 'great hall', wide: 21, high: 5, need: 150, crenel: true},
  tower: {name: 'tower keep', wide: 15, high: 9, need: 170, crenel: true, towers: [[0, 6]]},
  castle: {name: 'little castle', wide: 23, high: 9, need: 280, crenel: true, towers: [[0, 6], [16, 22]]},
  manor: {name: 'manor', wide: 13, high: 11, need: 180, pitch: true, towers: [[0, 12]]},
  burrow: {name: 'hillside burrow', wide: 11, high: 4, need: 16, hill: true}
};
const KEEP_TASTES = ['tower', 'cottage', 'hall', 'manor', 'burrow', 'great'];
const KEEP_FAR = 9, KEEP_BURROW_RISE = 4;

function keepThoughts(why, kit, d) {
  return why + ' Going for a ' + kit.name + (d.porch ? ' with a porch' : '') + '.';
}
// what's on its mind as it looks the place over, and the shapes it fancies, best first
function keepIdeas(g, have) {
  const m = g.m, j = m.journey, s = g.stats, biome = g.w.biome[m.home.x], last = j.keepLast || [];
  j.taste = j.taste || KEEP_TASTES[skyHash(g.seed, 77) % KEEP_TASTES.length];
  const flattened = (s.deaths || 0) > (j.keepKO || 0), rough = flattened || (s.kills || 0) - (j.keepKills || 0) >= 45, wet = (s.wetDays || 0) > (j.keepWet || 0);
  const ideas = [];
  Object.keys(KEEP_KIT).forEach((name, i) => {
    const kit = KEEP_KIT[name];
    if (j.keepForce && j.keepForce !== name) return;
    if (kit.need > have) return;
    let score = skyHash(g.seed, j.camps * 11 + i) % 100 / 100, why = 'Nice spot.';
    const lean = (n, text) => { score += n; if (n > 0 && text) why = text; };
    if (name === j.taste) lean(1.2, 'I do like a good ' + kit.name + '.');
    if (have > 800 && kit.need >= 150) lean(1, 'The pack is groaning with stone.');
    if (have < 220 && kit.need < 110) lean(1.6, 'Not much stone left.');
    if (rough && kit.crenel) lean(1.1, flattened ? 'Got flattened since the last camp.' : 'Monsters everywhere lately.');
    if (wet && kit.pitch) lean(1, 'I’ve had enough of the rain.');
    if (kit.hill) lean(1.4, 'There’s a good hill right here.');
    lean(last[0] === name ? -2.5 : last[1] === name ? -1.2 : 0);
    ideas.push({name, kit, score, why, rough, wet});
  });
  return ideas.sort((a, b) => b.score - a.score);
}
// a hill to dig into: the front on the low side, solid rock over the whole room behind it
function burrowSite(g, kit) {
  const m = g.m, h = m.home;
  for (let gap = 0; gap <= 30; gap++) for (const side of gap ? [-1, 1] : [1]) for (const dir of [1, -1]) {
    const x0 = h.x + gap * side, F = groundAt(g, x0, h.y);
    if (F === null || Math.abs(F - h.y) > 5) continue;
    const s = {flip: dir < 0, x: dir > 0 ? x0 : x0 - kit.wide + 1, wide: kit.wide, high: 4, floor: F, hill: true};
    if (s.x < 3 || s.x + s.wide >= W - 3 || villageOver(g, s.x, s.x + s.wide)) continue;
    let ok = true;
    for (let c = 0; c < kit.wide && ok; c++) {
      const x = keepX(s, c);
      if (c >= 2 && g.w.top[x] > F - KEEP_BURROW_RISE) ok = false; // the hill has to rise over it
      if (m.gate && Math.abs(m.gate.x - x) < 5) ok = false;
      if (m.farm && m.farm.plots.some(p => x >= p.x0 - 1 && x <= p.x0 + PLOT_LEN)) ok = false;
      for (let y = F - 4; y <= F + 1 && ok; y++) {
        const t = get(g, x, y);
        if (t === T.WATER || t === T.LAVA || t === T.SAND || t === T.OBSIDIAN || inGateFrame(g, x, y) || (g.protect && g.protect.has(y * W + x))) ok = false;
        if (c >= 2 && y >= F - 3 && !(t === T.AIR || DECOR.has(t) || IN_THE_WAY(t))) ok = false;
      }
    }
    if (ok) return s;
  }
  return null;
}
function burrowCells(g, s, kit, stone, budget) {
  const F = s.floor, last = kit.wide - 1, roof = F - 3, cells = [], rock = BUILD_TILE[stone.wall];
  const spend = k => { if (!(budget[k] > 0)) return false; budget[k]--; return true; };
  const put = (c, y, tile) => cells.push({x: keepX(s, c), y, tile});
  for (let y = F; y > roof; y--) for (let c = 1; c < last; c++) put(c, y, T.AIR);
  for (let c = 0; c <= last; c++) {
    if (!isSolid(get(g, keepX(s, c), F + 1))) put(c, F + 1, rock);
    if (!isSolid(get(g, keepX(s, c), roof))) put(c, roof, rock);
    if (c === last) for (let y = F; y > roof; y--) if (!isSolid(get(g, keepX(s, c), y))) put(c, y, rock);
  }
  const door = budget.door >= 2 && spend('door') && spend('door');
  for (let y = F; y > roof; y--) put(0, y, y >= F - 1 ? (door ? T.DOOR : T.AIR) : spend('glass_pane') ? T.GLASS_PANE : rock);
  const lamp = c => { const k = ['lantern', 'copper_lantern'].find(spend) || (budget.torch > 6 && spend('torch') ? 'torch' : null); if (k) put(c, F - 2, BUILD_TILE[k]); };
  lamp(3); lamp(7);
  if (spend('chest')) put(last - 1, F, T.STORE_CHEST);
  if (spend('wood_stairs')) put(1, F, BUILD_TILE.wood_stairs);
  return cells;
}
function shapeCells(g, s, kit, d, stone, budget) {
  const F = s.floor, last = kit.wide - 1, roof = F - 3, top = roof - 3, cells = [], tall = kit.towers || [];
  const up = c => tall.some(t => c >= t[0] && c <= t[1]);
  const spend = k => { if (!(budget[k] > 0)) return false; budget[k]--; return true; };
  const wall = BUILD_TILE[stone.wall], block = k => BUILD_TILE[spend(k) ? k : stone.wall], trim = () => block(stone.trim);
  const put = (c, y, tile) => { const q = {x: keepX(s, c), y, tile}; if (y < F - 4) q.reach = KEEP_FAR; cells.push(q); };
  const lamp = (c, y) => { const k = ['lantern', 'copper_lantern'].find(spend) || (budget.torch > 6 && spend('torch') ? 'torch' : null); if (k) put(c, y, BUILD_TILE[k]); };
  for (let c = 0; c <= last; c++) { const x = keepX(s, c); for (let y = F + 1; y <= F + 4 && !isSolid(get(g, x, y)); y++) cells.push({x, y, tile: wall}); }
  for (let y = F; y > roof; y--) for (let c = 1; c < last; c++) put(c, y, T.AIR);
  for (const [a, b] of tall) for (let y = roof - 1; y > top; y--) for (let c = a + 1; c < b; c++) put(c, y, T.AIR);
  const doors = budget.door >= 2 && spend('door') && spend('door'), backDoor = budget.door >= 2 && spend('door') && spend('door');
  for (let y = F; y > roof; y--) {
    const low = y >= F - 1, pane = () => (spend('glass_pane') ? T.GLASS_PANE : wall);
    put(0, y, !backDoor ? wall : low ? T.DOOR : pane());
    put(last, y, low ? (doors ? T.DOOR : T.AIR) : pane());
  }
  for (let c = 0; c <= last; c++) put(c, roof, up(c) ? block('planks') : trim());
  for (const [a, b] of tall) {
    for (const c of [a, b]) for (let y = roof - 1; y > top; y--) put(c, y, y === roof - 2 && spend('glass_pane') ? T.GLASS_PANE : wall);
    for (let c = a; c <= b; c++) put(c, top, trim());
    lamp((a + b) >> 1, roof - 2);
    if (kit.crenel) for (let c = a; c <= b; c += 2) put(c, top - 1, wall);
  }
  if (d.deep) for (let c = 0; c <= last; c++) if (!up(c)) put(c, roof - 1, trim());
  if (kit.crenel) for (let c = 0; c <= last; c += 2) if (!up(c)) put(c, roof - (d.deep ? 2 : 1), wall);
  if (kit.pitch) { // a shallow pitch: two across for every one up
    const base = tall.length ? top : roof;
    for (let n = 1; last - (n * 2 - 2) * 2 >= 1; n++) for (let c = n * 2 - 2; c <= last - n * 2 + 2; c++) put(c, base - n, trim());
  }
  for (let c = 3; c < last; c += 4) lamp(c, F - 2);
  const small = kit.wide < 12;
  if (spend('chest')) put(small ? 1 : 2, F, T.STORE_CHEST);
  if (spend('wood_stairs')) put(small ? last - 2 : 3, F, BUILD_TILE.wood_stairs);
  if (spend('wood_slab')) { put(small ? last - 1 : 4, F, BUILD_TILE.wood_slab); lamp(small ? last - 1 : 4, F - 1); }
  const free = [last - 1, last - 2];
  if (!small) for (const k of KEEP_FURNISH) { if (!free.length) break; if (k !== 'wood_stairs' && k !== 'wood_slab' && spend(k)) put(free.shift(), F, BUILD_TILE[k]); }
  if (d.porch) {
    for (let c = last + 1; c <= last + 3; c++) put(c, roof, trim());
    for (let y = F; y > roof; y--) if (spend('fence')) put(last + 3, y, T.FENCE);
  }
  const yard = keepX(s, s.wide + 1), gy = groundAt(g, yard, F);
  if (gy !== null) { const k = ['campfire', 'sign', 'fence'].find(spend); if (k) cells.push({x: yard, y: gy, tile: BUILD_TILE[k]}); }
  return cells;
}
// ground first, then upward, so nothing is ever hung in mid-air. Clearing comes before any of it
function keepOrder(cells) {
  const low = (a, b) => (a.tile === T.AIR ? 0 : 1) - (b.tile === T.AIR ? 0 : 1) || b.y - a.y;
  return cells.map((c, i) => [c, i]).sort((p, q) => low(p[0], q[0]) || p[1] - q[1]).map(p => p[0]);
}
function keepPlan(g) {
  const m = g.m, j = m.journey, s0 = g.stats, stone = keepStone(g), inv = Object.assign({}, m.inv), have = Math.max(0, cnt(m, stone.wall) - KEEP_RESERVE);
  inv[stone.wall] = have;
  if (stone.trim !== stone.wall) inv[stone.trim] = Math.floor(cnt(m, stone.trim) / 2);
  const biome = g.w.biome[m.home.x], wallArt = stone.wall === 'sandstone' ? 'sand' : 'bricks';
  for (const idea of keepIdeas(g, have)) {
    const kit = idea.kit, d = {deep: idea.wet && !kit.pitch, porch: !kit.hill && (biome === B_MEADOW || biome === B_SAVANNA || skyHash(g.seed, j.camps + 300) % 3 === 0)};
    const s = kit.hill ? burrowSite(g, kit) : keepSite(g, {wide: kit.wide + (d.porch ? 3 : 0), high: kit.high + (d.deep ? 1 : 0), flip: skyHash(g.seed, j.camps + 500) % 2 === 1});
    if (!s) continue;
    const budget = Object.assign({}, inv), cells = keepOrder(keepTidy(kit.hill ? burrowCells(g, s, kit, stone, budget) : shapeCells(g, s, kit, d, stone, budget)));
    let used = 0; for (const c of cells) if (c.tile === BUILD_TILE[stone.wall]) used++;
    if (used > inv[stone.wall]) continue;
    const X = c => keepX(s, c), span = (a, b) => ({x0: Math.min(X(a), X(b)), x1: Math.max(X(a), X(b))}), F = s.floor, last = kit.wide - 1, chest = cells.find(c => c.tile === T.STORE_CHEST);
    const rooms = [Object.assign(span(0, last), {y0: F - 3, y1: F + 1, wall: kit.hill ? 'stone' : wallArt})];
    for (const [a, b] of kit.towers || []) rooms.push(Object.assign(span(a, b), {y0: F - 6, y1: F - 3, wall: 'planks'}));
    j.keepLast = [idea.name].concat(j.keepLast || []).slice(0, 2);
    j.keepKO = s0.deaths || 0; j.keepKills = s0.kills || 0; j.keepWet = s0.wetDays || 0;
    const low = kit.pitch || kit.hill ? [] : (kit.towers ? (kit.towers.length > 1 ? [[6, 16]] : [[6, last]]) : [[0, last]]).map(q => [Math.min(X(q[0]), X(q[1])), Math.max(X(q[0]), X(q[1]))]);
    const keep = {x0: span(0, last).x0, x1: span(0, last).x1, F, wall: stone.wall, trim: stone.trim === stone.wall || BUILD_TILE[stone.trim] ? stone.trim : stone.wall, hill: !!kit.hill, dir: s.flip ? -1 : 1, low};
    return {keep, cells, chest: chest ? {x: chest.x, y: chest.y} : null, site: s, home: {x: X(kit.hill ? 5 : kit.wide >> 1), y: F}, rooms, name: kit.name, why: keepThoughts(idea.why, kit, d)};
  }
  return null;
}

// ---------- adding on ----------
// a keep isn't finished just because it's finished. Every couple of days at camp, with stone to spare, the miner adds to it, and far more if it's been told to stay
const GROW_EVERY = 2, GROW_CAMP = 2, GROW_STAY = 10, GROW_WING = 6, GROW_TOWER = 7, GROW_DIG = 4, GROW_MOST_WORK = 180, GROW_GRIT = 8;
const growLamp = (cells, budget, x, y) => { const k = ['lantern', 'copper_lantern'].find(q => budget[q] > 0 && budget[q]--) || (budget.torch > 6 && budget.torch-- ? 'torch' : null); if (k) cells.push({x, y, tile: BUILD_TILE[k]}); };
const growCell = (cells, F, x, y, tile) => { const q = {x, y, tile}; if (y < F - 4) q.reach = KEEP_FAR; cells.push(q); };
// room for a wing here? It can cut into a slope, or span a small dip. A porch or a fence in the way just ends up indoors
function growFits(g, x0, wide, F) {
  const m = g.m;
  if (x0 < 3 || x0 + wide >= W - 3 || villageOver(g, x0, x0 + wide)) return false;
  if (m.farm && m.farm.plots.some(p => p.x0 + PLOT_LEN > x0 - 1 && p.x0 <= x0 + wide)) return false;
  if (m.gate && m.gate.x + 5 > x0 && m.gate.x - 5 < x0 + wide) return false;
  for (let x = x0; x < x0 + wide; x++) {
    let under = false;
    for (let y = F + 1; y <= F + 2; y++) if (isSolid(get(g, x, y))) under = true; // any deeper and the far end can't be reached from the floor: it would hang in mid-air
    if (!under) return false;
    for (let y = F + 1; y >= F - 5; y--) {
      const t = get(g, x, y);
      if (t === T.WATER || t === T.LAVA || t === T.OBSIDIAN || inGateFrame(g, x, y) || (y <= F && g.protect && g.protect.has(y * W + x))) return false;
      if (!(t === T.AIR || t === T.FENCE || DECOR.has(t) || IN_THE_WAY(t))) return false;
    }
  }
  return true;
}
// a new room off one end, past the old door, which stays where it was
function wingCells(g, k, budget) {
  const F = k.F, roof = F - 3, wall = BUILD_TILE[k.wall], trim = BUILD_TILE[k.trim];
  for (const side of skyHash(g.seed, g.day) % 2 ? [1, -1] : [-1, 1]) {
    const x0 = side > 0 ? k.x1 + 1 : k.x0 - GROW_WING;
    if (!growFits(g, x0, GROW_WING, F)) continue;
    const cells = [], end = side > 0 ? x0 + GROW_WING - 1 : x0;
    for (let x = x0; x < x0 + GROW_WING; x++) {
      for (let y = F + 1; y <= F + 4 && !isSolid(get(g, x, y)); y++) growCell(cells, F, x, y, wall);
      for (let y = F; y > roof; y--) if (x !== end) growCell(cells, F, x, y, T.AIR);
      growCell(cells, F, x, roof, trim);
      if ((x - x0) % 2 === 0) growCell(cells, F, x, roof - 1, wall);
    }
    const door = budget.door >= 2;
    for (let y = F; y > roof; y--) growCell(cells, F, end, y, y >= F - 1 ? (door ? T.DOOR : T.AIR) : budget.glass_pane > 0 && budget.glass_pane-- ? T.GLASS_PANE : wall);
    growLamp(cells, budget, x0 + (GROW_WING >> 1), F - 2);
    return {cells, label: 'wing', why: 'Plenty of stone to spare. Adding a wing.', apply: () => {
      if (side > 0) k.x1 += GROW_WING; else k.x0 -= GROW_WING;
      const a = Math.min(end, side > 0 ? x0 - 1 : x0 + GROW_WING), b = Math.max(end, side > 0 ? x0 - 1 : x0 + GROW_WING);
      k.low.push([a, b]);
      return {x0: a, x1: b, y0: roof, y1: F + 1, wall: 'bricks'};
    }};
  }
  return null;
}
// a storey on top of a flat roof: the battlements come down and go back up higher
function storeyCells(g, k, budget) {
  const F = k.F, roof = F - 3, top = roof - 3, wall = BUILD_TILE[k.wall], trim = BUILD_TILE[k.trim];
  const seg = k.low.find(q => q[1] - q[0] >= 4);
  if (!seg) return null;
  const [a, b] = seg, cells = [];
  for (let x = a; x <= b; x++) for (let y = top - 1; y < roof; y++) { const t = get(g, x, y); if (t !== T.AIR && !DECOR.has(t) && !IN_THE_WAY(t)) return null; }
  for (let x = a + 1; x < b; x++) for (let y = roof - 1; y > top; y--) growCell(cells, F, x, y, T.AIR);
  for (const x of [a, b]) for (let y = roof - 1; y > top; y--) growCell(cells, F, x, y, y === roof - 2 && budget.glass_pane > 0 && budget.glass_pane-- ? T.GLASS_PANE : wall);
  for (let x = a; x <= b; x++) growCell(cells, F, x, top, trim);
  for (let x = a; x <= b; x += 2) growCell(cells, F, x, top - 1, wall);
  growLamp(cells, budget, (a + b) >> 1, roof - 2);
  return {cells, label: 'upper storey', why: 'Getting settled here. Going up a storey.', apply: () => {
    k.low = k.low.filter(q => q !== seg);
    return {x0: a, x1: b, y0: top, y1: roof, wall: 'planks'};
  }};
}
// no room to build on, and nothing left to build up: a watchtower of its own, a little way along, with the keep's doors at each end
function towerCells(g, k, budget) {
  const kit = {wide: GROW_TOWER, high: 9, crenel: true, towers: [[0, GROW_TOWER - 1]]}, taken = [[k.x0, k.x1]].concat(k.out || []);
  for (let gap = 8; gap <= 44; gap += 3) for (const side of [1, -1]) {
    const x = side > 0 ? k.x1 + gap : k.x0 - gap - GROW_TOWER, s = Object.assign({x, flip: false}, kit);
    if (taken.some(q => x <= q[1] + 3 && x + GROW_TOWER >= q[0] - 3) || !keepFits(g, s) || Math.abs(s.floor - k.F) > 8) continue;
    const spare = Object.assign({}, budget, {chest: 0, wood_stairs: 0, wood_slab: 0, campfire: 0, sign: 0, fence: 0});
    for (const it of KEEP_FURNISH) spare[it] = 0;
    const cells = shapeCells(g, s, kit, {}, {wall: k.wall, trim: k.trim}, spare), F = s.floor;
    return {cells, label: 'watchtower', why: 'No more room here. Putting up a watchtower along the way.', apply: () => {
      k.out = (k.out || []).concat([[x, x + GROW_TOWER - 1]]);
      return [{x0: x, x1: x + GROW_TOWER - 1, y0: F - 3, y1: F + 1, wall: 'bricks'}, {x0: x, x1: x + GROW_TOWER - 1, y0: F - 6, y1: F - 3, wall: 'planks'}];
    }};
  }
  return null;
}
// a burrow just goes further into the hill
function deeperCells(g, k, budget) {
  const F = k.F, roof = F - 3, dir = k.dir, x0 = dir > 0 ? k.x1 : k.x0, cells = [], rock = BUILD_TILE[k.wall];
  for (let i = 0; i <= GROW_DIG; i++) {
    const x = x0 + dir * i;
    if (x < 3 || x >= W - 3) return null;
    for (let y = F - 4; y <= F + 1; y++) { const t = get(g, x, y); if (t === T.WATER || t === T.LAVA || t === T.SAND || t === T.OBSIDIAN || (i > 0 && (i < GROW_DIG || y < F + 1) && villageOver(g, x, x))) return null; }
    if (g.w.top[x] > F - KEEP_BURROW_RISE) return null;
    if (i < GROW_DIG) for (let y = F; y > roof; y--) growCell(cells, F, x, y, T.AIR);
    else for (let y = F; y > roof; y--) if (!isSolid(get(g, x, y))) growCell(cells, F, x, y, rock);
    if (!isSolid(get(g, x, F + 1))) growCell(cells, F, x, F + 1, rock);
    if (!isSolid(get(g, x, roof))) growCell(cells, F, x, roof, rock);
  }
  growLamp(cells, budget, x0 + dir * 2, F - 2);
  return {cells, label: 'deeper burrow', why: 'Could use more room. Digging further into the hill.', apply: () => {
    if (dir > 0) k.x1 += GROW_DIG; else k.x0 -= GROW_DIG;
    return {x0: Math.min(x0, x0 + dir * GROW_DIG), x1: Math.max(x0, x0 + dir * GROW_DIG), y0: roof, y1: F + 1, wall: 'stone'};
  }};
}
function growJob(g, chain) {
  const m = g.m, j = m.journey, k = j.keep;
  if (!k || isNight(g) || inUnder(g)) return null;
  if (!m.growCells) {
    if (g.day < (j.growDay || 0) || (j.grown || 0) >= (j.hold ? GROW_STAY : GROW_CAMP)) return null;
    keepSupplies(g);
    const budget = Object.assign({}, m.inv), have = Math.max(0, cnt(m, k.wall) - KEEP_RESERVE);
    const order = (k.hill ? [deeperCells] : (j.grown || 0) % 2 ? [storeyCells, wingCells] : [wingCells, storeyCells]).concat(towerCells);
    let plan = null;
    for (const fn of order) {
      const p = fn(g, k, budget);
      if (!p) continue;
      const stone = p.cells.filter(c => c.tile === BUILD_TILE[k.wall]).length;
      if (stone <= have) { plan = p; break; }
    }
    j.growDay = g.day + GROW_EVERY;
    if (!plan) return null;
    const room = plan.apply();
    j.rooms = (j.rooms || []).concat(room);
    j.grown = (j.grown || 0) + 1; j.growName = plan.label;
    m.growCells = keepOrder(keepTidy(plan.cells));
    m.built = m.built || {}; m.buildWork = m.buildWork || {};
    m.built.grow = false; m.buildWork.grow = 0;
    logEvent(g, plan.why);
    return {name: 'plan', label: plan.why, run(g) { m.act = {type: 'wait', t: 0, dur: KEEP_THINK}; return 'done'; }};
  }
  const want = {};
  for (const c of m.growCells) if (c.tile !== T.AIR && !cellDone(g, c)) { const it = TILE_ITEM[c.tile]; want[it] = (want[it] || 0) + 1; }
  for (const it in want) if (cnt(m, it) < want[it]) m.growCells = m.growCells.filter(c => TILE_ITEM[c.tile] !== it || cellDone(g, c));
  const job = (m.buildWork.grow || 0) > GROW_MOST_WORK ? null : buildJob(g, 'grow', j.growName || 'keep', chain, m.growCells, 'Added on to a keep', null, true);
  if (job) return job;
  m.growCells = null;
  g.stats.keepsGrown = (g.stats.keepsGrown || 0) + 1; g.stats.dayGrow = j.growName; gainGrit(g, GROW_GRIT);
  logEvent(g, 'Finished the ' + j.growName);
  bookKeep(g, 'A new ' + j.growName, BOOK_GROW_LINES[skyHash(g.seed, g.stats.bookN || 0) % BOOK_GROW_LINES.length]);
  return null;
}
