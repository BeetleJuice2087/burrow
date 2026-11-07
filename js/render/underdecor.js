// Burrow render · underdecor.js — What gives each Underworld region its own look: bones, stumps, crystals, ribs, banners, braziers, embers, blowing dust and heat shimmer.
// Drawn only. Nothing here is saved or touches the sim: where things go comes from a hash of the seed, so it never blocks the miner and old worlds get it too.
'use strict';

Object.assign(CAVE_TONES, {ash: {L: '#8e847a', M: '#625a54', D: '#3e3836'}, char: {L: '#7a5a4c', M: '#4a3630', D: '#2a201e'}, vault: {L: '#665a6c', M: '#4a4052', D: '#2e2836'}});
// regions, by number: 0 Ash Flats, 1 Emberwood, 2 Shardfall, 3 Cinder Sea, 4 Hollow Wastes, 5 Ashen Citadel
const UNDER_MOTES = [22, 34, 16, 40, 34, 12]; // new motes a second, on a full screen
const SHARD_HUES = [{L: '#e8f6ff', M: '#a08ef0', D: '#5a4ab4'}, {L: '#e8ffff', M: '#6ac8e8', D: '#3a6ab0'}];
const BONE_TONE = {L: '#c8bca8', M: '#9a8e7c', D: '#5c5044'};
const UNDER_MOTE_MOST = 150, UNDER_KEEP_CLEAR = 6; // the gate stays bare, so nothing hides it

const shardArt = (hue, n, hang) => {
  const rows = [['......L.........', '.....LM.........', '.....LMD...L....', '.L...LMD..LM....', '.LM..LMD..LMD...', '.LMD.LMD.LLMD.L.', 'LLMDLLMDLLMMDLM.', 'LMMDLMMDLMMMDLMD'],
    ['..........L.....', '.........LM.....', '...L.....LMD....', '..LM....LLMD....', '..LMD...LMMD..L.', '.LLMD.L.LMMD.LM.', 'LLMMDLMDLMMDLLMD', 'LMMMDLMDLMMDLMMD'],
    ['................', '................', '.......L........', '......LM........', '...L..LMD...L...', '..LM.LLMD..LM...', '.LLMDLMMD.LLMD..', 'LLMMDLMMDLLMMD..']][n];
  return art(hang ? rows.slice().reverse() : rows, SHARD_HUES[hue]);
};
const stumpArt = () => art(['....cckcc.......', '...kkckekk......', '..ckkkkkkkc.....', '..kkekkkckk.....', '..ckkkkekkk.....', '..kkckkkkkc.....', '.ckkkkckkkkc....', 'kkkkekkkkkkkk...'], {k: '#241a16', c: '#3e2c24', e: '#ff7a2a'});
const skullArt = () => art(['...LLLLLL...', '..LMMMMMMD..', '.LMkkMMkkMD.', '.LMkkMMkkMD.', '.LMMMkkMMMD.', '..DMMMMMMD..'], Object.assign({k: '#2a2220'}, BONE_TONE));
const boneArt = () => art(['................', '.LL.........LL..', 'LMDLMMMMMMMLMMD.', '.DD.DDDDDDD..DD.'], BONE_TONE);
const capArt = () => art(['..oOOOo..', '.oOOOOOo.', 'oOOOOOOOo', 'dddssdddd', '...ss....', '...ss....', '..sss....'], {O: '#ff9a3a', o: '#ffd27a', d: '#b84a1a', s: '#d8b080'});
const brazierArt = () => art(['K..........K', 'KkkkkkkkkkkK', '.KkkkkkkkkK.', '..KKKKKKKK..', '.....kK.....', '.....kK.....', '.....kK.....', '...kkkKKK...', '..kkkkKKKK..'], {K: '#2a2428', k: '#50464e'});
function pillarArt(h) {
  const w = 14, rows = [];
  for (let r = 0; r < h; r++) {
    let row = '';
    for (let i = 0; i < w; i++) {
      const jag = [5, 3, 6, 2, 4, 1, 3, 0, 2, 4, 1, 5, 3, 6][i]; // snapped off, unevenly
      row += r < jag ? '.' : r === jag ? 'L' : i === 0 || r % 12 === 0 ? 'D' : i < 4 ? 'L' : i > 10 ? 'D' : 'M';
    }
    rows.push(row);
  }
  return art(rows, CAVE_TONES.vault);
}
// a huge old ribcage, half sunk in the floor
function ribsArt() {
  const w = 76, h = 50, grid = Array.from({length: h}, () => new Array(w).fill('.'));
  for (let i = 0; i < 5; i++) {
    const tall = h * (0.62 + 0.38 * Math.sin((i + 1) / 6 * Math.PI)), base = 3 + i * 13;
    for (let f = 0; f <= 1; f += 0.01) {
      const x = Math.round(base + 13 * f * f), y = Math.round(h - 1 - tall * Math.sin(f * Math.PI * 0.55));
      for (let d = 0; d < 3; d++) if (grid[y] && grid[y][x + d] !== undefined) grid[y][x + d] = d === 0 ? 'L' : d === 1 ? 'M' : 'D';
    }
  }
  return art(grid.map(r => r.join('')), BONE_TONE);
}
function glowArt(c) {
  const cv = canvas(48, 48), q = cv.getContext('2d'), d = q.createRadialGradient(24, 24, 1, 24, 24, 24);
  d.addColorStop(0, c); d.addColorStop(1, 'rgba(0,0,0,0)');
  q.fillStyle = d; q.fillRect(0, 0, 48, 48);
  return cv;
}

Renderer.prototype.drawUnderDecor = function (g, ctx, sx, sy, ts, x0, x1, y0, y1) {
  const W = B.W, H = B.H, tl = g.w.t, biome = g.w.biome, t = this.wildT, p = ts / 16, gate = g.w.gate;
  const seed = g.seed + (g.w.era || 0) * 131, glow = this.underGlow = [], lava = new Map();
  const sprite = (key, make, x, base, w, h) => ctx.drawImage(caveSprite(key, make), x, base - h * p, w * p, h * p);
  for (let y = Math.max(2, y0); y <= Math.min(H - 3, y1); y++) for (let x = Math.max(1, x0 - 6); x <= Math.min(W - 2, x1); x++) {
    const k = y * W + x, tile = tl[k], here = biome[x];
    if (!g.seen[k]) continue;
    const h = wildHash(seed, x, y + 7000), r = (h >>> 8) % 100, at = (h >>> 16) % 8;
    if (gate && Math.abs(x - gate.x) <= UNDER_KEEP_CLEAR && Math.abs(y - gate.y) <= UNDER_KEEP_CLEAR) continue;
    if (tile === T.LAVA && tl[k - W] === T.AIR) {
      const run = lava.get(y); if (run) { run.a = Math.min(run.a, x); run.b = Math.max(run.b, x); } else lava.set(y, {a: x, b: x});
      const shore = tl[k - 1] !== T.LAVA || tl[k + 1] !== T.LAVA || tl[k - 2] !== T.LAVA || tl[k + 2] !== T.LAVA;
      if (shore || h % 4 === 0) { // cooled crust riding on the surface
        const bob = Math.sin(t / 1400 + h) * p * 0.6, wide = shore ? 16 : 8 + at;
        ctx.fillStyle = '#2a120c'; ctx.fillRect(sx(x) + (16 - wide) / 2 * p, sy(y) - p + bob, wide * p, 4 * p);
        ctx.fillStyle = '#6a3018'; ctx.fillRect(sx(x) + (18 - wide) / 2 * p, sy(y) - p + bob, (wide - 2) * p, p);
      }
      continue;
    }
    if (tile !== T.AIR || (g.protect && g.protect.has(k))) continue;
    const floor = B.isSolid(B.get(g, x, y + 1)), roof = B.isSolid(B.get(g, x, y - 1));
    if (floor && !roof && caveRun(g, x, y, -1) >= NEEDS_ROOM) {
      const base = sy(y + 1), left = sx(x), room = caveRun(g, x, y, -1), big = (h >>> 3) % 3;
      if (here === 0) {
        if (r < 14) sprite('rock' + big + 'ash', () => rockArt(10 + big * 3, 4 + big * 2, 'ash'), left, base, 10 + big * 3, 4 + big * 2);
        else if (r < 21) sprite('bone', boneArt, left, base + p, 16, 4);
        else if (r < 26) sprite('skull', skullArt, left + 2 * p, base + p * 2, 12, 6);
        else if (r < 34) { const len = 10 + big * 5; sprite('up' + len + 'char', () => dripArt(len, 'char', true), left + at * p, base, len >= 10 ? 5 : 3, len); }
      } else if (here === 1) {
        if (r < 16) { sprite('stump', stumpArt, left, base, 16, 8); glow.push({spot: 1, x: x + 0.3, y: y + 0.75, r: 0.7, c: '#ff7a2a', a: 0.4, h}); }
        else if (r < 26) sprite('rock' + big + 'char', () => rockArt(8 + big * 3, 3 + big * 2, 'char'), left, base, 8 + big * 3, 3 + big * 2);
      } else if (here === 2) {
        if (r < 34) {
          const hue = (h >>> 5) & 1, n = (h >>> 6) % 3;
          sprite('shard' + hue + n, () => shardArt(hue, n, false), left, base, 16, 8);
          if (h % 3 === 0) glow.push({glint: 1, x: x + 0.3 + at / 16, y: y + 0.55, h});
        }
      } else if (here === 3) {
        if (r < 22) { sprite('ucap', capArt, left + at * p, base, 9, 7); glow.push({spot: 1, x: x + (at + 4.5) / 16, y: y + 0.75, r: 1, c: '#ff8a2a', a: 0.45, h}); }
        else if (r < 34) sprite('rock' + big + 'char', () => rockArt(8 + big * 3, 3 + big * 2, 'char'), left, base, 8 + big * 3, 3 + big * 2);
      } else if (here === 4) {
        let clear = room >= 4;
        for (let i = 1; i <= 4 && clear; i++) clear = tl[k + i] === T.AIR && B.isSolid(B.get(g, x + i, y + 1));
        if (clear && h % 29 === 0) sprite('ribs', ribsArt, left, base + 3 * p, 76, 50);
        else if (r < 16) { const len = Math.min(room * 16 - 12, 22 + big * 18); sprite('up' + len + 'char', () => dripArt(len, 'char', true), left + at * p, base, len >= 22 ? 7 : len >= 10 ? 5 : 3, len); }
        else if (r < 26) sprite('rock' + big + 'ash', () => rockArt(8 + big * 3, 3 + big * 2, 'ash'), left, base, 8 + big * 3, 3 + big * 2);
      } else if (r < 11) {
        const len = 26 + big * 9;
        sprite('pillar' + len, () => pillarArt(len), left + p, base, 14, len);
      } else if (r < 17) {
        sprite('brazier', brazierArt, left + 2 * p, base, 12, 9);
        glow.push({flame: 1, x: x + 0.5, y: y + 0.42, h});
      } else if (r < 28) sprite('rock' + big + 'vault', () => rockArt(8 + big * 3, 3 + big * 2, 'vault'), left, base, 8 + big * 3, 3 + big * 2);
    } else if (roof && !floor) {
      const room = caveRun(g, x, y, 1);
      if (room < NEEDS_ROOM) continue;
      const top = sy(y), left = sx(x), big = (h >>> 3) % 3;
      if (here === 1 && r < 20) { // roots feeling their way down, lit from inside
        const long = Math.min(1 + big, room - 1) * 14;
        for (let i = 0; i < long; i += 2) {
          const sway = Math.sin(t / 1900 + h + i / 12) * i / 16 * p * 0.7, wob = Math.sin(i / 3 + h) * p;
          ctx.fillStyle = i > long - 5 ? '#ff9a3a' : (i >> 1) % 3 ? '#4a2a1c' : '#7a3a1c';
          ctx.fillRect(left + at * p + sway + wob, top + i * p, 2 * p, 2 * p);
        }
        glow.push({spot: 1, x: x + at / 16, y: y + long / 16, r: 0.6, c: '#ff8a3a', a: 0.45, h});
      } else if (here === 2 && r < 26) {
        const hue = (h >>> 5) & 1, n = (h >>> 6) % 3;
        ctx.drawImage(caveSprite('shardup' + hue + n, () => shardArt(hue, n, true)), left, top, 16 * p, 8 * p);
        if (h % 3 === 0) glow.push({glint: 1, x: x + 0.3 + at / 16, y: y + 0.4, h});
      } else if (here === 5 && r < 9) { // a banner gone to rags
        const len = Math.min(1 + big, room - 1) * 14 + 8;
        for (let c = 0; c < 4; c++) {
          const end = len - ((h >>> (c * 3)) & 7);
          for (let i = 0; i < end; i += 2) {
            const sway = Math.sin(t / 1700 + h + i / 11) * i / 16 * p * 0.8, mark = i > 8 && i < 15 && (c === 1 || c === 2);
            ctx.fillStyle = i < 2 ? '#c89a3a' : mark ? '#c89a3a' : (c + (i >> 2)) % 4 ? '#7a1e2a' : '#5a1620';
            ctx.fillRect(left + (4 + c * 2) * p + sway, top + i * p, 2 * p, 2 * p);
          }
        }
      } else if (here === 5 && r < 18) {
        const len = Math.min(1 + big * 2, room - 1) * 16;
        for (let i = 0; i < len; i += 3) {
          const sway = Math.sin(t / 2100 + h + i / 14) * i / 16 * p * 0.6;
          ctx.fillStyle = (i / 3) % 2 ? '#5e5660' : '#3c363e';
          ctx.fillRect(left + (7 + ((i / 3) % 2 ? 0 : 0.5)) * p + sway, top + i * p, ((i / 3) % 2 ? 2 : 3) * p, 3 * p);
        }
      } else if (r < (here === 0 || here === 3 ? 14 : here === 4 ? 12 : 0)) {
        const len = DRIP_LENGTHS[Math.min((h >>> 3) % 6, room * 2 - 3)], w = len >= 22 ? 7 : len >= 10 ? 5 : 3;
        ctx.drawImage(caveSprite('down' + len + 'char', () => dripArt(len, 'char', false)), left + at * p, top, w * p, len * p);
      }
    }
  }
  this.underShimmer(ctx, sx, sy, ts, lava);
};
// heat wobbling the air above the lava: the picture above it is copied once, then laid back in slipping strips
Renderer.prototype.underShimmer = function (ctx, sx, sy, ts, lava) {
  const cv = this.cv, t = this.wildT, u = Math.max(1, Math.round(ts / 16)), step = u * 2;
  let done = 0;
  for (const [y, run] of lava) {
    if (run.b - run.a < 2 || done++ >= 4) continue;
    const X = Math.max(0, Math.round(sx(run.a))), R = Math.min(cv.width, Math.round(sx(run.b + 1))), Y = Math.max(0, Math.round(sy(y - 2.5))), Hh = Math.round(sy(y)) - Y, Wd = R - X;
    if (Wd <= 0 || Hh <= 0) continue;
    const off = this.shimmerCv = this.shimmerCv || canvas(8, 8);
    if (off.width < Wd || off.height < Hh) { off.width = Math.max(off.width, Wd); off.height = Math.max(off.height, Hh); }
    const q = off.getContext('2d');
    q.clearRect(0, 0, Wd, Hh); q.drawImage(cv, X, Y, Wd, Hh, 0, 0, Wd, Hh);
    for (let r = 0; r < Hh; r += step) {
      const near = r / Hh, slip = Math.sin(t / 170 + r / (step * 1.7) + y) * near * near * u * 2;
      ctx.drawImage(off, 0, r, Wd, step, X + Math.round(slip), Y + r, Wd, step);
    }
  }
};
// over the dark: everything here makes its own light
Renderer.prototype.drawUnderGlow = function (g, ctx, sx, sy, ts, x0, x1, y0, y1) {
  const t = this.wildT, p = ts / 16;
  for (const a of this.underGlow || []) {
    const pulse = 0.5 + 0.5 * Math.sin(t / (1300 + a.h % 1400) + a.h);
    if (a.glint) {
      const beat = (t / 1600 + a.h % 97 / 13) % 5;
      if (beat > 0.4) continue;
      const s = Math.sin(beat / 0.4 * Math.PI) * 3 * p, cx = sx(a.x), cy = sy(a.y);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
      ctx.fillRect(cx - s, cy - p / 2, s * 2, p); ctx.fillRect(cx - p / 2, cy - s, p, s * 2);
    } else if (a.flame) {
      const cx = sx(a.x), cy = sy(a.y), f = u => Math.sin(t / 90 + a.h + u) * 1.5 + Math.sin(t / 37 + u * 2) * 0.8;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.08 * f(0);
      const size = ts * 3.4;
      ctx.drawImage(caveSprite('glow#ff8a2a', () => glowArt('#ff8a2a')), cx - size / 2, cy - size / 2, size, size);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      for (let i = -2; i <= 2; i++) {
        const tall = (7 - Math.abs(i) * 2 + f(i)) * p, wide = 2 * p;
        ctx.fillStyle = '#ff7a2a'; ctx.fillRect(cx + i * wide - wide / 2, cy - tall, wide, tall);
        ctx.fillStyle = '#ffd26a'; ctx.fillRect(cx + i * wide - wide / 4, cy - tall * 0.55, wide / 2, tall * 0.55);
      }
    } else if (a.spot) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a.a * (0.7 + 0.3 * pulse);
      const size = ts * a.r * 2;
      ctx.drawImage(caveSprite('glow' + a.c, () => glowArt(a.c)), sx(a.x) - size / 2, sy(a.y) - size / 2, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
  this.underMotes(g, ctx, sx, sy, ts, x0, x1, y0, y1);
};
// each mote picks its own timing, pace and width the first time it's drawn, so no two keep the same beat
function moteSway(a, t) {
  if (a.phase === undefined) { a.phase = Math.random() * 7; a.reach = 4 + Math.random() * 13; a.pace = 450 + a.reach * 110 + Math.random() * 500; } // up to over a block each way, the wide swings slower
  return Math.sin(t / a.pace + a.phase) * a.sway * a.reach;
}
// what's in the air: ash settling, embers and sparks going up, shards dropping, dust blowing along the ground
Renderer.prototype.underMotes = function (g, ctx, sx, sy, ts, x0, x1, y0, y1) {
  const dt = this.wildDt, t = this.wildT, u = Math.max(1, Math.round(ts / 16)), list = this.underAir = this.underAir || [], m = g.m;
  const open = (x, y) => { const c = B.get(g, x, y); return !B.isSolid(c) && c !== T.LAVA; };
  const spawn = here => {
    const x = x0 + Math.floor(Math.random() * (x1 - x0 + 1));
    let y = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
    if (x < 0 || x >= B.W || y < 0 || y >= B.H || !open(x, y) || !g.seen[y * B.W + x]) return;
    const a = {x: x + Math.random(), y: y + Math.random(), vx: 0, vy: 0, fall: 0, age: 0, life: 4 + Math.random() * 4, size: 1 + (Math.random() < 0.45 ? 1 : 0), wide: 1};
    if (here === 0) { a.vx = 0.25 + Math.random() * 0.3; a.vy = 0.5 + Math.random() * 0.5; a.c = Math.random() < 0.12 ? '#ff8a3a' : '#a89c92'; a.alpha = 0.6; a.sway = 1; }
    else if (here === 1) { a.vy = -0.9 - Math.random() * 1.1; a.c = Math.random() < 0.3 ? '#ffd26a' : '#ff8a3a'; a.alpha = 0.95; a.sway = 1.2; }
    else if (here === 2) {
      if (Math.random() < 0.3) { // a sliver coming off the roof
        while (y > y0 && open(x, y - 1)) y--;
        a.y = y; a.fall = 14; a.c = '#c8d4ff'; a.alpha = 0.95; a.life = 3; a.wide = 1; a.size = 2;
      } else { a.vy = -0.2; a.vx = (Math.random() - 0.5) * 0.3; a.c = '#a79aff'; a.alpha = 0.6; a.sway = 0.5; }
    } else if (here === 3) {
      for (let d = 1; d < 22; d++) if (B.get(g, x, y + d) === T.LAVA) { a.y = y + d - 0.1; break; }
      a.vy = -2.6 - Math.random() * 2.4; a.life = 1.4 + Math.random() * 1.6; a.c = Math.random() < 0.4 ? '#ffe08a' : '#ff6a2a'; a.alpha = 1; a.sway = 0.7;
    } else if (here === 4) {
      a.vx = 1.2 + Math.random() * 1.6; a.vy = (Math.random() - 0.5) * 0.25; a.c = Math.random() < 0.3 ? '#e8d8b8' : '#b8a284'; a.alpha = 0.85; a.sway = 1.2; a.drift = 1; a.life = 5 + Math.random() * 4; // it bobs up and down: swaying sideways would fight the way it's going
    } else { a.vy = -0.5 - Math.random() * 0.5; a.c = Math.random() < 0.5 ? '#c84a8a' : '#ff8a3a'; a.alpha = 0.7; a.sway = 0.8; }
    list.push(a);
  };
  if (dt) {
    const seen = (x1 - x0 + 1) * (y1 - y0 + 1) / 1600, cx = Math.max(0, Math.min(B.W - 1, m.x));
    this.moteDue = (this.moteDue || 0) + UNDER_MOTES[g.w.biome[cx]] * seen * dt;
    for (; this.moteDue >= 1 && list.length < UNDER_MOTE_MOST; this.moteDue--) spawn(g.w.biome[Math.max(0, Math.min(B.W - 1, x0 + Math.floor(Math.random() * (x1 - x0 + 1))))]);
    this.moteDue = Math.min(this.moteDue, 4);
    if (!this.nextDeep) this.nextDeep = t + 40000 + Math.random() * 60000;
    if (t >= this.nextDeep) { // something big shifts a long way down, and the roof sheds ash
      this.nextDeep = t + 80000 + Math.random() * 120000;
      if (typeof Sound !== 'undefined') Sound.rumble(1.2, 0.6);
      for (let i = 0; i < 60; i++) {
        const x = x0 + Math.floor(Math.random() * (x1 - x0 + 1));
        let y = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
        if (!open(x, y)) continue;
        while (y > y0 && open(x, y - 1)) y--; // from the roof, or from up out of sight where the roof is too high to see
        if (g.seen[y * B.W + x]) list.push({x: x + Math.random(), y: y + 0.1, vx: 0.15, vy: 1 + Math.random() * 1.5, fall: 0, age: -Math.random() * 3, life: 5 + Math.random() * 3, size: 1 + (i % 2), wide: 1, c: '#a89c92', alpha: 0.7, sway: 1});
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (dt) {
      a.age += dt;
      if (a.age < 0) continue;
      a.vy += a.fall * dt; a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.age >= a.life || !open(Math.floor(a.x), Math.floor(a.y))) { list.splice(i, 1); continue; }
    }
    if (a.age < 0) continue;
    const fade = Math.min(1, a.age * 3, (a.life - a.age) * 1.5), sway = a.sway ? moteSway(a, t) * ts / 16 : 0;
    ctx.fillStyle = a.c; ctx.globalAlpha = Math.max(0, a.alpha * fade);
    ctx.fillRect(Math.round(sx(a.x) + (a.drift ? 0 : sway)), Math.round(sy(a.y) + (a.drift ? sway : 0)), a.wide * u * a.size, a.size * u);
  }
  ctx.globalAlpha = 1;
};
