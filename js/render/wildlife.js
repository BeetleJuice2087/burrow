// Burrow render · wildlife.js — The overworld's small life: animals on the ground, birds, butterflies, fireflies, fish and bats.
// All of it lives in the renderer: nothing here touches the sim or g.rng, so it can't change how a run plays out.
// Animals belong to a stretch of land (the seed picks who lives where); the rest is worked out from the clock each frame.
'use strict';

const WILD_CHUNK = 16;
const hopRows = ['....p.p.', '....e.e.', '....eee.', '...eeEe.', '.eeeeee.', 'peeeeee.', '.eeeeee.', '..f..f..'];
const WILD_KINDS = {
  thistlehop: {speed: 2.4, hop: 0.34, rows: hopRows, pal: {p: '#9a6ac8', e: '#c9a06e', E: '#1d1d24', f: '#7a5a3a'}},
  frosthop: {speed: 2.4, hop: 0.34, rows: hopRows, pal: {p: '#7ab8e0', e: '#e8eef4', E: '#1d1d24', f: '#a8b4c0'}},
  bristlet: {speed: 0.9, rows: ['........', '........', '..q.q.q.', '.qQqQqQ.', 'qQqQqQss', 'qqQqQqsE', '.qqqqsss', '..f..f..'], pal: {q: '#4a6a3a', Q: '#7a9a4a', s: '#d8b890', E: '#1d1d24', f: '#7a5a3a'}},
  woolhorn: {speed: 1.2, rows: ['......hh', '.....h..', '.wwwwwww', 'wWwwWwEs', 'wwWwwwss', 'wwwwww..', '.w..w...', '.d..d...'], pal: {h: '#5a86b8', w: '#e4e0d8', W: '#c8c4c0', E: '#1d1d24', s: '#b8a498', d: '#6a6470'}},
  shellback: {speed: 0.45, rows: ['........', '........', '........', '..cCCc..', '.cCddCc.', 'cCddddCg', 'ccCCCCgE', '.gg..gg.'], pal: {c: '#a8743c', C: '#d0a058', d: '#e8c880', g: '#8a9a5a', E: '#1d1d24'}},
  skitter: {speed: 3.2, rows: ['........', '........', '........', '........', '......ss', 'sst.ssEs', '..sssss.', '..s..s..'], pal: {s: '#c87a3a', t: '#e8a858', E: '#1d1d24'}},
  pondlet: {speed: 1.8, hop: 0.5, night: true, rows: ['........', '........', '........', '.....GE.', '..GGGGG.', '.GoGGGGG', 'GGGGGoG.', 'f.f..f.f'], pal: {G: '#4a9a4a', o: '#e88a3a', E: '#1d1d24', f: '#2e6a3a'}}
};
// a cave bat: three flaps of the wings, and hanging up asleep with them folded
const BAT_PAL = {w: '#7c6696', W: '#ac96c4', b: '#927ea4', B: '#c4b2cc', E: '#fff0a0', f: '#fffaf0'};
const BAT_ROWS = {
  up: ['w...........w', 'ww...b.b...ww', 'wWw..bbb..wWw', 'wWWwbEbEbwWWw', '.wWWbbbbbWWw.', '..wwbfBfbww..', '.....bBb.....', '......b......', '.............'],
  level: ['.............', '.....b.b.....', '.....bbb.....', '.wwwbEbEbwww.', 'wWWWbbbbbWWWw', 'wWwWbfBfbWwWw', 'w.w.wbBbw.w.w', '......b......', '.............'],
  down: ['.............', '.....b.b.....', '.....bbb.....', '....bEbEb....', '..wwbbbbbww..', '.wWWbfBfbWWw.', 'wWWw.bBb.wWWw', 'wWw...b...wWw', 'w...........w'],
  roost: ['.....b.b.....', '....wwbww....', '...wWwbwWw...', '...wWbBbWw...', '...wWbBbWw...', '...wbEbEbw...', '....wbbbw....', '.....b.b.....', '.............']
};
const WILD_BIOME = [['woolhorn', 'woolhorn', 'frosthop'], ['thistlehop', 'bristlet', 'thistlehop'], ['thistlehop', 'thistlehop', 'bristlet'], ['shellback', 'skitter', 'skitter'], ['pondlet', 'bristlet', 'bristlet'], ['skitter', 'shellback', 'skitter'], ['thistlehop', 'bristlet', 'bristlet'], ['woolhorn', 'skitter', 'thistlehop']];
const WILD_GROUND = new Set([T.GRASS, T.DIRT, T.SAND, T.SNOW, T.SANDSTONE, T.STONE]);
const WINGS = ['#f0a040', '#e86a8a', '#6ab0f0', '#f0e070', '#b08af0'];
const WILD_SPR = {};
const wildHash = (seed, a, b) => { let h = (seed ^ Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663)) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return (h ^ h >>> 16) >>> 0; };
function wildSprites() {
  if (WILD_SPR.thistlehop) return;
  for (const k in WILD_KINDS) { const c = art(WILD_KINDS[k].rows, WILD_KINDS[k].pal); WILD_SPR[k] = [c, flip(c)]; }
  for (const k in BAT_ROWS) WILD_SPR['bat_' + k] = art(BAT_ROWS[k], BAT_PAL);
}
// how far the world has slid on the endless journey, so land keeps its animals when it moves
const wildOff = g => g.m.journey ? g.m.journey.off : 0;
// the ground under any trees
function wildFloor(g, x) {
  let y = g.w.top[x];
  while (y < B.H - 1 && (B.get(g, x, y) === T.LEAVES || B.get(g, x, y) === T.PINE || B.get(g, x, y) === T.LOG)) y++;
  return y;
}
// who lives on this stretch of land
function wildResidents(g, cx) {
  const r = mulberry(wildHash(g.seed, cx + Math.floor(wildOff(g) / WILD_CHUNK), 7)), out = [], x0 = cx * WILD_CHUNK;
  if (x0 < 0 || x0 + WILD_CHUNK >= B.W) return out;
  const settle = (kind, x) => {
    for (let y = g.w.top[x], n = 0; n < 12; y++, n++) {
      const t = B.get(g, x, y);
      if (t === T.WATER || t === T.LAVA) return;
      if (WILD_GROUND.has(t)) { if (!B.isSolid(B.get(g, x, y - 1))) out.push({kind, x: x + 0.5, y: y - 1, py: y - 1, home: x, dir: r() < 0.5 ? -1 : 1, wait: r() * 3, walk: 0, run: 0, phase: 0}); return; }
    }
  };
  if (r() < 0.85) for (let i = 1 + Math.floor(r() * 3); i > 0; i--) { const L = WILD_BIOME[g.w.biome[x0]] || WILD_BIOME[1]; settle(L[Math.floor(r() * L.length)], x0 + Math.floor(r() * WILD_CHUNK)); }
  for (let x = x0; x < x0 + WILD_CHUNK; x++) { // the edge of any pond gets frogs
    if (B.get(g, x, g.w.top[x]) === T.WATER && B.get(g, x - 1, g.w.top[x - 1]) !== T.WATER) { settle('pondlet', x - 1); if (r() < 0.5) settle('pondlet', Math.max(0, x - 2)); break; }
  }
  return out;
}
function wildStep(g, a, dt, day) {
  const K = WILD_KINDS[a.kind], m = g.m;
  if (B.isSolid(B.get(g, Math.floor(a.x), a.y))) a.y = a.py = g.w.top[Math.floor(a.x)] - 1; // built over or buried: back to the surface
  { // nothing underfoot (dug away, or the land changed): drop until something is
    const c = Math.floor(a.x), under = B.get(g, c, a.y + 1);
    if (!B.isSolid(under) && under !== T.WATER && under !== T.LAVA && a.y < B.H - 2) a.y++;
  }
  if (!m.dead && Math.abs(a.x - m.x) < 6 && Math.abs(a.y - m.y) < 4) { a.dir = a.x >= m.x ? 1 : -1; a.run = 1; a.wait = 0; a.walk = 0.5; }
  a.run = Math.max(0, a.run - dt);
  a.py += (a.y - a.py) * Math.min(1, dt * 14);
  if (!a.run && day < 0.3 && !K.night) { a.moving = false; return; } // asleep
  if (a.wait > 0) { a.wait -= dt; a.moving = false; if (a.wait <= 0) { a.walk = 0.6 + Math.random() * 2.2; if (Math.random() < 0.5) a.dir = -a.dir; } return; }
  a.walk -= dt;
  if (a.walk <= 0) { a.wait = 1 + Math.random() * 5; a.moving = false; return; }
  if (!a.run && Math.abs(a.x - a.home) > 10) a.dir = a.x > a.home ? -1 : 1;
  const v = K.speed * (a.run ? 2.2 : 1), nx = a.x + a.dir * v * dt, c = Math.floor(nx);
  a.moving = true; a.phase += dt * v * 3.2;
  if (c === Math.floor(a.x)) { a.x = nx; return; }
  let y = a.y;
  const open = (cx, cy) => { const t = B.get(g, cx, cy); return !B.isSolid(t) && t !== T.WATER && t !== T.LAVA; };
  if (!open(c, y)) y = open(c, y - 1) ? y - 1 : NaN;
  else while (y < a.y + 3 && open(c, y + 1)) y++;
  if (y !== y || !B.isSolid(B.get(g, c, y + 1))) { a.dir = -a.dir; a.wait = a.run ? 0 : 0.5; return; } // a wall, a drop or water: turn round
  a.x = nx; a.y = y;
}
Renderer.prototype.wildClock = function (now, still) {
  const dt = Math.min(0.1, Math.max(0, (now - (this.wildLast || now)) / 1000));
  this.wildLast = now;
  this.wildDt = still ? 0 : dt;
  this.wildT = (this.wildT || 0) + this.wildDt * 1000;
};
// behind the land: flocks crossing the sky
Renderer.prototype.drawBirds = function (g, ctx, sx, sy, ts, x0, x1, left, viewW, day) {
  if (day < 0.5) return;
  const t = this.wildT, u = Math.max(1, Math.round(ts / 16));
  let sky = B.H;
  for (let x = Math.max(0, x0); x <= Math.min(B.W - 1, x1); x++) sky = Math.min(sky, g.w.top[x]);
  ctx.fillStyle = 'rgba(38,36,52,0.8)';
  for (let f = 0; f < 3; f++) {
    const hash = wildHash(g.seed, f, 3), span = 40000 + hash % 30000, trip = Math.floor(t / span + hash / 997);
    const p = t / span + hash / 997 - trip, rnd = wildHash(g.seed, f, trip);
    if (rnd % 5 < 2 + f) continue; // an empty sky now and then, and seldom more than one flock
    const dir = rnd & 8 ? 1 : -1, n = 3 + rnd % 5, cx = left + viewW * (dir > 0 ? p : 1 - p) * 1.3 - viewW * 0.15, cy = sky - 6 - (rnd >> 4) % 8 + Math.sin(t / 3000 + f) * 0.6;
    for (let i = 0; i < n; i++) { // loose V
      const side = i % 2 ? 1 : -1, rank = (i + 1) >> 1, bx = sx(cx - dir * rank * 1.2), by = sy(cy + side * rank * 0.5), up = Math.sin(t / 130 + i * 1.7) > 0 ? -u : u;
      ctx.fillRect(bx - u * 2, by + up, u * 2, u); ctx.fillRect(bx + u, by + up, u * 2, u); ctx.fillRect(bx, by, u, u);
    }
  }
};
// in the world, with the critters: animals on the ground, butterflies, fish and cave bats
// the animals already out and about slide along with their land
// Bats. Drawn only: nothing here is saved or touches the sim, so a reload just puts them back on their first perches
const BAT_SPOTS = 40, BAT_REST = 26, BAT_RANGE = 45, BAT_SEARCH = 2600, BAT_ROOM = 3, BAT_FADE = 0.8;
const batOpen = (g, x, y) => { const t = B.get(g, x, y); return !B.isSolid(t) && t !== T.WATER && t !== T.LAVA; };
// spreads out through the open air from the bat, so anywhere it finds can be flown to without touching a wall. Picks a perch on the
// roof, sometimes one of the nearest, sometimes one of the furthest, and returns the cells to fly through
function batRoute(g, a, bats) {
  const W = B.W, sx0 = Math.floor(a.x), sy0 = Math.floor(a.y), start = sy0 * W + sx0;
  const from = new Map([[start, -1]]), queue = [start], perches = [];
  for (let i = 0; i < queue.length && queue.length < BAT_SEARCH; i++) {
    const k = queue[i], x = k % W, y = (k / W) | 0;
    if (Math.abs(x - sx0) + Math.abs(y - sy0) >= 5 && B.isSolid(B.get(g, x, y - 1)) && !bats.some(o => o !== a && Math.floor(o.x) === x && Math.floor(o.y) === y)) perches.push(k);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy, nk = ny * W + nx;
      if ((!dx && !dy) || from.has(nk) || nx < 2 || nx >= W - 2 || ny < 2 || Math.abs(nx - sx0) > BAT_RANGE || !g.seen[nk] || !batOpen(g, nx, ny)) continue;
      if (dx && dy && (!batOpen(g, nx, y) || !batOpen(g, x, ny))) continue; // no squeezing between two corners
      from.set(nk, k); queue.push(nk);
    }
  }
  if (perches.length < BAT_ROOM) return null; // a pocket with nowhere much to go
  const share = Math.ceil(perches.length / 3), near = Math.random() < 0.5; // found nearest first
  let k = perches[near ? Math.floor(Math.random() * share) : perches.length - 1 - Math.floor(Math.random() * share)];
  const path = [];
  for (; k !== start; k = from.get(k)) path.push(k);
  return path.reverse();
}
// somewhere with room to fly, in a cave the miner has seen
function batNewHome(g, a, bats) {
  const near = Math.floor(a.x);
  for (let i = 0; i < 8; i++) {
    const x = clamp(near + Math.floor((Math.random() - 0.5) * 140), 3, B.W - 4);
    for (let y = g.w.top[x] + 5 + Math.floor(Math.random() * 40); y < B.H - 3; y++) {
      if (!g.seen[y * B.W + x] || !batOpen(g, x, y) || !B.isSolid(B.get(g, x, y - 1))) continue;
      if (batRoute(g, {x: x + 0.5, y: y + 0.5}, bats)) return {x, y};
      break;
    }
  }
  return null;
}
function batStep(g, a, dt, bats) {
  const W = B.W, cx = Math.floor(a.x), cy = Math.floor(a.y);
  if (a.arriving > 0) a.arriving -= dt;
  if (a.leaving > 0) { // boxed in: it fades away here and turns up somewhere with room
    a.leaving -= dt;
    if (a.leaving > 0) return;
    const home = batNewHome(g, a, bats);
    a.stuck = 0;
    if (!home) { a.wait = 6; return; } // nowhere yet: try again once the miner has seen more
    a.x = home.x + 0.5; a.y = home.y + 0.5; a.vx = a.vy = 0; a.arriving = BAT_FADE; a.wait = 3 + Math.random() * BAT_REST;
    return;
  }
  if (!a.path) {
    a.wait = B.isSolid(B.get(g, cx, cy - 1)) ? a.wait - dt : 0; // the roof it hung from got dug away: off it goes
    if (a.wait > 0) return;
    a.path = batRoute(g, a, bats); a.step = 0; a.flown = 0; a.speed = 4 + Math.random() * 3.5;
    if (a.path) { a.stuck = 0; return; }
    a.wait = 1 + Math.random() * 2;
    a.stuck = (a.stuck || 0) + 1;
    if (a.stuck >= 2) a.leaving = BAT_FADE;
    return;
  }
  const end = a.step >= a.path.length - 1;
  let k = a.path[a.step], tx = k % W + 0.5, ty = ((k / W) | 0) + 0.5, d = Math.hypot(tx - a.x, ty - a.y);
  if (!end && d < 0.8) { a.step++; k = a.path[a.step]; tx = k % W + 0.5; ty = ((k / W) | 0) + 0.5; d = Math.hypot(tx - a.x, ty - a.y); }
  a.flown += dt;
  if (!batOpen(g, k % W, (k / W) | 0) || a.flown > 30) { a.path = null; a.wait = 0; return; } // a block went in the way: pick somewhere else
  if (end && d < 0.25) { a.x = tx; a.y = ty; a.vx = a.vy = 0; a.path = null; a.wait = 5 + Math.random() * BAT_REST; return; }
  const swoop = Math.sin(a.flown * 7 + a.bob) * 0.8, turn = Math.min(1, dt * 9), speed = end ? Math.max(1.5, a.speed * Math.min(1, d)) : a.speed;
  a.vx += ((tx - a.x) / (d || 1) * speed - a.vx) * turn;
  a.vy += ((ty - a.y) / (d || 1) * speed + swoop - a.vy) * turn;
  const step = Math.min(dt, 0.08), nx = a.x + a.vx * step, ny = a.y + a.vy * step; // the walls stop it, one direction at a time, so it can't cut a corner
  if (batOpen(g, Math.floor(nx), cy)) a.x = nx; else a.vx = 0;
  if (batOpen(g, Math.floor(a.x), Math.floor(ny))) a.y = ny; else a.vy = 0;
}
Renderer.prototype.slideWild = function (dx) {
  const out = new Map();
  for (const [c, list] of this.wild || []) {
    const n = c - Math.round(dx / WILD_CHUNK);
    if (n < 0) continue;
    for (const a of list) { a.x -= dx; a.home -= dx; }
    out.set(n, list);
  }
  this.wild = out;
  for (const a of this.bats || []) { a.x -= dx; a.path = null; a.wait = 1; }
  this.pebbles = [];
};
Renderer.prototype.drawWild = function (g, ctx, sx, sy, ts, x0, x1, y0, y1, day) {
  wildSprites();
  if (this.wildSeed !== g.seed) { this.wildSeed = g.seed; this.wild = new Map(); }
  if (this.batWorld !== g.seed + (g.realm || 'over')) { this.batWorld = g.seed + (g.realm || 'over'); this.bats = []; this.batSpots = new Set(); }
  const t = this.wildT, dt = this.wildDt, u = Math.max(1, Math.round(ts / 16)), W = B.W;
  for (let c = Math.floor(x0 / WILD_CHUNK) - 1; c <= Math.floor(x1 / WILD_CHUNK) + 1; c++) {
    if (!this.wild.has(c)) this.wild.set(c, wildResidents(g, c));
    for (const a of this.wild.get(c)) {
      wildStep(g, a, dt, day);
      if (a.x < x0 - 1 || a.x > x1 + 1) continue;
      const K = WILD_KINDS[a.kind], lift = !a.moving ? 0 : K.hop ? Math.abs(Math.sin(a.phase)) * K.hop : (Math.floor(a.phase) % 2) / 16;
      ctx.drawImage(WILD_SPR[a.kind][a.dir > 0 ? 0 : 1], sx(a.x - 0.5), sy(a.py - lift), ts, ts);
    }
  }
  for (let x = Math.max(1, x0); x <= Math.min(W - 2, x1); x++) {
    const h = wildHash(g.seed, x + wildOff(g), 11), top = g.w.top[x];
    // butterflies keep to the flowers
    if (day > 0.4 && (h >>> 7) % 2 === 0 && (B.get(g, x, top - 1) === T.FLOWER || B.get(g, x, top) === T.FLOWER)) {
      const bx = x + 0.5 + Math.sin(t / 1300 + h) * 1.5 + Math.sin(t / 430 + h) * 0.25, by = top - 1.4 + Math.sin(t / 900 + h * 2) * 0.7 + Math.sin(t / 310 + h) * 0.12;
      const open = Math.sin(t / 70 + h) > 0;
      ctx.fillStyle = WINGS[h % WINGS.length];
      ctx.fillRect(sx(bx) - (open ? u * 2 : u), sy(by) - u, open ? u * 2 : u, u * 2); ctx.fillRect(sx(bx) + u, sy(by) - u, open ? u * 2 : u, u * 2);
      ctx.fillStyle = '#2a2430'; ctx.fillRect(sx(bx), sy(by) - u, u, u * 2);
    }
    // fish in the ponds
    if ((h >>> 7) % 4 === 0 && B.get(g, x, top) === T.WATER && B.get(g, x, top + 1) === T.WATER) {
      let lo = x, hi = x; const y = top + 1;
      while (x - lo < 12 && B.get(g, lo - 1, y) === T.WATER) lo--;
      while (hi - x < 12 && B.get(g, hi + 1, y) === T.WATER) hi++;
      const s = Math.sin(t / 2800 + h), fx = lo + 0.4 + (hi - lo + 0.2) * (0.5 + 0.5 * s), d = Math.cos(t / 2800 + h) > 0 ? 1 : -1, fy = sy(y + 0.4 + (h % 4) * 0.12 + Math.sin(t / 600 + h) * 0.05);
      ctx.fillStyle = h % 2 ? '#f0a860' : '#c8d8e0';
      ctx.fillRect(sx(fx) - u * 2, fy, u * 4, u * 2); ctx.fillRect(sx(fx) - d * u * 3 - (d > 0 ? 0 : u), fy - u / 2, u, u * 3);
    }
    // a bat starts out where the cave roof suits one, and goes where it likes from there
    for (let y = Math.max(top + 5, y0); y <= Math.min(B.H - 3, y1); y++) {
      const b = wildHash(g.seed, x + wildOff(g), y), key = (x + wildOff(g)) * B.H + y;
      if (b % BAT_SPOTS || this.batSpots.has(key) || !batOpen(g, x, y) || !B.isSolid(B.get(g, x, y - 1)) || !g.seen[y * W + x]) continue;
      this.batSpots.add(key);
      this.bats.push({key, x: x + 0.5, y: y + 0.5, vx: 0, vy: 0, path: null, step: 0, wait: Math.random() * BAT_REST, flown: 0, phase: b % 4, bob: b % 9});
    }
  }
  for (const a of this.bats) {
    batStep(g, a, dt, this.bats);
    const cx = Math.floor(a.x), cy = Math.floor(a.y);
    if (a.x < x0 - 1 || a.x > x1 + 2 || a.y < y0 - 1 || a.y > y1 + 2 || !g.seen[cy * W + cx]) continue;
    ctx.globalAlpha = a.leaving > 0 ? a.leaving / BAT_FADE : a.arriving > 0 ? 1 - a.arriving / BAT_FADE : 1;
    if (a.path) ctx.drawImage(WILD_SPR['bat_' + ['up', 'level', 'down', 'level'][Math.floor(t / 65 + a.phase) % 4]], Math.round(sx(a.x) - u * 6.5), Math.round(sy(a.y) - u * 4.5), u * 13, u * 9);
    else ctx.drawImage(WILD_SPR.bat_roost, Math.round(sx(cx + 0.5) - u * 6.5), Math.round(sy(cy)), u * 13, u * 9); // hung by its feet from the roof
    ctx.globalAlpha = 1;
  }
  this.bats = this.bats.filter(a => { // gone too far from the view: another turns up here later
    if (a.x > x0 - 80 && a.x < x1 + 80 && batOpen(g, Math.floor(a.x), Math.floor(a.y))) return true;
    this.batSpots.delete(a.key);
    return false;
  });
};
// where one firefly has got to and how bright it is. Each has its own pace and its own blink, and two waves on each axis at
// rates of its own, so it curves round in any direction instead of swaying in step with the rest. a and b are its two hashes
function fireflyAt(a, b, t) {
  const n = (v, shift) => ((v >>> shift) & 255) / 255, pace = 0.35 + n(a, 0) * 0.8;
  const wave = (shift, slow, v) => Math.sin(t * pace * (0.7 + n(v, shift) * 0.7) / slow + n(v, shift + 4) * 40);
  const dx = wave(0, 1500, b) * 1.3 + wave(8, 640, b) * 0.6 + wave(16, 290, b) * 0.15;
  const dy = wave(4, 1150, a) * 0.8 + wave(12, 520, a) * 0.35 + wave(20, 240, a) * 0.1;
  const blink = 0.5 + 0.5 * Math.sin(t / (350 + n(a, 8) * 950) + n(a, 16) * 40);
  return {dx, dy, glow: Math.pow(blink, 2 + n(a, 24) * 4)}; // some give a quick flash, some a slow glow
}
// on top of the dark, because they make their own light
Renderer.prototype.drawFireflies = function (g, ctx, sx, sy, ts, x0, x1, day) {
  if (day > 0.5) return;
  const t = this.wildT, u = Math.max(2, Math.round(ts / 12));
  for (let x = Math.max(1, x0); x <= Math.min(B.W - 2, x1); x++) {
    const h = wildHash(g.seed, x + wildOff(g), 23), b = g.w.biome[x];
    if ((h >>> 7) % 2 || (b !== 1 && b !== 2 && b !== B.B_MIRE && b !== B.B_AMBER) || B.get(g, x, g.w.top[x]) === T.WATER) continue;
    const f = fireflyAt(wildHash(g.seed, x + wildOff(g), 24), wildHash(g.seed, x + wildOff(g), 25), t);
    const glow = f.glow * Math.min(1, (0.5 - day) * 3);
    if (glow < 0.04) continue;
    const fx = sx(x + 0.5 + f.dx), fy = sy(Math.min(wildFloor(g, clamp(Math.round(x + f.dx), 1, B.W - 2)) - 0.3, wildFloor(g, x) - 1.5 - h % 3 * 0.5 + f.dy));
    ctx.fillStyle = `rgba(190,240,90,${glow * 0.22})`; ctx.fillRect(fx - u * 1.5, fy - u * 1.5, u * 4, u * 4);
    ctx.fillStyle = `rgba(226,255,140,${glow})`; ctx.fillRect(fx, fy, u, u);
  }
};

// ---------- the trader's stall and the miner's pet ----------
const PET_ROWS = [['..HHH...', '.HHHHH..', '.bbbbbb.', 'bbEbbEbn', 'bbbbbbbn', 'bBBBBBb.', 'bBBBBBb.', '.f...f..'], ['..HHH...', '.HHHHH..', '.bbbbbb.', 'bbEbbEbn', 'bbbbbbbn', 'bBBBBBb.', 'bBBBBBb.', 'f.....f.']];
const PET_PAL = {H: '#e8b53c', b: '#7a5a48', B: '#a88468', E: '#1d1d24', n: '#e88a9a', f: '#4a3428'};
const TRADER_ROWS = ['..gGGg..', '.gGGGGg.', '.gSSSSg.', '.gSESSg.', '.gSSSSg.', 'pgGGGGg.', 'ppGGGGgl', 'ppGggGgL', 'ppGGGGg.', 'ppGGGGg.', 'pgGGGGg.', '.gGGGGg.', '.gGGGGg.', '.gGGGGg.', '.gGGGGg.', '.kk..kk.'];
const TRADER_PAL = {g: '#2e5a4a', G: '#3e7a62', S: '#d8b08a', E: '#1d1d24', p: '#8a5a34', l: '#6a5a40', L: '#ffd24a', k: '#3a2a20'};
Renderer.prototype.drawTrader = function (g, ctx, sx, sy, ts, now) {
  const t = g.trader;
  if (!t) return;
  if (!WILD_SPR.trader) WILD_SPR.trader = art(TRADER_ROWS, TRADER_PAL);
  ctx.drawImage(WILD_SPR.trader, sx(t.x), sy(t.y - 1), ts, ts * 2);
  // the pitch: a rug with the goods laid out
  const u = ts / 8, base = sy(t.y + 1);
  ctx.fillStyle = '#8a3a4a'; ctx.fillRect(sx(t.x + 1), base - u, ts * 2, u);
  for (const [i, c] of [[1, '#ffd24a'], [4, '#6ab0f0'], [7, '#e86a8a'], [11, '#a8e070'], [14, '#f0a040']]) { ctx.fillStyle = c; ctx.fillRect(sx(t.x + 1) + i * u, base - u * 2, u, u); }
};
// it trots along behind, on the ground the miner has already walked
Renderer.prototype.drawPet = function (g, ctx, sx, sy, ts) {
  const m = g.m, dt = this.wildDt;
  if (!m.pet) return;
  if (!WILD_SPR.pet) { const a = PET_ROWS.map(r => art(r, PET_PAL)); WILD_SPR.pet = [a, a.map(flip)]; }
  const realm = g.realm || 'over';
  let p = this.pet;
  if (!p || p.realm !== realm || Math.abs(p.x - m.x) + Math.abs(p.y - m.y) > 16) { // a new world, or the miner has been whisked away: catch straight up
    p = this.pet = {realm, x: m.x - 1.5 * m.facing, y: m.y, dir: m.facing || 1, trail: [], hop: 0};
    if (B.isSolid(B.get(g, Math.round(p.x), m.y))) p.x = m.x;
  }
  const bed = (m.sleeping || m.hiding) && petBedNear(g, m.x, m.y);
  if (bed) { // bedtime: off to its own bed, curled up, a z now and then
    const k = Math.min(1, dt * 3); p.x += (bed.x - p.x) * k; p.y += (bed.y - p.y) * k; p.trail = [];
    ctx.drawImage(WILD_SPR.pet[p.dir > 0 ? 0 : 1][0], sx(p.x), sy(p.y + 0.12), ts, ts);
    const z = (performance.now() / 1400) % 1;
    ctx.globalAlpha = 1 - z; ctx.fillStyle = '#e8e4f4'; ctx.font = `${Math.round(ts * (0.3 + z * 0.15))}px "Pixelify Sans", monospace`;
    ctx.fillText('z', sx(p.x + 0.7 + z * 0.3), sy(p.y - 0.1 - z * 0.6)); ctx.globalAlpha = 1;
    return;
  }
  const last = p.trail[p.trail.length - 1];
  if (!last || last.x !== m.x || last.y !== m.y) { p.trail.push({x: m.x, y: m.y}); if (p.trail.length > 12) p.trail.shift(); }
  let aim = null; // keep a few steps back, on a real floor that isn't filled in
  for (let i = p.trail.length - 3; i >= 0 && !aim; i--) { const c = p.trail[i]; if (!B.isSolid(B.get(g, c.x, c.y)) && B.isSolid(B.get(g, c.x, c.y + 1))) aim = c; }
  const moved = aim ? Math.abs(aim.x - p.x) + Math.abs(aim.y - p.y) : 0;
  if (aim && moved > 0.05) {
    const k = Math.min(1, dt * 7);
    if (Math.abs(aim.x - p.x) > 0.1) p.dir = aim.x > p.x ? 1 : -1;
    p.x += (aim.x - p.x) * k; p.y += (aim.y - p.y) * k; p.hop += dt * 14;
  } else p.hop = 0;
  const frame = moved > 0.05 ? Math.floor(p.hop / 2) % 2 : 0, lift = moved > 0.05 ? Math.abs(Math.sin(p.hop)) * 0.12 : 0;
  ctx.drawImage(WILD_SPR.pet[p.dir > 0 ? 0 : 1][frame], sx(p.x), sy(p.y - lift), ts, ts);
};
