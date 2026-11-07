// Burrow sim · village.js — Villages on the journey's new land: lived-in ones with an inn and a market, abandoned ones with a cellar nobody should open.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// A stretch of land rebuilds from its seed, so the buildings do too. What changes is kept in w.villages (saved in o.land): each v = {kind, name, id, x0, x1, houses, bed, chest, lair, seen, woken}.
// v.folk are the people, made up again whenever they're needed: they aren't saved, and they never touch g.rng.
'use strict';

const VILLAGE_CHANCE = 0.7, RUIN_SHARE = 0.3, VILLAGE_EDGE = 34, VILLAGE_ROUGH = 7, VILLAGE_RAMP = 6, VILLAGE_SEE = 70, VILLAGE_SAFE = 16, VILLAGE_CAMP = 24, RUIN_WAKE = 16, FOLK_PACE = 9, VILLAGE_GRIT = 6, RUIN_GRIT = 12;
const VILLAGE_NAMES = ['Hollowford', 'Brackenwick', 'Tamsel', 'Low Orrin', 'Quillby', 'Ashby Dell', 'Merrowgate', 'Thistlemere', 'Pennyhollow', 'Dunmarrow', 'Wrenfield', 'Oxbow Rest', 'Fallowend', 'Sedgemoor', 'Larkstead', 'Cobbleton', 'Harrowby', 'Winnowick', 'Marlpit', 'Greywater'];
const FOLK_NAMES = ['Maren', 'Tobin', 'Isolde', 'Fennick', 'Oona', 'Bartle', 'Sorrel', 'Hask', 'Linnet', 'Corwen', 'Tilda', 'Rusk'];
// walls, roof, how it stands. Stilts lift the floor clear of the mire
const VILLAGE_STYLE = {
  [B_SNOW]: {wall: T.STONE_BRICKS, roof: T.PLANKS}, [B_FOREST]: {wall: T.PLANKS, roof: T.COBBLE}, [B_MEADOW]: {wall: T.PLANKS, roof: T.STONE_BRICKS},
  [B_DUNES]: {wall: T.CUT_SANDSTONE, roof: T.SANDSTONE, flat: true}, [B_MIRE]: {wall: T.PLANKS, roof: T.MOSSY, raise: 3}, [B_RED]: {wall: T.SMOOTH_SANDSTONE, roof: T.SANDSTONE, flat: true},
  [B_AMBER]: {wall: T.PLANKS, roof: T.SMOOTH_STONE}, [B_SAVANNA]: {wall: T.CUT_SANDSTONE, roof: T.PLANKS}};
// [give, how many, how many the miner keeps, get, how many]
const VILLAGE_OFFERS = [['cobble', 32, 64, 'bread', 3], ['coal', 8, 8, 'cooked_meat', 3], ['raw_copper', 8, 8, 'apple', 4], ['raw_iron', 6, 6, 'iron_arrow', 8], ['raw_gold', 4, 6, 'gold_arrow', 8],
  ['gem', 2, 8, 'gem_arrow', 8], ['gem', 3, 8, 'golden_apple', 1], ['log', 12, 12, 'baked_potato', 3], ['raw_cinderite', 2, 6, 'cinder_arrow', 4]];

// ---------- building ----------
const villageMid = v => (v.x0 + v.x1) >> 1;
function villageSite(w, wide, r, from, to) {
  let best = -1, score = INF;
  for (let x0 = from; x0 + wide < to; x0 += 3) {
    let lo = INF, hi = -INF, holes = 0, wet = false;
    for (let x = x0 - VILLAGE_RAMP; x <= x0 + wide + VILLAGE_RAMP && !wet; x++) {
      const s = w.surf[x];
      lo = Math.min(lo, s); hi = Math.max(hi, s);
      if (!isSolid(w.t[s * W + x])) holes++;
      for (let y = s - 3; y <= s + 3; y++) { const t = w.t[y * W + x]; if (t === T.WATER || t === T.LAVA) wet = true; }
    }
    if (wet || hi - lo > VILLAGE_ROUGH) continue;
    const q = (hi - lo) * 4 + holes + r();
    if (q < score) { score = q; best = x0; }
  }
  return best;
}
// the ground under it, graded so each house sits level and the rest slopes gently between them
function gradeVillage(w, v, plan, sandy) {
  const x0 = plan[0].x0 - VILLAGE_RAMP, x1 = plan[plan.length - 1].x1 + VILLAGE_RAMP, level = {};
  plan.forEach(h => { for (let x = h.x0 - 1; x <= h.x1 + 1; x++) level[x] = h.G; });
  const ease = (a, av, b, bv) => { for (let x = a + 1; x < b; x++) if (level[x] === undefined) level[x] = Math.round(av + (bv - av) * (x - a) / (b - a)); };
  for (let i = 1; i < plan.length; i++) ease(plan[i - 1].x1 + 1, plan[i - 1].G, plan[i].x0 - 1, plan[i].G);
  ease(x0 - 1, w.surf[x0 - 1], plan[0].x0 - 1, plan[0].G);
  ease(plan[plan.length - 1].x1 + 1, plan[plan.length - 1].G, x1 + 1, w.surf[x1 + 1]);
  for (let x = x0; x <= x1; x++) {
    const L = level[x], s = w.surf[x], was = w.t[s * W + x], top = isSolid(was) ? was : sandy ? T.SANDSTONE : T.GRASS, fill = sandy ? T.SANDSTONE : T.DIRT;
    for (let y = 0; y < L; y++) w.t[y * W + x] = T.AIR;
    w.t[L * W + x] = top;
    for (let y = L + 1; y <= L + 4; y++) if (!isSolid(w.t[y * W + x])) w.t[y * W + x] = fill;
    w.surf[x] = L;
  }
}
function buildHouse(w, v, h, style, r, ruined) {
  const put = (x, y, t) => { w.t[y * W + x] = t; }, raise = style.raise || 0, G = h.G, feet = G - raise - 1, last = h.x1 - h.x0, roofY = feet - 3;
  const wallT = ruined ? () => (r() < 0.5 ? T.MOSSY : T.COBBLE) : () => style.wall, roofT = ruined ? () => T.COBBLE : () => style.roof;
  h.feet = feet; h.top = roofY; h.roof = roofY; h.wall = ruined ? 'stone' : style.wall === T.PLANKS ? 'planks' : style.wall === T.STONE_BRICKS ? 'bricks' : 'sand';
  for (let c = 0; c <= last; c++) {
    const x = h.x0 + c;
    put(x, feet + 1, ruined ? T.COBBLE : raise ? T.PLANKS : T.COBBLE);
    if (raise && (c === 0 || c === last)) for (let y = feet + 2; y < G; y++) put(x, y, T.LOG);
    for (let y = feet + 2; y <= G + 3 && !raise; y++) if (!isSolid(w.t[y * W + x])) put(x, y, T.COBBLE);
    for (let y = roofY + 1; y <= feet; y++) put(x, y, T.AIR);
  }
  for (const c of [0, last]) { put(h.x0 + c, feet, T.DOOR); put(h.x0 + c, feet - 1, T.DOOR); put(h.x0 + c, feet - 2, T.GLASS_PANE); }
  for (let c = -1; c <= last + 1; c++) put(h.x0 + c, roofY, roofT());
  if (style.flat) for (let c = 0; c <= last; c += 2) put(h.x0 + c, roofY - 1, roofT());
  else for (let n = 1; n * 2 + 1 <= last / 2 + 1; n++) { h.top = roofY - n; for (let c = n * 2 - 2; c <= last - n * 2 + 2; c++) put(h.x0 + c, roofY - n, roofT()); } // a shallow pitch: a tall solid roof only casts a shadow
  for (let i = 1; i < raise; i++) for (const x of [h.x0 - i, h.x1 + i]) for (let y = feet + i + 1; y < G; y++) put(x, y, T.PLANKS); // steps up
  if (ruined) {
    const worn = (c0, c1, y0, y1, share) => { for (let y = y0; y <= y1; y++) for (let c = c0; c <= c1; c++) { const k = y * W + h.x0 + c; if (w.t[k] !== T.AIR && r() < share) w.t[k] = T.AIR; } };
    for (const c of [0, last]) { put(h.x0 + c, feet, T.AIR); put(h.x0 + c, feet - 1, T.AIR); put(h.x0 + c, feet - 2, r() < 0.5 ? T.COBBLE : T.AIR); }
    worn(-1, last + 1, h.top, roofY, 0.55);
    for (let c = 1; c < last; c++) if (r() < 0.4) put(h.x0 + c, feet, T.TGRASS);
    return;
  }
  const furnish = h.inn ? [[1, T.BED], [2, T.BED], [4, T.WOOD_STAIRS], [5, T.WOOD_SLAB], [last - 3, T.CAULDRON], [last - 2, T.COPPER_CHEST]]
    : [[1, T.BED], [3, T.WOOD_STAIRS], [4, T.WOOD_SLAB], [last - 1, h.x0 % 2 ? T.CAULDRON : T.STORE_CHEST]];
  for (const [c, t] of furnish) put(h.x0 + c, feet, t);
  put(h.x0 + (last >> 1), feet - 2, T.LANTERN);
  if (h.inn) v.bed = {x: h.x0 + 1, y: feet};
}
// a stair down from the floor of one ruin to a long low cellar, with a chest at the far end. Whatever got in has had years to settle
function digCellar(w, v, h, plan, r) {
  const C = Math.max(...plan.map(p => p.G)) + 3, sx = h.x0 + 1, steps = C + 4 - h.G, rx0 = sx + steps, rx1 = rx0 + 11;
  if (rx1 + 1 >= W - 8) return;
  for (let y = h.G - 1; y <= C + 5; y++) for (let x = sx - 1; x <= rx1 + 2; x++) { const t = w.t[y * W + x]; if (t === T.WATER || t === T.LAVA) return; }
  for (let y = C - 1; y <= C + 4; y++) for (let x = rx0 - 1; x <= rx1 + 1; x++) w.t[y * W + x] = (y >= C && y < C + 4 && x >= rx0 && x <= rx1) ? T.AIR : r() < 0.5 ? T.MOSSY : T.COBBLE;
  for (let i = 0; i <= steps; i++) {
    const x = sx + i, feet = Math.min(C + 3, h.G - 1 + i);
    for (let y = feet - 2; y <= feet; y++) if (y > h.G - 1 - 3) w.t[y * W + x] = T.AIR;
    if (!isSolid(w.t[(feet + 1) * W + x])) w.t[(feet + 1) * W + x] = T.COBBLE;
  }
  const chest = {x: rx1, y: C + 3};
  w.t[chest.y * W + chest.x] = T.CHEST;
  w.chests[chest.y * W + chest.x] = {raw_gold: 4 + Math.floor(r() * 5), gem: 2 + Math.floor(r() * 4), cooked_meat: 4, gem_arrow: 8, golden_apple: 1, torch: 8};
  v.chest = chest; v.lair = {x0: rx0, x1: rx1, y0: C, y1: C + 3};
}
// each stretch of land has room for two, one in each half
function placeVillage(w, seed, n) {
  const r = mulberry((seed ^ 0x5a17) + n * 31 + 7), half = W >> 1;
  for (let i = 0; i < 2; i++) if (r() < VILLAGE_CHANCE) buildVillage(w, seed, n * 2 + i, r, i ? half : VILLAGE_EDGE, i ? W - VILLAGE_EDGE : half);
}
function buildVillage(w, seed, n, r, from, to) {
  const ruined = r() < RUIN_SHARE, count = 3 + Math.floor(r() * 3), inn = count >> 1, sizes = [], gaps = [];
  for (let i = 0; i < count; i++) { sizes.push(i === inn ? 11 : 7 + 2 * Math.floor(r() * 2)); gaps.push(5 + Math.floor(r() * 4)); }
  const wide = sizes.reduce((a, b) => a + b, 0) + gaps.slice(1).reduce((a, b) => a + b, 0), x0 = villageSite(w, wide, r, from, to);
  if (x0 < 0) return;
  const biome = w.biome[x0 + (wide >> 1)], style = VILLAGE_STYLE[biome] || VILLAGE_STYLE[B_FOREST], sandy = biome === B_DUNES || biome === B_RED;
  const plan = []; let at = x0;
  for (let i = 0; i < count; i++) {
    let sum = 0; for (let c = 0; c < sizes[i]; c++) sum += w.surf[at + c];
    plan.push({x0: at, x1: at + sizes[i] - 1, G: Math.round(sum / sizes[i]), inn: i === inn});
    at += sizes[i] + gaps[(i + 1) % count];
  }
  const v = {kind: ruined ? 'ruin' : 'village', name: VILLAGE_NAMES[skyHash(seed, n) % VILLAGE_NAMES.length], id: n, x0: x0 - VILLAGE_RAMP, x1: x0 + wide + VILLAGE_RAMP, houses: plan, seen: false};
  gradeVillage(w, v, plan, sandy);
  for (const h of plan) buildHouse(w, v, h, style, r, ruined);
  if (ruined) digCellar(w, v, plan[inn], plan, r);
  else for (let i = 1; i < count; i++) { // a lamp post or a fire between the houses
    const x = (plan[i - 1].x1 + plan[i].x0) >> 1, L = w.surf[x];
    if (i === inn) w.t[(L - 1) * W + x] = T.CAMPFIRE;
    else { w.t[(L - 1) * W + x] = T.FENCE; w.t[(L - 2) * W + x] = T.LANTERN; }
  }
  for (let x = v.x0; x <= v.x1; x++) recomputeTop(w, x);
  (w.villages = w.villages || []).push(v);
}
// it arrives with its first column of land, and everything in it moves to where that column went
function slideVillage(v, dx) {
  v.x0 -= dx; v.x1 -= dx;
  for (const h of v.houses) { h.x0 -= dx; h.x1 -= dx; }
  for (const p of [v.bed, v.chest].concat(v.folk || [])) if (p) { p.x -= dx; if (p.px !== undefined) p.px -= dx; if (p.to !== undefined) p.to -= dx; }
  if (v.lair) { v.lair.x0 -= dx; v.lair.x1 -= dx; }
}
const villageLands = (g, land, c, x) => { for (const v of land.villages || []) if (v.x0 === c) { const copy = JSON.parse(JSON.stringify(v)); slideVillage(copy, c - x); (g.w.villages = g.w.villages || []).push(copy); } };
function slideVillages(g, dx) {
  if (!g.w.villages) return;
  for (const v of g.w.villages) slideVillage(v, dx);
  g.w.villages = g.w.villages.filter(v => v.x1 >= 1);
}

// ---------- what they mean for everything else ----------
// lived-in houses are off limits to the pickaxe. Ruins are anybody's
function inHouse(g, x, y) {
  for (const v of g.w.villages || []) if (v.kind === 'village' && x >= v.x0 && x <= v.x1) for (const h of v.houses) {
    if (x >= h.x0 - 1 && x <= h.x1 + 1 && y >= h.top && y <= h.feet + 1) return true;
  }
  return false;
}
// any village within this far of x, or only one with people in it
function villageNear(g, x, reach, lived) {
  for (const v of g.w.villages || []) if ((!lived || v.kind === 'village') && x >= v.x0 - reach && x <= v.x1 + reach) return v;
  return null;
}
const villageOver = (g, a, b) => (g.w.villages || []).some(v => a <= v.x1 + 2 && b >= v.x0 - 2);
// where to walk at this column: inside a house, not along its roof
function villageFeet(g, x) {
  for (const v of g.w.villages || []) if (x >= v.x0 && x <= v.x1) for (const h of v.houses) if (x >= h.x0 && x <= h.x1) return h.feet;
  return null;
}

// the back wall behind each room, for the renderer
const villageRooms = g => (g.w.villages || []).flatMap(v => v.houses.map(h => ({x0: h.x0, x1: h.x1, y0: h.roof, y1: h.feet + 1, wall: h.wall})));

// ---------- the people ----------
function makeFolk(g, v) {
  const n = 2 + v.id % 2, spots = v.houses; // two or three to a village
  v.folk = [];
  for (let i = 0; i < n; i++) {
    const home = i % spots.length, h = spots[home], x = (h.x0 + h.x1) >> 1;
    v.folk.push({x, y: h.feet, px: x, py: h.feet, home, facing: 1, wait: i * 11, name: FOLK_NAMES[(v.id * 5 + i) % FOLK_NAMES.length], look: (v.id + i) % 4});
  }
}
function folkStep(g, v, p, i) {
  const m = g.m, h = v.houses[p.home];
  if (Math.abs(p.x - m.x) <= 3 && Math.abs(p.y - m.y) <= 2 && !isNight(g)) { p.facing = Math.sign(m.x - p.x) || p.facing; return; } // a visitor: worth stopping for
  if (p.to === undefined || p.to === p.x) {
    if (p.wait > 0) { p.wait--; return; }
    const roll = hash2(g.tick, i + v.id, g.seed);
    p.to = isNight(g) ? (h.x0 + h.x1) >> 1 : v.x0 + VILLAGE_RAMP + Math.floor(roll * (v.x1 - v.x0 - VILLAGE_RAMP * 2));
    p.to = clamp(p.to, 3, W - 4);
    p.wait = 8 + Math.floor(hash2(g.tick, i, v.id) * 50);
  }
  const d = Math.sign(p.to - p.x), nx = p.x + d;
  if (!d) return;
  p.facing = d;
  const stand = y => passable(get(g, nx, y)) && passable(get(g, nx, y - 1)) && isSolid(get(g, nx, y + 1)) && get(g, nx, y) !== T.WATER;
  for (const dy of [0, -1, 1, 2]) if (stand(p.y + dy) && (dy >= 0 || passable(get(g, p.x, p.y - 2)))) { p.x = nx; p.y += dy; return; }
  p.to = p.x; // something's in the way: think of somewhere else to be
}
function wakeRuin(g, v) {
  const l = v.lair; v.woken = true;
  const go = (type, x, y) => g.monsters.push({type, x, y, px: x, py: y, hp: MON[type].hp, moveT: 0, from: null, cd: 30, facing: 1, hurt: 0});
  for (let i = 0; i < 3; i++) go('spider', l.x0 + 3 + i * 3, l.y0);
  go('shambler', l.x1 - 3, l.y1); go('crawler', l.x1 - 6, l.y1);
  logEvent(g, 'Something moved under ' + v.name);
}
function updateVillages(g) {
  const m = g.m;
  for (const v of g.w.villages) {
    if (Math.abs(villageMid(v) - m.x) > 110) continue;
    if (v.kind === 'ruin') { const l = v.lair; if (l && !v.woken && m.x >= l.x0 - RUIN_WAKE && m.x <= l.x1 + 4 && m.y >= l.y0 - 6) wakeRuin(g, v); continue; }
    if (v.x1 >= W - 2) continue;
    if (!v.folk) makeFolk(g, v);
    v.folk.forEach((p, i) => {
      if (p.x < 3) return;
      if ((g.tick + i * 3) % FOLK_PACE === 0) folkStep(g, v, p, i);
      p.px += clamp(p.x - p.px, -1 / FOLK_PACE, 1 / FOLK_PACE); p.py += clamp(p.y - p.py, -0.2, 0.2);
    });
  }
}

// ---------- the miner drops in ----------
function villageWelcome(g, v) {
  const m = g.m, s = g.stats;
  v.seen = true;
  m.hp = maxHp(m); m.hunger = 20;
  s.villages = (s.villages || 0) + 1; s.dayVillage = v.name;
  gainGrit(g, VILLAGE_GRIT);
  logEvent(g, 'Stopped in ' + v.name + '. Someone gave me a bowl of soup and a chair');
  bookPage(g, 'village', v.name, 'Someone gave me a bowl of soup and a chair.', villageMid(v), v.houses[0].feet - 2, v.x1 - v.x0);
  roadMark(g, 'village', v.name, villageMid(v));
  milestone(g, 'village', 'Found a village');
  const order = VILLAGE_OFFERS.map((o, i) => [skyHash(g.seed + v.id, i), o]).sort((a, b) => a[0] - b[0]).map(q => q[1]).slice(0, 4);
  for (const [give, n, keep, get_, out] of order) {
    if (cnt(m, give) < n + keep || (get_.endsWith('_arrow') && arrowCount(m) + out > QUIVER_MAX)) continue;
    take(m, give, n); add(g, get_, out);
    s.trades = (s.trades || 0) + 1;
    logEvent(g, 'Swapped ' + n + ' ' + ITEMS[give].toLowerCase() + ' for ' + out + ' ' + ITEMS[get_].toLowerCase() + ' in ' + v.name);
  }
  sfx(g, 'bell', m.x, m.y);
}
function innJob(g, v) {
  const m = g.m, b = v.bed;
  return {
    name: 'village', label: (v.seen ? 'Back to the inn at ' : 'Calling in at ') + v.name, to: {x: b.x, y: b.y},
    run(g) {
      if (m.x === b.x && m.y === b.y) {
        if (!v.seen) m.act = {type: 'craft', t: 0, item: null, fn: () => villageWelcome(g, v)};
        else if (isNight(g)) { m.sleeping = true; m.act = {type: 'sleep', t: 0}; }
        return 'done';
      }
      const path = travel(g, b.x, b.y, 0);
      if (!path) { v.tries = (v.tries || 0) + 1; if (v.tries >= 3) { v.seen = true; m.sleptDay = g.day; } return 'fail'; }
      m.path = path;
      return 'run';
    }
  };
}
function ruinJob(g, v) {
  const m = g.m, c = v.chest || {x: v.houses[0].x0 + 2, y: v.houses[0].feet};
  return {
    name: 'village', label: 'Poking around the ruins of ' + v.name, to: {x: c.x, y: c.y},
    run(g) {
      if (Math.abs(m.x - c.x) <= 2 && Math.abs(m.y - c.y) <= 2) {
        v.seen = true;
        g.stats.ruins = (g.stats.ruins || 0) + 1; g.stats.dayRuin = v.name;
        gainGrit(g, RUIN_GRIT);
        logEvent(g, 'Nobody home in ' + v.name + '. Not for a long time');
        bookPage(g, 'ruin', 'The ruins of ' + v.name, 'Nobody home. Not for a long time.', villageMid(v), v.houses[0].feet - 2, v.x1 - v.x0);
        roadMark(g, 'ruin', v.name, villageMid(v));
        milestone(g, 'ruin', 'Searched an abandoned village');
        if (v.chest) g.seen[c.y * W + c.x] = 1;
        return 'done';
      }
      const path = travel(g, c.x, c.y, 1);
      if (!path) { v.tries = (v.tries || 0) + 1; if (v.tries >= 3) v.seen = true; return 'fail'; }
      m.path = path;
      return 'run';
    }
  };
}
function villageJob(g) {
  const m = g.m, j = m.journey;
  if (!j || !g.w.villages || j.stage === 'pack' || j.stage === 'leave') return null;
  for (const v of g.w.villages) {
    if (v.x1 >= W - 4 || m.x < v.x0 - VILLAGE_SEE || m.x > v.x1 + VILLAGE_SEE) continue;
    if (v.kind === 'ruin') { if (!v.seen) return ruinJob(g, v); }
    else if (!v.seen || (isNight(g) && m.sleptDay !== g.day)) return innJob(g, v);
  }
  return null;
}
