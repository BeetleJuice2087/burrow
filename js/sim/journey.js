// Burrow sim · journey.js — The endless journey: the world slides along under the miner, who packs up, walks east, camps, farms and moves on.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// m.journey = {stage: 'pack' | 'travel' | 'camp' | 'leave', hold, n, col, off, joinSurf, joinBiome, camps, dest, campDay, packUntil, stuck}
// n and col are the next column of new land, off is how far the world has slid so far. g.land is a cache, rebuilt from those.
'use strict';

const SHIFT_BY = 208, SHIFT_AT = 50, CAMP_DAYS = 6, CAMP_RANGE = 100, CAMP_STAY_RANGE = 200, CAMP_BACK = 50, JOIN_REACH = 14, CINDER_WORN = 0.35; // cinder gear goes for mending early: the trip wears it down too

// ---------- the sliding world ----------
function landStretch(g) {
  const j = g.m.journey;
  if (g.land && g.land.n === j.n) return g.land.w;
  const seed = (Math.imul(g.seed, 31) + Math.imul(j.n + 1, 104729)) >>> 0, w = generate(seed, {surf: j.joinSurf, biome: j.joinBiome, at: (j.n + 1) * W, noise: (Math.imul(g.seed, 53) + 11) >>> 0});
  addObsidianVeins(w, seed);
  if (j.villageFrom === undefined) j.villageFrom = j.col ? j.n + 1 : j.n; // land already part way in stays as it was: half a village is no use to anyone
  if (j.n >= j.villageFrom) placeVillage(w, seed, j.n);
  g.land = {n: j.n, w};
  return w;
}
// the next column of new land goes into column x
function laneIn(g, x) {
  const j = g.m.journey, w = g.w;
  if (j.col >= W) { j.joinSurf = w.surf[x - 1]; j.joinBiome = w.biome[x - 1]; j.n++; j.col = 0; }
  const land = landStretch(g), c = j.col++;
  if (c === 0) mendJoin(g, land, x);
  for (let y = 0; y < H; y++) {
    const from = y * W + c, to = y * W + x, chest = land.chests[from];
    w.t[to] = land.t[from]; w.lv[to] = land.lv[from]; g.seen[to] = 0;
    if (chest) w.chests[to] = chest;
    if (LIGHT_TILES.has(w.t[to])) g.torches.push({x, y});
  }
  villageLands(g, land, c, x);
  w.biome[x] = land.biome[c]; w.surf[x] = land.surf[c]; w.top[x] = land.top[c];
  const here = list => (list || []).filter(s => s.x === c).map(s => Object.assign({}, s, {x}));
  w.springs.push(...here(land.springs));
  if (land.spawners) w.spawners = (w.spawners || []).concat(here(land.spawners));
}
// a cave that reaches the join would stop dead at a straight wall: round each one off, on into whichever side is solid
function mendJoin(g, land, x) {
  const w = g.w, top = y => y > Math.max(w.surf[x - 1], land.surf[0]) + 5;
  const rock = t => t === T.STONE || t === T.DEEP;
  const dry = (t, k) => { for (const o of [-1, 1, -W, W]) if (t[k + o] === T.LAVA || t[k + o] === T.WATER) return false; return true; };
  const round = (t, col, stop) => { // col(i) is the column i steps into the solid side, stop(y) what faces it
    const open = y => !isSolid(stop(y)) && stop(y) !== T.LAVA && stop(y) !== T.WATER;
    for (let y = 1; y < H - 5; y++) {
      if (!top(y) || !open(y)) continue;
      let a = y; while (y + 1 < H - 5 && open(y + 1)) y++;
      for (let yy = a; yy <= y; yy++) {
        const reach = Math.min(JOIN_REACH, Math.min(yy - a, y - yy) * 2 + 1 + Math.floor(hash2(yy, x, g.seed) * 3));
        for (let i = 0; i < reach; i++) { const k = yy * W + col(i); if (rock(t[k]) && dry(t, k)) t[k] = T.AIR; }
      }
    }
  };
  round(w.t, i => x - 1 - i, y => land.t[y * W]);
  round(land.t, i => i, y => get(g, x - 1, y));
  round(land.t, i => i, y => get(g, x - 2, y)); // older land can end in a solid column: see past it
}
function shiftWorld(g) {
  const m = g.m, w = g.w, j = m.journey, dx = SHIFT_BY;
  const key = k => k % W >= dx ? k - dx : -1;
  const keySet = s => { if (!s) return s; const out = new Set(); for (const k of s) { const n = key(k); if (n >= 0) out.add(n); } return out; };
  const keyObj = o => { if (!o) return o; const out = {}; for (const k in o) { const n = key(+k); if (n >= 0) out[n] = o[k]; } return out; };
  const slide = list => (list || []).filter(s => { s.x -= dx; if (s.px !== undefined) s.px -= dx; return s.x >= 1; });
  const spot = p => { if (!p) return p; p.x -= dx; return p.x >= 2 ? p : null; };
  for (let y = 0; y < H; y++) for (const a of [w.t, w.lv, g.seen]) a.copyWithin(y * W, y * W + dx, (y + 1) * W);
  for (const a of [w.biome, w.surf, w.top]) a.copyWithin(0, dx, W);
  g.known = keySet(g.known); g.protect = keySet(g.protect); g.noTorch = keySet(g.noTorch);
  for (const f in g.fluid) g.fluid[f] = keySet(g.fluid[f]);
  { const out = new Map(); for (const [k, v] of g.black) { const n = key(k); if (n >= 0) out.set(n, v); } g.black = out; }
  w.chests = keyObj(w.chests); w.graves = keyObj(w.graves); w.crops = keyObj(w.crops); m.buildSkip = keyObj(m.buildSkip);
  w.regrow = (w.regrow || []).filter(r => (r.k = key(r.k)) >= 0);
  g.torches = slide(g.torches); g.decay = slide(g.decay); w.springs = slide(w.springs); w.spawners = slide(w.spawners);
  g.monsters = slide(g.monsters); g.critters = slide(g.critters); g.arrows = slide(g.arrows); m.veinLog = slide(m.veinLog);
  g.fx = []; g.dirty = [];
  if (g.snaps) g.snaps = []; // the page takes its pictures straight away: anything still waiting has gone
  if (g.trader) { g.trader.x -= dx; if (g.trader.x < 2) g.trader = null; }
  if (g.hutBox) { g.hutBox.x0 -= dx; g.hutBox.x1 -= dx; }
  m.x -= dx; m.px -= dx; m.path = []; m.job = null; m.strip = null; m.lastTorch = null; m.stillX = m.x;
  w.spawn = spot(w.spawn) || {x: m.x, y: m.y};
  m.home = spot(m.home) || {x: m.x, y: m.y};
  m.bed = spot(m.bed);
  m.stations = slide(m.stations);
  if (j.rooms) j.rooms = j.rooms.filter(r => { r.x0 -= dx; r.x1 -= dx; return r.x1 > 0; });
  if (m.farm) { for (const p of m.farm.plots) { p.x0 -= dx; for (const c of p.level) c.x -= dx; } if (m.farm.plots[0].x0 < 2) m.farm = null; }
  m.gateCells = m.decorCells = m.finishCells = m.storeCells = m.campCells = m.growCells = null;
  slideVillages(g, dx);
  if (m.gate) {
    m.gate.x -= dx;
    if (m.gate.x < 2) { m.gate = null; g.stats.dayGateLost = true; logEvent(g, 'The gate is far behind now'); } // the Underworld itself is still there, for the next gate
  }
  for (let x = W - dx; x < W; x++) laneIn(g, x);
  for (let x = W - dx + 6; x < W - 6; x += 12 + Math.floor(g.rng() * 14)) if (lushBiome(w.biome[x])) spawnCritter(g, x);
  j.off += dx;
  g.stats.farthest = j.off + m.x;
  g.shifted = (g.shifted || 0) + dx; // the page moves its camera the same distance
  g.stats.lands = (g.stats.lands || 0) + 1;
}

// ---------- setting off ----------
function moveOn(g) {
  const m = g.m;
  if (m.journey && m.journey.hold && inUnder(g)) { m.journey.hold = false; return true; } // it finishes its trip first
  if (inUnder(g) || m.dead) return false;
  if (!m.journey) m.journey = {stage: 'pack', n: 0, col: 0, off: 0, joinSurf: g.w.surf[W - 1], joinBiome: g.w.biome[W - 1], camps: 0, packUntil: g.tick + DAY / 2};
  else { m.journey.hold = false; if (m.journey.stage === 'camp') m.journey.stage = 'leave'; }
  m.job = null; m.path = [];
  return true;
}
// a loaded save stays put until it's told to move on, and so does a miner told to stay: on the road it camps at the next spot it can
function holdJourney(g) {
  const m = g.m, j = m.journey;
  if (!j) return;
  m.job = null; m.path = [];
  if (j.stage === 'pack') { m.journey = null; return; }
  j.hold = true;
  if (j.stage === 'leave') j.stage = 'camp';
}
function nextDest(g) {
  const m = g.m, j = m.journey;
  j.dest = m.x + j.off + 110 + skyHash(g.seed, j.camps + 200) % 110; j.stuck = 0;
}
const JOURNEY_KIT = {bed: 1, bench: 1, furnace: 1, door: 2, chest: 1};
function packJob(g) {
  const m = g.m, j = m.journey, chain = ['Pack for the journey'];
  if (g.tick < j.packUntil) {
    let job = blocksAvail(m) < 48 ? gatherJob(g, 'cobble', cnt(m, 'cobble') + 48) : null;
    if (!job && cnt(m, 'torch') < 12) job = need(g, 'torch', 12, chain);
    if (job) { m.chain = chain; return job; }
  }
  const h = m.home;
  if (Math.abs(m.x - h.x) > 2 || Math.abs(m.y - h.y) > 2) { const go = gotoJob(g, 'Going home one last time', h.x, h.y, 2); go.giveUp = true; if (g.tick < j.packUntil + DAY / 2) { m.chain = chain; return go; } }
  return {
    name: 'pack', label: 'Packing up the house',
    run(g) {
      m.act = {type: 'craft', t: 0, item: null, fn: () => {
        for (const k in m.stash || {}) add(g, k, m.stash[k]);
        m.stash = {};
        for (const k in JOURNEY_KIT) if (cnt(m, k) < JOURNEY_KIT[k]) add(g, k, JOURNEY_KIT[k] - cnt(m, k));
        milestone(g, 'journey', 'Set off on the endless journey');
        leaveChest(g); // what's not worth carrying stays in the chests at home
        if (get(g, h.x, h.y) === T.AIR && isSolid(get(g, h.x, h.y + 1))) setTile(g, h.x, h.y, T.CAMPFIRE); // a fire left burning at the old place
        leaveCamp(g);
      }};
      return 'done';
    }
  };
}
// everything that ties the miner to the place it's leaving
function leaveCamp(g) {
  const m = g.m, j = m.journey;
  j.rooms = homeRooms(g); // the buildings stay behind, walls and all
  m.campCells = null; m.growCells = null; m.buildSkip = {}; j.keepChest = null; j.keep = null;
  m.hut = false; m.hutWork = 0; m.bed = null; m.stations = []; m.farm = null; m.farmDone = false; m.farmNext = 0;
  m.built = Object.assign({}, m.built, {storage: false}); g.protect = null; g.hutBox = null; m.hidDay = -1;
  j.stage = 'travel'; nextDest(g);
}

// ---------- on the road ----------
function campable(g, x) {
  if (villageNear(g, x, VILLAGE_CAMP)) return false; // a keep has no place in someone else's street
  const y = groundAt(g, x, g.w.top[x] - 1);
  if (y === null || y < g.w.top[x] - 1 || !isSolid(get(g, x, y + 1))) return false;
  for (let d = -4; d <= 4; d++) { const q = g.w.top[x + d]; if (x + d < 2 || x + d >= W - 2 || Math.abs(q - g.w.top[x]) > 1 || get(g, x + d, q) === T.WATER) return false; }
  return true;
}
function makeCamp(g) {
  const m = g.m, j = m.journey;
  m.home = {x: m.x, y: m.y}; j.stage = 'camp'; j.campDay = g.day; j.camps++;
  g.stats.camps = j.camps; g.stats.dayCamp = g.w.biome[m.x]; gainGrit(g, GRIT_CAMP);
  logEvent(g, 'Made camp in the ' + BIOMES[g.w.biome[m.x]].toLowerCase());
  roadMark(g, 'camp', 'Camp ' + j.camps, m.x);
}
function roadJob(g) {
  const m = g.m, j = m.journey, there = m.x + j.off >= j.dest;
  if ((there || j.hold) && m.y <= g.w.top[m.x] && !villageNear(g, m.x, VILLAGE_CAMP) && (campable(g, m.x) || m.x + j.off >= j.dest + 70 || j.hold)) { makeCamp(g); return null; }
  if ((j.stuck || 0) > 6 && m.y <= g.w.top[m.x]) { makeCamp(g); return null; }
  const biome = BIOMES[g.w.biome[m.x]].toLowerCase(), walkY = x => { const f = villageFeet(g, x); return f === null ? g.w.top[x] - 1 : f; };
  return {
    name: 'trek', label: 'Walking east through the ' + biome, get to() { const x = Math.min(m.x + 30, W - 6); return {x, y: walkY(x)}; },
    run(g) {
      for (const hop of [30, 14, 6]) {
        const x = Math.min(m.x + hop, W - 6), path = travel(g, x, walkY(x), 2);
        if (path) { m.path = path; j.stuck = 0; return 'run'; }
      }
      j.stuck = (j.stuck || 0) + 1;
      return 'fail';
    }
  };
}

// ---------- at camp ----------
// a gate this camp can use: its own, or one still standing close by
function campGate(g) {
  const m = g.m, j = m.journey;
  if (!j || j.stage !== 'camp' || !m.gate || !gateStands(g)) return false;
  if (Math.abs(m.gate.x - m.home.x) < 120) j.gateCamp = j.camps;
  return j.gateCamp === j.camps;
}
// cinder gear only mends with cinderite, so worn gear means a new gate at this camp, then a trip through it
function cinderGateJob(g) {
  const m = g.m, j = m.journey;
  const worn = fullKit(m).some(k => k.startsWith('cinder') && RECIPES[k] && cnt(m, k) <= 1 && durLeft(m, k) <= DUR[k] * CINDER_WORN);
  if (!worn && !lostGear(g).some(k => k.startsWith('cinder')) || campGate(g)) return null;
  m.built = m.built || {}; m.buildWork = m.buildWork || {};
  if (j.gateCamp !== j.camps) { j.gateCamp = j.camps; m.gate = null; m.gateCells = null; m.built.gate = false; m.buildWork.gate = 0; m.gateTries = 0; }
  m.chain = ['Build a gate to mend my gear'];
  return gateJob(g, m.chain);
}
// mining to pass the time at camp never picks a spot past the limit, so it can't set off for one and get sent back. Mining for something it needs goes anywhere
// told to stay it's in no hurry, so it ranges much further from the keep
const campRange = m => m.journey && m.journey.hold ? CAMP_STAY_RANGE : CAMP_RANGE;
function inCampRange(g, x) {
  const m = g.m, j = m.journey;
  if (!j || j.stage !== 'camp' || !m.chain || m.chain[0] !== 'Mine around camp' || inUnder(g)) return true;
  return Math.abs(x - m.home.x) <= campRange(m);
}
function campJob(g) {
  const m = g.m, j = m.journey, chain = ['Set up camp'];
  const go = job => { if (job) m.chain = chain; return job; };
  { const k = keepJob(g, chain); if (k) return go(k); }
  if (!m.bed && cnt(m, 'bed') > 0) { const b = bedJob(g); if (b) return go(b); }
  if (!m.hut) { const h = hutJob(g); if (h) return go(h); }
  for (const s of ['bench', 'furnace']) if (cnt(m, s) > 0 && !m.stations.some(q => STATION_TILES[s].includes(q.t))) {
    if (j.keepHome === j.camps && (Math.abs(m.x - m.home.x) > 3 || Math.abs(m.y - m.home.y) > 1)) return go(gotoJob(g, 'Moving into the keep', m.home.x, m.home.y, 1));
    return go(placeStationJob(g, s));
  }
  if (!m.farmDone && !isNight(g)) { const f = farmGoal(g, chain); if (f) return go(f); }
  { const k = growJob(g, chain); if (k) return go(k); }
  { const c = cinderGateJob(g); if (c) return c; }
  if (tier(m) < PICK_TIER.cinder_pick && !cnt(m, 'cinder_pick')) { // it wore out on the trip: what came home can make another
    const ingots = RECIPES.cinder_pick.in.cinder_ingot;
    if (cnt(m, 'raw_cinderite') + cnt(m, 'cinder_ingot') * 2 >= ingots * 2) { m.chain = ['Make a new cinder pickaxe']; const p = need(g, 'cinder_pick', 1, m.chain); if (p) return p; }
  }
  if (tier(m) < 4) { m.chain = ['Make a new pickaxe']; const p = need(g, 'gem_pick', 1, m.chain); if (p) return p; }
  if (!j.hold && g.day >= j.campDay + CAMP_DAYS) { j.stage = 'leave'; return leaveJob(g); }
  if (Math.abs(m.x - m.home.x) > campRange(m)) { m.strip = null; m.chain = ['Mine around camp']; return gotoJob(g, 'Too far from camp, heading back', m.home.x + Math.sign(m.x - m.home.x) * CAMP_BACK, m.y, 6); } // only back into range: it can mine again from there
  const held = k => cnt(m, k), want = held('gem') < held('raw_gold') ? 'gem' : 'raw_gold';
  m.chain = ['Mine around camp'];
  return need(g, want, cnt(m, want) + 3, m.chain);
}
function leaveJob(g) {
  const m = g.m, h = m.home, j = m.journey;
  if (Math.abs(m.x - h.x) > 2 || Math.abs(m.y - h.y) > 2) { m.chain = ['Break camp']; return gotoJob(g, 'Heading back to break camp', h.x, h.y, 2); }
  return {
    name: 'pack', label: 'Breaking camp',
    run(g) {
      m.act = {type: 'craft', t: 0, item: null, fn: () => {
        const bed = m.bed;
        if (bed && get(g, bed.x, bed.y) === T.BED) { setTile(g, bed.x, bed.y, T.AIR); add(g, 'bed', 1); }
        for (const s of m.stations) if (get(g, s.x, s.y) === s.t) { setTile(g, s.x, s.y, T.AIR); const it = TILE_ITEM[s.t]; if (it) add(g, it, 1); }
        for (const k in JOURNEY_KIT) if (cnt(m, k) < JOURNEY_KIT[k]) add(g, k, JOURNEY_KIT[k] - cnt(m, k));
        const kept = j.keepChest && get(g, j.keepChest.x, j.keepChest.y) === T.STORE_CHEST ? j.keepChest : null;
        if (kept) leaveChest(g, kept.x, kept.y); // the keep's own chest
        else if (bed && get(g, bed.x, bed.y) === T.AIR) leaveChest(g, bed.x, bed.y); // or it goes where the bed was
        else leaveChest(g, m.x + m.facing, m.y);
        logEvent(g, 'Packed up the camp and moved on');
        leaveCamp(g);
      }};
      return 'done';
    }
  };
}
function journeyJob(g) {
  const m = g.m, j = m.journey;
  if (j.stage === 'pack') return packJob(g);
  if (j.stage === 'travel') { const r = roadJob(g); if (r) { m.chain = ['Walk east']; return r; } }
  if (j.stage === 'leave') return leaveJob(g);
  return campJob(g);
}
