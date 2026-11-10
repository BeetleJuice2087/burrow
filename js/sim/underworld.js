// Burrow sim · underworld.js — The Underworld: a second world behind a gate, its generator, realm switching and the miner's trips there.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

const inUnder = g => g.realm === 'under';
const REALM_KEYS = ['w', 'monsters', 'critters', 'arrows', 'torches', 'known', 'seen', 'black', 'fluid', 'decay', 'protect', 'noTorch'];
const UNDER_GATE_X = 300, UNDER_GATE_Y = 71;
const UNDER_VER = 2; // bump when the generator changes: an older Underworld is rebuilt the next time the miner goes down
const UNDER_BIOMES = ['Ash Flats', 'Emberwood', 'Shardfall', 'Cinder Sea', 'Hollow Wastes', 'Ashen Citadel'];
const underBiomeAt = x => x < 66 ? 5 : x < 170 ? 4 : x < 250 ? 1 : x < 352 ? 0 : x < 445 ? 2 : 3;
const UNDER_LAND = [[76, 15], [70, 5], [72, 9], [95, 2], [72, 6], [75, 0]]; // ground height and roughness per region

// ---------- the world ----------
function generateUnder(seed, era) {
  const r = mulberry((seed * 6151 + 29 + (era || 0) * 7919) >>> 0), t = new Uint8Array(W * H);
  const w = {ver: UNDER_VER, era: era || 0, seed, t, biome: new Uint8Array(W), surf: new Int16Array(W), top: new Int16Array(W), chests: {}, graves: {}, spawners: [], regrow: [],
    spawn: {x: UNDER_GATE_X, y: UNDER_GATE_Y}, springs: [], gate: {x: UNDER_GATE_X, y: UNDER_GATE_Y}};
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) t[y * W + x] = v; };
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? T.BEDROCK : t[y * W + x];
  const wave = (x, a, b, s) => Math.sin(x / a + s) * 0.6 + Math.sin(x / b + s * 2.3) * 0.4;
  const s1 = r() * 9, s2 = r() * 9, s3 = r() * 9;
  // a long cavern: a jagged roof, rolling ash hills, and a lava sea filling the low ground
  const floorAt = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    const near = clamp(1 - (Math.abs(x - UNDER_GATE_X) - 12) / 24, 0, 1); // flat ground around the gate
    let base = 0, rough = 0;
    for (let dx = -10; dx <= 10; dx++) { const l = UNDER_LAND[underBiomeAt(clamp(x + dx, 0, W - 1))]; base += l[0] / 21; rough += l[1] / 21; }
    w.biome[x] = underBiomeAt(x);
    const hills = base + wave(x, 23, 7, s1) * rough, ceil = Math.round(13 + wave(x, 17, 5, s2) * 6);
    const floor = Math.round(hills + (UNDER_GATE_Y + 1 - hills) * near);
    floorAt[x] = floor;
    for (let y = 0; y < H; y++) {
      if (y < 3 || y >= H - 3) t[y * W + x] = T.BEDROCK;
      else if (y < ceil || y >= floor) t[y * W + x] = T.ASHROCK;
      else t[y * W + x] = y >= 84 ? T.LAVA : T.AIR;
    }
  }
  // rock columns holding the roof up
  for (let k = 0; k < 26; k++) {
    const x0 = 12 + Math.floor(r() * (W - 24)), wide = 2 + Math.floor(r() * 3);
    if (Math.abs(x0 - UNDER_GATE_X) < 16 || x0 < 72) continue;
    for (let x = x0; x < x0 + wide; x++) for (let y = 4; y < floorAt[x]; y++) if (at(x, y) === T.AIR) set(x, y, T.ASHROCK);
  }
  // deep pockets under the sea
  for (let k = 0; k < 40; k++) {
    let x = 10 + r() * (W - 20), y = 94 + r() * 26;
    const lava = r() < 0.2;
    for (let n = 0, len = 8 + Math.floor(r() * 16); n < len; n++) {
      x += (r() - 0.5) * 3; y += (r() - 0.5) * 1.5;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = Math.round(x + dx), yy = Math.round(y + dy); if (yy < H - 4 && at(xx, yy) === T.ASHROCK) set(xx, yy, lava ? T.LAVA : T.AIR); }
    }
  }
  // cinderite veins: scattered through the rock, richest deep down
  for (let k = 0; k < 90; k++) {
    let x = 6 + Math.floor(r() * (W - 12)), y = k < 65 ? 92 + Math.floor(r() * 30) : 6 + Math.floor(r() * 80);
    for (let n = 0, len = 2 + Math.floor(r() * 4); n < len; n++) {
      if (at(x, y) === T.ASHROCK) set(x, y, T.CINDERITE);
      x += Math.floor(r() * 3) - 1; y += Math.floor(r() * 3) - 1;
    }
  }
  // embercaps glowing on the ash
  for (let x = 4; x < W - 4; x++) {
    if (r() > 0.16) continue;
    let y = 4; while (y < H - 4 && at(x, y) !== T.AIR) y++;
    while (y < H - 4 && at(x, y + 1) === T.AIR) y++;
    if (at(x, y) === T.AIR && at(x, y + 1) === T.ASHROCK) set(x, y, T.EMBERCAP);
  }
  // sealed vaults in the deep rock: a spawner and a chest worth the fight
  for (let k = 0, tries = 0; k < 5 && tries < 60; tries++) {
    const x0 = 76 + Math.floor(r() * (W - 106)), y0 = 98 + Math.floor(r() * 18);
    if (w.spawners.some(s => Math.abs(s.x - x0) < 40)) continue;
    for (let dx = -1; dx <= 9; dx++) for (let dy = -1; dy <= 4; dy++) set(x0 + dx, y0 + dy, dx === -1 || dx === 9 || dy === -1 || dy === 4 ? T.VAULT_BRICK : T.AIR);
    for (const dy of [2, 3]) { set(x0 - 1, y0 + dy, T.AIR); set(x0 + 9, y0 + dy, T.AIR); }
    set(x0 + 4, y0 + 3, T.SPAWNER); w.spawners.push({x: x0 + 4, y: y0 + 3});
    set(x0 + 7, y0 + 3, T.CHEST);
    const loot = {raw_cinderite: 2 + Math.floor(r() * 3), gold_ingot: 2 + Math.floor(r() * 3), gem: 1 + Math.floor(r() * 2), cooked_meat: 3};
    if (r() < 0.3) loot.golden_apple = 1;
    w.chests[(y0 + 3) * W + x0 + 7] = loot;
    k++;
  }
  decorateUnder(w, r, floorAt, set, at);
  // the far side of the gate: the first Underworld has it in the middle, every fresh one somewhere new
  const spot = (era && gateSpot(w, r, floorAt, at)) || {x: UNDER_GATE_X, y: UNDER_GATE_Y, kind: 'surface'}, gx = spot.x, gy = spot.y;
  w.gate = {x: gx, y: gy, kind: spot.kind}; w.spawn = {x: gx, y: gy};
  for (let x = gx - 3; x <= gx + 3; x++) {
    for (let y = gy - 3; y <= gy; y++) set(x, y, T.AIR);
    if (spot.kind === 'air') set(x, gy + 1, T.VAULT_BRICK);
    else if (!isSolid(at(x, gy + 1))) set(x, gy + 1, T.ASHROCK);
  }
  for (const [x, y] of gateFrame(gx, gy)) set(x, y, T.OBSIDIAN);
  set(gx, gy, T.GATE); set(gx, gy - 1, T.GATE);
  for (let i = 0; i < W; i++) recomputeTop(w, i);
  initFluids(w);
  return w;
}
// where a fresh Underworld's gate stands: on the ground, shut in the rock, or high in the air on a platform. Never by lava, a vault or the Citadel
const GATE_KINDS = [['surface', 0.5], ['under', 0.3], ['air', 0.2]], GATE_MIN_X = 84, GATE_MAX_X = W - 24;
function gateSpot(w, r, floorAt, at) {
  const roll = r(), first = roll < 0.5 ? 0 : roll < 0.8 ? 1 : 2;
  // nothing it would wreck, and no lava close enough to come in
  const clear = (x, y, up, down) => {
    for (let yy = y - up; yy <= y + down; yy++) for (let xx = x - 6; xx <= x + 6; xx++) {
      const t = at(xx, yy);
      if (t === T.LAVA || t === T.WARDSTONE || t === T.WARD_DOOR || t === T.VAULT_BRICK || t === T.CHEST || t === T.SPAWNER || t === T.BEDROCK) return false;
    }
    return true;
  };
  const open = (x, y, up) => { for (let yy = y - up; yy <= y; yy++) for (let xx = x - 4; xx <= x + 4; xx++) if (isSolid(at(xx, yy))) return false; return true; };
  for (let k = 0; k < 3; k++) {
    const kind = GATE_KINDS[(first + k) % 3][0];
    for (let tries = 0; tries < 120; tries++) {
      const x = GATE_MIN_X + Math.floor(r() * (GATE_MAX_X - GATE_MIN_X));
      if (w.ruins.some(q => x > q - 6 && x < q + 13)) continue;
      if (kind === 'surface') {
        const y = floorAt[x] - 1;
        if (floorAt[x] < 84 && Math.abs(floorAt[x - 4] - floorAt[x + 4]) <= 3 && clear(x, y, 4, 2)) return {x, y, kind};
      } else if (kind === 'under') {
        const y = Math.max(floorAt[x] + 7, 90) + Math.floor(r() * 24);
        if (y < H - 10 && clear(x, y, 5, 3)) return {x, y, kind};
      } else {
        const y = floorAt[x] - 11 - Math.floor(r() * 6);
        if (floorAt[x] < 84 && y > 20 && open(x, y, 5) && clear(x, y, 5, 3) && clear(x, floorAt[x] - 1, 1, 1)) return {x, y, kind};
      }
    }
  }
  return null;
}
// what makes each region a place: the groves, the crystal spires, old bones, ruins, and the Citadel at the far end
function decorateUnder(w, r, floorAt, set, at) {
  const dry = x => floorAt[x] < 84, feet = x => floorAt[x] - 1;
  // Emberwood: burnt trees still glowing at the crown, thick with embercaps
  for (let x = 172; x < 248; x += 5 + Math.floor(r() * 6)) {
    if (!dry(x)) continue;
    const h = 5 + Math.floor(r() * 4), top = feet(x) - h;
    for (let y = feet(x); y > top; y--) if (at(x, y) === T.AIR || at(x, y) === T.EMBERCAP) set(x, y, T.CHARWOOD);
    for (let dy = -3; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy * 2 <= 10 && at(x + dx, top + dy) === T.AIR) set(x + dx, top + dy, T.EMBERLEAF);
  }
  for (let x = 172; x < 248; x++) if (dry(x) && r() < 0.3 && at(x, feet(x)) === T.AIR) set(x, feet(x), T.EMBERCAP);
  // Shardfall: pale rock pushed up in spires, with glimmer showing through
  for (let x = 354; x < 443; x++) for (let y = floorAt[x]; y < floorAt[x] + 3; y++) if (at(x, y) === T.ASHROCK) set(x, y, T.SHARDROCK);
  const tips = [];
  for (let x = 358; x < 438; x += 8 + Math.floor(r() * 7)) {
    if (!dry(x)) continue;
    const h = 5 + Math.floor(r() * 9), half = 1 + Math.floor(r() * 2);
    for (let k = 0; k < h; k++) {
      const wide = Math.ceil(half * (1 - k / h)), y = feet(x) - k;
      for (let dx = -wide; dx <= wide; dx++) if (at(x + dx, y) === T.AIR || at(x + dx, y) === T.EMBERCAP) set(x + dx, y, r() < 0.03 ? T.GLIMMER : T.SHARDROCK);
    }
    set(x, feet(x) - h, r() < 0.4 ? T.GLIMMER : T.SHARDROCK);
    tips.push([x, feet(x) - h]);
  }
  // rare, but never so rare the Warden key can't be made
  let glimmer = 0;
  for (let k = 0; k < W * H; k++) if (w.t[k] === T.GLIMMER) glimmer++;
  for (let i = 0; i < tips.length && glimmer < 12; i++) if (at(tips[i][0], tips[i][1]) !== T.GLIMMER) { set(tips[i][0], tips[i][1], T.GLIMMER); glimmer++; }
  // Cinder Sea: islands to look at across the lava
  for (let x = 462; x < W - 8; x += 11 + Math.floor(r() * 8)) {
    const wide = 2 + Math.floor(r() * 3), top = 81 + Math.floor(r() * 3);
    for (let dx = -wide; dx <= wide; dx++) for (let y = top + Math.abs(dx); y < floorAt[x + dx]; y++) set(x + dx, y, T.ASHROCK);
    if (r() < 0.7) set(x, top - 1, T.EMBERCAP);
  }
  // Hollow Wastes: ribs of something enormous, long dead
  for (let x = 76; x < 164; x += 16 + Math.floor(r() * 12)) {
    const h = 6 + Math.floor(r() * 5), reach = 4 + Math.floor(r() * 3);
    for (const s of [-1, 1]) for (let k = 0; k <= h; k++) {
      const q = k / h, rx = x + s * Math.round(reach * Math.sin(q * 2.4 + 0.4));
      if (at(rx, feet(rx) - k) === T.AIR || at(rx, feet(x) - k) === T.AIR) set(rx, feet(x) - k, T.BONE);
    }
  }
  // ruined watchtowers, each with what its keeper left behind
  for (let k = 0, tries = 0; k < 8 && tries < 90; tries++) {
    const x0 = 76 + Math.floor(r() * 365), y = feet(x0 + 3);
    if (Math.abs(x0 - UNDER_GATE_X) < 30 || (w.ruins || []).some(q => Math.abs(q - x0) < 24) || !dry(x0) || !dry(x0 + 7)) continue;
    w.ruins = (w.ruins || []).concat(x0);
    w.ruinY = w.ruinY || {}; w.ruinY[x0] = y;
    for (let dx = 0; dx <= 7; dx++) {
      for (let dy = -5; dy <= 0; dy++) set(x0 + dx, y + dy, dx === 0 || dx === 7 || dy === -5 ? (r() < 0.8 ? T.VAULT_BRICK : T.AIR) : T.AIR);
      for (let yy = y + 1; yy <= y + 4; yy++) if (at(x0 + dx, yy) === T.AIR) set(x0 + dx, yy, T.ASHROCK);
    }
    for (const dy of [0, -1]) { set(x0, y + dy, T.AIR); set(x0 + 7, y + dy, T.AIR); }
    set(x0 + 4, y, T.CHEST);
    const loot = {gold_ingot: 1 + Math.floor(r() * 3), emberfruit: 2 + Math.floor(r() * 3), torch: 6};
    if (r() < 0.5) loot.gem = 1 + Math.floor(r() * 2);
    if (r() < 0.3) loot.raw_cinderite = 2;
    w.chests[y * W + x0 + 4] = loot;
    k++;
  }
  // the Ashen Citadel: a long sealed hall of stone nothing can dig
  const L = 8, R = 62, floor = 75, roof = 62;
  for (let x = L; x <= R; x++) {
    for (let y = 4; y < roof; y++) if (at(x, y) === T.AIR || at(x, y) === T.EMBERCAP) set(x, y, T.ASHROCK);
    for (let y = roof; y <= floor + 1; y++) set(x, y, x === L || x === R || y === roof || y >= floor ? T.WARDSTONE : T.AIR);
  }
  for (let x = R + 1; x <= R + 8; x++) { for (let y = 66; y < floor; y++) set(x, y, T.AIR); for (let y = floor; y < floor + 4; y++) set(x, y, T.ASHROCK); }
  for (const x of [20, 30, 40, 50]) { for (let y = roof + 1; y <= roof + 5; y++) set(x, y, T.WARDSTONE); set(x, roof + 6, T.LANTERN); }
  set(R, floor - 1, T.WARD_DOOR); set(R, floor - 2, T.WARD_DOOR);
  for (const x of [46, 30]) { set(x, floor - 1, T.SPAWNER); w.spawners.push({x, y: floor - 1}); }
  set(43, floor - 1, T.CHEST); w.chests[(floor - 1) * W + 43] = {gold_ingot: 6, gem: 3, cooked_meat: 4};
  set(27, floor - 1, T.CHEST); w.chests[(floor - 1) * W + 27] = {gem: 5, emberfruit: 6, golden_apple: 1};
  set(11, floor - 1, T.CHEST); w.chests[(floor - 1) * W + 11] = {gem: 12, gold_ingot: 16, golden_apple: 3, glimmer: 8};
  w.citadel = {door: {x: R, y: floor - 1}, boss: {x: 16, y: floor - 1}};
}
const gateFrame = (x, y) => [[x - 1, y], [x - 1, y - 1], [x - 1, y - 2], [x + 1, y], [x + 1, y - 1], [x + 1, y - 2], [x, y - 2]];
function makeUnderState(g, era) {
  const w = generateUnder(g.seed, era), torches = [];
  for (let k = 0; k < W * H; k++) if (LIGHT_TILES.has(w.t[k])) torches.push({x: k % W, y: (k / W) | 0});
  return {w, monsters: [], critters: [], arrows: [], torches, known: new Set(), seen: new Uint8Array(W * H), black: new Map(),
    fluid: {water: new Set(), lava: new Set(), sand: new Set()}, decay: [], protect: null, noTorch: null, stations: []};
}
// swap the whole live world; what's left behind waits, frozen, in g.other
function switchRealm(g, to, x, y) {
  const m = g.m, now = g.realm || 'over';
  if (now !== to) {
    const left = {stations: m.stations};
    for (const k of REALM_KEYS) left[k] = g[k];
    const next = g.other || makeUnderState(g);
    for (const k of REALM_KEYS) g[k] = next[k];
    m.stations = next.stations || [];
    g.other = left; g.realm = to;
    g.fx = []; g.dirty.length = 0; g.spotted = undefined;
  }
  m.x = m.px = x; m.y = m.py = y;
  m.path = []; m.job = null; m.act = null; m.strip = null; m.stripDead = null; m.veinLog = []; m.sleeping = false; m.hiding = false;
  look(g, true);
}

// ---------- the gate at home ----------
function gatePlan(g) {
  const m = g.m, h = m.home;
  const fits = (x, y, ok) => { for (let dx = -3; dx <= 3; dx++) for (let yy = y - 3; yy <= y; yy++) if (!ok(dx, get(g, x + dx, yy), x + dx, yy)) return false; return true; };
  const flat = (dx, t) => Math.abs(dx) <= 1 ? t === T.AIR || DECOR.has(t) : !isSolid(t);
  // rough ground will do when there's nothing flat: the build digs out whatever is in the way
  const rough = (dx, t, x, y) => !(g.protect && g.protect.has(y * W + x)) && !villageOver(g, x, x) && (t === T.AIR || DECOR.has(t) || GATE_DIG.has(t));
  for (const ok of [flat, rough]) for (let d = 24; d < W; d++) for (const s of [1, -1]) {
    const x = h.x + d * s;
    if (x <= 4 || x >= W - 5) continue;
    let gy = groundAt(g, x, h.y);
    if (gy === null) gy = groundAt(g, x, g.w.surf[x] - 1);
    if (gy === null) continue;
    if (ok === flat && (groundAt(g, x - 1, gy) !== gy || groundAt(g, x + 1, gy) !== gy)) continue;
    if (!fits(x, gy, ok)) continue;
    m.gate = {x, y: gy};
    return gateFrame(x, gy).map(([cx, cy]) => ({x: cx, y: cy, tile: T.OBSIDIAN})).concat([{x, y: gy, tile: T.GATE}, {x, y: gy - 1, tile: T.GATE}]);
  }
  return [];
}
// the block that frames the gate on this side; nothing digs these, however good the pickaxe
function inGateFrame(g, x, y) {
  const c = inUnder(g) ? g.w.gate : g.m.gate;
  return !!c && Math.abs(x - c.x) <= 1 && y >= c.y - 2 && y <= c.y;
}
// Obsidian veins in the deep rock, and worlds from before them get theirs here too. Older gates swap their gatestone for it.
function addObsidianVeins(w, seed) {
  const r = mulberry((seed ^ 0x0b51d1a) >>> 0);
  for (let k = 0; k < 90; k++) {
    let x = 2 + Math.floor(r() * (W - 4)), y = 98 + Math.floor(r() * 24);
    const size = 3 + Math.floor(r() * 4);
    for (let s = 0; s < size; s++) {
      const i = y * W + x, c = w.t[i];
      if (c === T.STONE || c === T.DEEP) w.t[i] = T.OBSIDIAN;
      const d = Math.floor(r() * 4);
      x = clamp(x + (d === 0 ? 1 : d === 1 ? -1 : 0), 2, W - 3); y = clamp(y + (d === 2 ? 1 : d === 3 ? -1 : 0), 96, H - 4);
    }
  }
}
function obsidianWorld(g) {
  const m = g.m;
  m.obsidian = true;
  addObsidianVeins(inUnder(g) ? g.other.w : g.w, g.seed);
  for (const w of [g.w, g.other && g.other.w]) if (w) for (let i = 0; i < W * H; i++) if (w.t[i] === T.GATESTONE) w.t[i] = T.OBSIDIAN;
  for (const c of m.gateCells || []) if (c.tile === T.GATESTONE) c.tile = T.OBSIDIAN;
  if (m.inv.gatestone) { add(g, 'obsidian', m.inv.gatestone); delete m.inv.gatestone; }
}
const GATE_DIG = new Set([T.DIRT, T.GRASS, T.SNOW, T.SAND, T.STONE, T.LOG, T.LEAVES, T.PINE]);
// the gate is only there if it really stands in the overworld, whatever the build plan believes
function gateStands(g) {
  const m = g.m;
  if (inUnder(g)) return true;
  return !!m.gate && get(g, m.gate.x, m.gate.y) === T.GATE && get(g, m.gate.x, m.gate.y - 1) === T.GATE;
}
function gateJob(g, chain) {
  const m = g.m;
  m.built = m.built || {}; m.buildWork = m.buildWork || {}; m.buildSkip = m.buildSkip || {};
  if (m.built.gate) { // marked finished, yet no gate: mend it once, then start over somewhere else
    m.built.gate = false; m.buildWork.gate = 0;
    for (const c of m.gateCells || []) delete m.buildSkip[c.y * W + c.x];
    m.gateTries = (m.gateTries || 0) + 1;
    if (m.gateTries > 1) { m.gateCells = null; m.gateTries = 0; }
  }
  if (!m.gateCells || !m.gateCells.length) {
    if ((m.gateRetry || 0) > g.tick) return null;
    m.gateCells = gatePlan(g);
    if (!m.gateCells.length) { m.gateRetry = g.tick + 2400; return null; } // no room anywhere right now: never call that built
  }
  // never work from inside the frame: it is exactly miner sized, and its obsidian isn't dug back out
  const insideGate = (x, y) => m.gate && x === m.gate.x && Math.abs(y - m.gate.y) <= 1;
  return buildJob(g, 'gate', 'Underworld gate', chain, m.gateCells, 'Built the Underworld gate', insideGate);
}
// walled into an unfinished gate (older worlds could do this, and a hollow under the floor means no digging down):
// take out one side and let the build start that side again. Goes by the blocks, since the plan may have moved on.
function gateTrapJob(g) {
  const m = g.m, x = m.x, y = m.y;
  if (inUnder(g) || get(g, x, y) === T.GATE) return null;
  const stone = (cx, cy) => get(g, cx, cy) === T.OBSIDIAN;
  if (!stone(x - 1, y) || !stone(x + 1, y) || !stone(x - 1, y - 1) || !stone(x + 1, y - 1) || !stone(x, y - 2)) return null;
  const s = isSolid(get(g, x + 2, y)) && !isSolid(get(g, x - 2, y)) ? -1 : 1;
  return {
    name: 'gatetrap', label: 'Oops, walled myself in! Breaking out of the gate',
    run(g) {
      m.act = {type: 'place', t: 0, fn: () => {
        for (const cy of [y, y - 1]) { setTile(g, x + s, cy, T.AIR); add(g, 'obsidian', 1); }
        m.buildSkip = {};
        logEvent(g, 'Broke out of the unfinished gate');
      }};
      return 'done';
    }
  };
}

// ---------- trips ----------
const foodCount = m => { let n = 0; for (const k in FOOD) n += cnt(m, k); return n; };
const atGate = (m, gate) => Math.abs(m.x - gate.x) <= 2 && Math.abs(m.y - gate.y) <= 2;
function stepThrough(fn) {
  return {name: 'gate', label: 'Stepping through the gate', run(g) { g.m.act = {type: 'craft', t: 0, item: null, fn: () => fn(g)}; return 'done'; }};
}
// on the journey every camp's gate opens on fresh ground, and so does the same gate after a long stay, so the miner
// never wears the place out. A pack still lying down there holds it back until the miner has fetched it
const UNDER_RENEW_DAYS = 12;
function renewUnder(g) {
  const m = g.m, j = m.journey, u = g.other;
  const old = u && u.w.ver !== UNDER_VER; // made by an older version of the game: it has grown since
  const due = u && j && (m.underCamp !== j.camps || g.day - (m.underDay || 0) >= UNDER_RENEW_DAYS) && !Object.keys(u.w.graves).length;
  if (j && (!u || old || due)) { m.underCamp = j.camps; m.underDay = g.day; }
  if (!old && !due) return false;
  g.other = makeUnderState(g, (u.w.era || 0) + (due ? 1 : 0));
  logEvent(g, 'The Underworld has changed since the last visit');
  return true;
}
// pack up, walk to the gate, go. `want` is how much cinderite to come back with
function tripJob(g, want, chain) {
  const m = g.m;
  if (!gateStands(g) || g.tick < (m.gateHold || 0)) return null;
  if (foodCount(m) < 4) { const j = foodJob(g); if (j) return j; }
  { const j = need(g, 'torch', 12, chain) || need(g, 'cobble', 24, chain); if (j) return j; }
  if (want === 0 || m.journey) { const j = need(g, 'cobble', 40, chain); if (j) return j; } // a long walk means a lot of gaps to bridge, and a gate up in the air is a climb to get back to
  if (!atGate(m, m.gate)) return gotoJob(g, 'Walking to the Underworld gate', m.gate.x, m.gate.y, 2);
  return stepThrough(g => {
    const renewed = renewUnder(g);
    g.stats.underTrips = (g.stats.underTrips || 0) + 1;
    m.underWant = Math.max(want, cnt(m, 'raw_cinderite') + 24); m.tripStart = g.tick; m.leaveStart = 0;
    m.tripNeed = want; m.trekFails = 0;
    switchRealm(g, 'under', g.other ? g.other.w.gate.x + 2 : UNDER_GATE_X + 2, g.other ? g.other.w.gate.y : UNDER_GATE_Y);
    clearLanding(g);
    sfx(g, 'gate', m.x, m.y);
    milestone(g, 'underworld', 'Entered the Underworld');
    logEvent(g, 'Stepped through the gate into the Underworld');
    m.thought = renewed ? 'This isn\u2019t the Underworld I left' : 'So this is the Underworld';
  });
}
// an old pillar can be standing right where the gate lets out: never arrive inside it
function clearLanding(g) {
  const m = g.m;
  for (const y of [m.y, m.y - 1]) {
    const t = get(g, m.x, y);
    if (isSolid(t) && t !== T.OBSIDIAN && t !== T.GATE && t !== T.CHEST && t !== T.BEDROCK) setTile(g, m.x, y, T.AIR);
  }
}
function leaveUnder(g) {
  const m = g.m, c = m.gate;
  switchRealm(g, 'over', c.x + 2, c.y);
  const gy = groundAt(g, c.x + 2, c.y);
  if (gy !== null) m.y = m.py = gy;
  clearLanding(g);
  sfx(g, 'gate', m.x, m.y);
  if (g.tick - (m.tripStart || 0) < 30 * TPS) m.gateHold = g.tick + DAY / 2; // turned straight round: no sense going back at once
  logEvent(g, 'Came back from the Underworld with ' + cnt(m, 'raw_cinderite') + ' raw cinderite');
}
// ---------- exploring the Underworld ----------
const quested = (m, id) => !!(m.quest && m.quest[id]);
function markQuest(g, id, text) {
  const m = g.m;
  m.quest = m.quest || {};
  if (m.quest[id]) return;
  m.quest[id] = true;
  milestone(g, id, text);
}
// the first unfinished thing that has to happen down here (null: nothing left, go home)
function underAim(g) {
  for (const G of GOALS) if ((G.id.startsWith('cinder') || G.id.startsWith('q_')) && !G.done(g, g.m)) return G.id;
  return null;
}
const QUEST_PLACES = {q_ember: [210, 'Reached the Emberwood', 'the Emberwood'], q_shard: [398, 'Reached the Shardfall', 'the Shardfall'], q_sea: [447, 'Stood on the shore of the Cinder Sea', 'the Cinder Sea'],
  q_wastes: [120, 'Crossed into the Hollow Wastes', 'the Hollow Wastes'], q_citadel: [66, 'Found the Ashen Citadel', 'the Ashen Citadel']};
// a long walk in short legs: anything in the way gets bridged, climbed or dug through
function trekJob(g, tx, where, ty) {
  const m = g.m;
  return {
    name: 'trek', label: 'Exploring: heading for ' + where, to: {x: tx, y: ty},
    run(g) {
      const there = (x, y) => ty === undefined ? Math.abs(x - tx) <= 2 : Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1;
      if (there(m.x, m.y)) return 'done';
      const away = (x, y) => Math.abs(x - tx) * 5 + (ty === undefined ? 0 : Math.abs(y - ty) * 5);
      const p = findPath(g, {goal: there, h: away, maxNodes: 9000, range: 45, partial: true});
      if (!p || !p.length || away(p[p.length - 1].x, p[p.length - 1].y) >= away(m.x, m.y)) { m.trekFails = (m.trekFails || 0) + 1; return 'fail'; }
      m.trekFails = 0;
      m.path = p.slice(0, 24);
      return 'run';
    }
  };
}
function nearestTile(g, tile) {
  const m = g.m;
  let best = null, bd = INF;
  for (let k = 0; k < W * H; k++) if (g.w.t[k] === tile && !blacklisted(g, k)) {
    const x = k % W, y = (k / W) | 0, d = Math.abs(x - m.x) + Math.abs(y - m.y);
    if (d < bd) { bd = d; best = {x, y}; }
  }
  return best;
}
function emberJob(g, n) {
  const m = g.m;
  return collectJob(g, 'emberfruit', n, [T.EMBERLEAF], 'Picking emberfruit', {find: g => scanTiles(g, [T.EMBERLEAF], 45, 18), fallback: () => 'fail'});
}
function glimmerJob(g, n) {
  return collectJob(g, 'glimmer', n, [T.GLIMMER], 'Mining glimmer', {find: g => scanTiles(g, [T.GLIMMER], 45, 20), fallback: () => 'fail'});
}
function wakeWarden(g) {
  const c = g.w.citadel;
  if (g.monsters.some(e => e.type === 'warden')) return;
  g.monsters.push({type: 'warden', x: c.boss.x, y: c.boss.y, px: c.boss.x, py: c.boss.y, hp: MON.warden.hp, moveT: 0, from: null, cd: 40, facing: 1, hurt: 0});
}
function doorJob(g) {
  const m = g.m, c = g.w.citadel.door;
  return {
    name: 'door', label: 'Fitting the Warden key',
    run(g) {
      m.act = {type: 'craft', t: 0, item: null, fn: () => {
        take(m, 'ward_key', 1);
        setTile(g, c.x, c.y, T.AIR); setTile(g, c.x, c.y - 1, T.AIR);
        wakeWarden(g);
        sfx(g, 'growl', c.x, c.y, 'warden');
        markQuest(g, 'q_open', 'Opened the Ashen Citadel');
      }};
      return 'done';
    }
  };
}
function wardenFell(g, e) {
  add(g, 'ember_crown', 1);
  markQuest(g, 'q_warden', 'Defeated the Ember Warden');
  logEvent(g, 'Took the Ember crown from the fallen Warden');
}
// the end of the story: the crown goes home and the pickaxe comes off. The page shows the end screen when it sees stats.retired
function retireJob(g) {
  const m = g.m, h = m.home;
  m.homeStart = m.homeStart || g.tick;
  if ((Math.abs(m.x - h.x) > 3 || Math.abs(m.y - h.y) > 3) && g.tick - m.homeStart < 6000) return gotoJob(g, 'Carrying the Ember crown home', h.x, h.y, 3);
  return {
    name: 'retire', label: 'Hanging up the pickaxe',
    run(g) {
      m.act = {type: 'craft', t: 0, item: null, fn: () => {
        g.stats.retired = g.tick; g.stats.retiredDay = g.day;
        markQuest(g, 'q_home', 'Brought the Ember crown home');
        logEvent(g, 'Hung up the pickaxe. What a life.');
        writeDiary(g, g.day, true);
      }};
      return 'done';
    }
  };
}
function underJob(g) {
  const m = g.m, gate = g.w.gate, current = g.w.ver === UNDER_VER, spot = current ? g.w.citadel : null;
  let aim = underAim(g);
  const digging = aim && aim.startsWith('cinder') || cnt(m, 'raw_cinderite') < (m.tripNeed || 0); // came for cinderite (a repair, say): fetch it first
  if (aim === 'q_key' && cnt(m, 'glimmer') < RECIPES.ward_key.in.glimmer) aim = 'q_glimmer'; // lost some on the way
  const done = !aim || aim === 'q_key' || aim === 'q_home' || !current || (aim === 'q_open' || aim === 'q_warden') && !spot;
  const out = digging ? m.underWant === undefined || cnt(m, 'raw_cinderite') >= m.underWant : done;
  const spent = g.tick - (m.tripStart || 0) > DAY * (digging ? 1.5 : 4), hungry = foodCount(m) === 0 && (m.hunger <= 8 || m.hp <= 8);
  // live off the land where there's fruit to be had
  if (quested(m, 'q_open') && tier(m) >= P[T.GLIMMER].tier && cnt(m, 'glimmer') < 2 && !cnt(m, 'glow_broth') && scanTiles(g, [T.GLIMMER], 14, 8).length) { m.chain = ['Glimmer for glow broth']; return glimmerJob(g, 2); } // a couple from close by, for the broth
  if (!out && foodCount(m) < 3 && scanTiles(g, [T.EMBERLEAF], 30, 14).length) { m.chain = ['Pick something to eat']; return emberJob(g, cnt(m, 'emberfruit') + 5); }
  if ((m.trekFails || 0) >= 6 && aim && aim !== 'q_open' && aim !== 'q_warden' && aim !== 'q_key' && !digging) { // no way through: don't let one spot hold everything up
    m.trekFails = 0;
    markQuest(g, aim, 'Gave up on: ' + (GOALS.find(G => G.id === aim) || {label: aim}).label.toLowerCase());
  }
  if (out || spent || hungry || tier(m) < P[T.CINDERITE].tier || (m.trekFails || 0) >= 6) {
    m.chain = ['Head back to the gate'];
    m.leaveStart = m.leaveStart || g.tick;
    if (atGate(m, gate)) { m.trekFails = 0; return stepThrough(leaveUnder); }
    if (g.tick - m.leaveStart > 3000 + Math.abs(m.x - gate.x) * 30) { // cut off from the gate: there's always some crack leading home, if a long way round
      logEvent(g, 'Found a crack in the rock and climbed home');
      m.trekFails = 0;
      return stepThrough(leaveUnder);
    }
    return gotoJob(g, 'Heading back to the gate', gate.x, gate.y, 2);
  }
  m.leaveStart = 0;
  { const j = spawnerJob(g); if (j) { m.chain = ['Clear the vault']; return j; } }
  const loot = lootJob(g);
  if (loot) return loot;
  if (digging) {
    m.chain = ['Dig cinderite'];
    return gatherJob(g, 'raw_cinderite', m.underWant) || wanderJob(g);
  }
  // blocks run out on a long walk, and every gap wants some
  if (blocksAvail(m) < 10) { m.chain = ['Keep blocks for bridging']; const j = gatherJob(g, 'cobble', cnt(m, 'cobble') + 24); if (j) return j; }
  m.chain = [(GOALS.find(G => G.id === aim) || {label: ''}).label];
  const place = QUEST_PLACES[aim];
  if (place) {
    if (Math.abs(m.x - place[0]) <= 6) { markQuest(g, aim, place[1]); return {name: 'look', label: 'Taking in ' + place[2], run(g) { m.act = {type: 'wait', t: 0, dur: 40}; return 'done'; }}; }
    return trekJob(g, place[0], place[2]);
  }
  if (aim === 'q_ruins') {
    m.ruinsSeen = m.ruinsSeen || [];
    const here = (g.w.ruins || []).find(x => Math.abs(m.x - x - 4) <= 6 && Math.abs(m.y - g.w.ruinY[x]) <= 6 && !m.ruinsSeen.includes(x));
    if (here !== undefined) m.ruinsSeen.push(here);
    const left = (g.w.ruins || []).filter(x => !m.ruinsSeen.includes(x)).sort((a, b) => Math.abs(a - m.x) - Math.abs(b - m.x));
    if (m.ruinsSeen.length >= 4 || !left.length) { markQuest(g, 'q_ruins', 'Searched the old watchtowers'); return wanderJob(g); }
    return trekJob(g, left[0] + 4, 'an old watchtower', g.w.ruinY[left[0]]);
  }
  if (aim === 'q_vaults') {
    const deep = (g.w.spawners || []).filter(s => s.y > 90), left = deep.filter(s => get(g, s.x, s.y) === T.SPAWNER).sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x));
    if (deep.length - left.length >= 3 || !left.length) { markQuest(g, 'q_vaults', 'Cleared the deep vaults'); return wanderJob(g); }
    return trekJob(g, left[0].x, 'a deep vault', left[0].y);
  }
  if (aim === 'q_fruit') {
    const tree = nearestTile(g, T.EMBERLEAF);
    if (cnt(m, 'emberfruit') >= 8 || !tree) { markQuest(g, 'q_fruit', 'Tasted emberfruit'); return wanderJob(g); }
    if (scanTiles(g, [T.EMBERLEAF], 45, 18).length) return emberJob(g, 8);
    return trekJob(g, tree.x, 'the Emberwood', tree.y);
  }
  if (aim === 'q_glimmer') {
    const want = RECIPES.ward_key.in.glimmer + 2; // two over, for glow broth
    if (cnt(m, 'glimmer') >= want) { markQuest(g, 'q_glimmer', 'Mined glimmer crystals'); return wanderJob(g); }
    if (scanTiles(g, [T.GLIMMER], 45, 20).length) return glimmerJob(g, want);
    const shard = nearestTile(g, T.GLIMMER); // it may be far overhead after a long dig: go by the crystal, not just the column
    if (!shard) { markQuest(g, 'q_glimmer', 'Mined the last of the glimmer'); return wanderJob(g); }
    return trekJob(g, shard.x, 'the Shardfall', shard.y);
  }
  if (aim === 'q_open') {
    if (cnt(m, 'ward_key') < 1) return leaveFor(g);
    if (Math.abs(m.x - spot.door.x) <= 3 && Math.abs(m.y - spot.door.y) <= 3) return doorJob(g);
    return trekJob(g, spot.door.x + 1, 'the Citadel door', spot.door.y);
  }
  if (aim === 'q_warden') {
    wakeWarden(g);
    const e = g.monsters.find(q => q.type === 'warden');
    return trekJob(g, e.x + 2, 'the Ember Warden', e.y);
  }
  return wanderJob(g);
}
function leaveFor(g) { g.m.tripStart = -1e9; return wanderJob(g); } // nothing more to do on this trip: the next think heads home
