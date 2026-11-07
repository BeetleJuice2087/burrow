// Burrow render · cavedecor.js — What makes a cave feel lived in: pots, rocks, pebbles, dripstones, vines, dust, and bits falling from the roof.
// Drawn only. Nothing here is saved or touches the sim: where things go comes from a hash of the seed, so it never blocks the miner and old worlds get it too.
'use strict';

const CAVE_SPR = {};
const CAVE_TONES = {grey: {L: '#92929c', M: '#70707a', D: '#4e4e58'}, deep: {L: '#6c6c80', M: '#50505e', D: '#383844'}, earth: {L: '#8e6e4e', M: '#6e5038', D: '#4c3828'}};
const POT_GLAZES = [{P: '#b8683a', p: '#8a4a28', k: '#5a3018', b: '#e0c080'}, {P: '#5a7088', p: '#3e5066', k: '#28384a', b: '#c8d4dc'},
  {P: '#b89a58', p: '#8a703c', k: '#5a4826', b: '#6a3a2a'}, {P: '#8a8478', p: '#66625a', k: '#42403a', b: '#b8683a'}];
const POT_SIZES = [[8, 8], [10, 12], [13, 15]], DRIP_LENGTHS = [6, 10, 15, 22, 30, 42]; // in sixteenths of a block
const NEEDS_ROOM = 3; // only caves this tall: the miner's own tunnels stay bare
// builds a picture once, the first time it's wanted
const caveSprite = (key, make) => CAVE_SPR[key] || (CAVE_SPR[key] = make());
function potArt(size, glaze) {
  const [w, h] = POT_SIZES[size], mid = (w - 1) / 2, neck = Math.max(1, w * 0.17), rows = [], band = Math.floor(h * 0.5);
  for (let r = 0; r < h; r++) {
    const f = Math.min(1, Math.max(0, (r / (h - 1) - 0.14) / 0.86)), half = r === 0 ? neck + 1 : r <= h * 0.12 ? neck : Math.max(neck, w / 2 * Math.pow(Math.sin(Math.PI * (0.12 + f * 0.8)), 0.7));
    let row = '';
    for (let i = 0; i < w; i++) {
      const d = i - mid;
      row += Math.abs(d) > half ? '.' : r === 0 ? 'k' : r === band ? 'b' : d > half * 0.3 ? 'p' : 'P';
    }
    rows.push(row);
  }
  return art(rows, POT_GLAZES[glaze]);
}
function rockArt(w, h, tone) {
  const rows = [], mid = (w - 1) / 2;
  for (let r = 0; r < h; r++) {
    const up = (h - 1 - r) / h, half = w / 2 * Math.sqrt(1 - up * up) * (r % 2 ? 1 : 0.9);
    let row = '';
    for (let i = 0; i < w; i++) { const d = i - mid; row += Math.abs(d) > half ? '.' : r === 0 || d < -half * 0.3 && r < h / 2 ? 'L' : d > half * 0.3 || r === h - 1 ? 'D' : 'M'; }
    rows.push(row);
  }
  return art(rows, CAVE_TONES[tone]);
}
// pointing down from a roof, or flipped to stand up from a floor
function dripArt(len, tone, standing) {
  const w = len >= 22 ? 7 : len >= 10 ? 5 : 3, mid = (w - 1) / 2, rows = [];
  for (let r = 0; r < len; r++) {
    const half = mid * Math.pow(1 - r / len, 0.75);
    let row = '';
    for (let i = 0; i < w; i++) { const d = i - mid; row += Math.abs(d) > half + 0.2 ? '.' : d < 0 ? 'L' : d > 0 ? 'D' : r % 5 === 4 ? 'D' : 'M'; }
    rows.push(row);
  }
  return art(standing ? rows.reverse() : rows, CAVE_TONES[tone]);
}
const pebbleArt = tone => art(['................', '...L.......M....', '..MMD..L..MD..L.', '..DD..MD.......D'], CAVE_TONES[tone]);
const caveTone = t => t === T.DEEP ? 'deep' : t === T.DIRT ? 'earth' : 'grey';
function caveRun(g, x, y, dir) { let n = 1; while (n < 7 && !B.isSolid(B.get(g, x, y + dir * n))) n++; return n; }
Renderer.prototype.drawCaveDecor = function (g, ctx, sx, sy, ts, x0, x1, y0, y1) {
  const W = B.W, tl = g.w.t, off = wildOff(g), t = this.wildT, p = ts / 16, surf = g.w.surf;
  for (let y = Math.max(2, y0); y <= Math.min(B.H - 3, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(W - 2, x1); x++) {
    const k = y * W + x;
    if (tl[k] !== T.AIR || !g.seen[k] || y <= surf[x] + 3 || (g.protect && g.protect.has(k))) continue;
    const h = wildHash(g.seed, x + off, y + 5000), r = (h >>> 8) % 100, at = (h >>> 16) % 8;
    if (h % 53 === 0) { // dust hanging in the air: it only shows where a light catches it
      ctx.fillStyle = '#e0d8c8'; ctx.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t / 900 + h));
      ctx.fillRect(sx(x + 0.5 + Math.sin(t / (3000 + h % 3000) + h) * 0.8), sy(y + 0.5 + Math.sin(t / (4000 + h % 2500) + h * 2) * 0.6), Math.ceil(p), Math.ceil(p));
      ctx.globalAlpha = 1;
    }
    const roof = B.isSolid(B.get(g, x, y - 1)), floor = B.isSolid(B.get(g, x, y + 1));
    if (floor && caveRun(g, x, y, -1) >= NEEDS_ROOM) {
      const tone = caveTone(B.get(g, x, y + 1)), base = sy(y + 1);
      if (r < 3) {
        const size = (h >>> 3) % 7 < 3 ? 0 : (h >>> 3) % 7 < 6 ? 1 : 2, glaze = (h >>> 12) % POT_GLAZES.length, [w, hh] = POT_SIZES[size];
        ctx.drawImage(caveSprite('pot' + size + glaze, () => potArt(size, glaze)), sx(x) + (16 - w) / 2 * p, base - hh * p, w * p, hh * p);
      } else if (r < 8) {
        const len = DRIP_LENGTHS[Math.min((h >>> 3) % 5, caveRun(g, x, y, -1) * 2 - 3)];
        ctx.drawImage(caveSprite('up' + len + tone, () => dripArt(len, tone, true)), sx(x) + at * p, base - len * p, (len >= 22 ? 7 : len >= 10 ? 5 : 3) * p, len * p);
      } else if (r < 14) {
        const big = (h >>> 3) % 3, w = 7 + big * 3, hh = 4 + big * 2;
        ctx.drawImage(caveSprite('rock' + big + tone, () => rockArt(w, hh, tone)), sx(x) + at / 2 * p, base - hh * p, w * p, hh * p);
      } else if (r < 28) ctx.drawImage(caveSprite('peb' + tone, () => pebbleArt(tone)), sx(x), base - 4 * p, 16 * p, 4 * p);
    } else if (roof) {
      const room = caveRun(g, x, y, 1);
      if (room < NEEDS_ROOM) continue;
      if (r < 9) {
        const tone = caveTone(B.get(g, x, y - 1)), len = DRIP_LENGTHS[Math.min((h >>> 3) % 6, room * 2 - 3)], w = len >= 22 ? 7 : len >= 10 ? 5 : 3;
        ctx.drawImage(caveSprite('down' + len + tone, () => dripArt(len, tone, false)), sx(x) + at * p, sy(y), w * p, len * p);
      } else if (r < 13 && y < 100) { // vines hang in the upper caves, swaying a little more toward the tip
        const long = Math.min(1 + (h >>> 3) % 5, room - 1) * 16, step = 2 * p;
        for (let i = 0; i < long; i += 2) {
          const sway = Math.sin(t / 1500 + h + i / 12) * i / 16 * p * 0.8;
          ctx.fillStyle = (i >> 1) % 3 ? '#3e7a3a' : '#2c5a30'; ctx.fillRect(sx(x + 0.5) + at * p / 2 + sway, sy(y) + i * p, p, step);
          if ((i + h) % 7 === 0) { ctx.fillStyle = '#5a9a48'; ctx.fillRect(sx(x + 0.5) + at * p / 2 + sway + ((i >> 1) % 2 ? p : -p), sy(y) + i * p, p, p); }
        }
      }
    }
  }
  this.cavePebbles(g, ctx, sx, sy, ts, x0, x1, y0, y1);
};
// Bits of the roof letting go now and then, more of them when something rumbles far off. Harmless: they never touch the miner
const PEBBLE_NEAR = 30, PEBBLE_UP = 12; // the least the roof sheds around the miner, across and up
Renderer.prototype.cavePebbles = function (g, ctx, sx, sy, ts, x0, x1, y0, y1) {
  const m = g.m, dt = this.wildDt, t = this.wildT, u = Math.max(1, Math.round(ts / 16)), under = m.y > g.w.surf[m.x] + 3;
  const list = this.pebbles = this.pebbles || [];
  const loose = (x, y, spread) => { // one spot on the roof lets go
    const px = x + Math.random(), wait = Math.random() * spread;
    for (let i = 1 + Math.floor(Math.random() * 3); i > 0; i--) list.push({x: px + (Math.random() - 0.5) * 0.5, y: y + 0.05, vx: (Math.random() - 0.5) * 0.5, vy: 0, wait: wait + Math.random() * 0.4, size: 1 + Math.floor(Math.random() * 3), hops: 0, rest: 0});
    list.push({x: px, y: y + 0.1, puff: 1, wait, vx: (Math.random() - 0.5) * 0.2, vy: 0.5});
  };
  const left = Math.min(x0, m.x - PEBBLE_NEAR), wide = Math.max(x1, m.x + PEBBLE_NEAR) - left + 1, top = Math.min(y0, m.y - PEBBLE_UP);
  const drop = (n, spread) => { // anywhere you can see, and always a good way around the miner
    for (let tries = 0; tries < n * 6 && n > 0; tries++) {
      const x = left + Math.floor(Math.random() * wide);
      for (let y = top + Math.floor(Math.random() * (y1 - top + 1)); y > top; y--) {
        if (B.get(g, x, y) !== T.AIR || !B.isSolid(B.get(g, x, y - 1))) continue;
        if (y > g.w.surf[x] + 3 && g.seen[y * B.W + x]) { loose(x, y, spread); n--; }
        break;
      }
    }
  };
  if (dt && under) {
    if (!this.nextPebble) { this.nextPebble = t + 4000; this.nextRumble = t + 30000 + Math.random() * 50000; }
    if (t >= this.nextPebble) { this.nextPebble = t + 1500 + Math.random() * 3500; drop(1 + Math.floor(wide / 30), 0); }
    if (t >= this.nextRumble) {
      this.nextRumble = t + 70000 + Math.random() * 110000;
      const loud = 1.2; // always a big one: the pitch, length and thuds are what change
      if (typeof Sound !== 'undefined') Sound.rumble(loud);
      drop(Math.round(wide * (0.5 + Math.random() * 0.25)), 3.5);
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (a.wait > 0) { a.wait -= dt; continue; }
    if (a.puff) { // a little dust where it came loose
      a.puff -= dt * 1.2; a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.puff <= 0) { list.splice(i, 1); continue; }
      ctx.fillStyle = '#c8c0b0'; ctx.globalAlpha = a.puff * 0.3; ctx.fillRect(sx(a.x) - u, sy(a.y) - u, u * 3, u * 3); ctx.globalAlpha = 1;
      continue;
    }
    if (a.rest > 0) { a.rest -= dt; if (a.rest <= 0) list.splice(i, 1); }
    else {
      a.vy += 12 * dt; a.x += a.vx * dt;
      const ny = a.y + a.vy * dt, tile = B.get(g, Math.floor(a.x), Math.floor(ny));
      if (tile === T.WATER || tile === T.LAVA) { list.splice(i, 1); continue; }
      if (B.isSolid(tile)) { a.y = Math.floor(ny) - 0.02; a.vy *= -0.3; a.vx *= 0.5; if (++a.hops >= 2) a.rest = 1.6; }
      else a.y = ny;
    }
    if (a.x < x0 - 1 || a.x > x1 + 2) continue;
    ctx.fillStyle = a.size > 1 ? '#8c8c96' : '#a8a8b2'; ctx.globalAlpha = a.rest > 0 ? Math.min(1, a.rest) : 1;
    ctx.fillRect(sx(a.x), sy(a.y) - a.size * u, a.size * u, a.size * u); ctx.globalAlpha = 1;
  }
};
