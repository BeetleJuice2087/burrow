// Burrow render · renderer.js — camera, sky, tiles, entities, lighting and the whole-world view.
// Plain script: uses the sim globals and js/render/textures.js.
'use strict';
const toughTag = e => e.power >= 1.6 ? 'T2' : e.power >= 1.25 ? 'T1' : ''; // which look a tougher monster gets: see TOUGH_TINT

// ---------- renderer ----------
const CLOUD_SPAN = 190; // tiles of sky the clouds wrap around in
// the air of each Underworld region (by UNDER_BIOMES index)
const UNDER_SKY = [['#1a0608', '#5a1a10'], ['#240a04', '#7a3a10'], ['#0e0a24', '#3a2c70'], ['#2c0604', '#94300c'], ['#141012', '#4c3c34'], ['#100814', '#2e1a3a']].map(c => ({top: c[0], bot: c[1], d: 0}));
function Renderer(cv) {
  this.cv = cv; this.ctx = cv.getContext('2d');
  this.light = canvas(8, 8); this.warm = canvas(8, 8);
  this.mini = canvas(W, H);
  this.miniCtx = this.mini.getContext('2d');
  this.miniImg = this.miniCtx.createImageData(W, H);
  this.cam = {x: 300, y: 50};
  this.zoom = 32; this.stars = [];
  const r = B.mulberry(99);
  for (let i = 0; i < 120; i++) this.stars.push({x: r(), y: r() * 0.6, t: r() * 6});
  this.clouds = [];
  for (let i = 0; i < 24; i++) { // far clouds (low par) are smaller, fainter and slower
    const par = 0.15 + r() * 0.55, w = 16 + Math.floor(r() * 18), cols = new Array(w).fill(0);
    for (let b = 0, n = 3 + Math.floor(r() * 3); b < n; b++) { // a few round puffs side by side
      const c = w * (0.18 + r() * 0.64), rad = w * (0.14 + r() * 0.14), top = 2 + r() * 3.5;
      for (let k = 0; k < w; k++) { const q = (k + 0.5 - c) / rad; if (Math.abs(q) < 1) cols[k] = Math.max(cols[k], Math.round(1 + top * Math.sqrt(1 - q * q))); }
    }
    this.clouds.push({x: r() * CLOUD_SPAN, y: 33 + r() * 13, par, s: 0.08 + r() * 0.22, cols});
  }
  this.clouds.sort((a, b) => a.par - b.par);
}
const MINI_SKY = [143, 184, 232], MINI_CAVE = [34, 30, 38];
const MINI_UNDER = UNDER_SKY.map(s => hex(s.bot).map(v => Math.round(v * 0.7))); // open air on the Underworld map, by region
Renderer.prototype.rebuildMini = function (g) {
  const d = this.miniImg.data, w = g.w;
  for (let k = 0; k < W * H; k++) this.miniPix(g, k, d);
  this.miniCtx.putImageData(this.miniImg, 0, 0);
  g.dirty.length = 0;
};
Renderer.prototype.miniPix = function (g, k, d) {
  const t = g.w.t[k], x = k % W, y = (k / W) | 0;
  let c;
  const p = B.P[t];
  const air = B.inUnder(g) ? MINI_UNDER[g.w.biome[x]] || MINI_UNDER[0] : y <= g.w.surf[x] ? MINI_SKY : MINI_CAVE;
  const skinMini = !B.inUnder(g) && BIOME_MINI[t] && BIOME_MINI[t][g.w.biome[x]];
  if (skinMini) c = hex(skinMini);
  else if (p.mini && (p.solid || t === T.WATER || t === T.LAVA || t === T.LOG || t === T.LEAVES || t === T.PINE || t === T.CHARWOOD || t === T.EMBERLEAF)) c = hex(p.mini);
  else if (t === T.TORCH) c = [255, 210, 122];
  else if (p.mini && !p.solid && p.base === Infinity && t !== T.WATER && t !== T.LAVA) c = hex(p.mini); // furniture
  else c = air;
  if (!skinMini && p.mini && !p.solid && t !== T.WATER && t !== T.LAVA && t !== T.LOG && t !== T.LEAVES && t !== T.PINE && t !== T.TORCH && t < T.BENCH) c = air;
  const i = k * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
};
Renderer.prototype.updateMini = function (g) {
  if (!g.dirty.length) return;
  const d = this.miniImg.data;
  for (const k of g.dirty) this.miniPix(g, k, d);
  g.dirty.length = 0;
  this.miniCtx.putImageData(this.miniImg, 0, 0);
};

function daylight(g) {
  const f = B.dayFrac(g);
  if (f < 0.58) return 1;
  if (f < 0.68) return 1 - (f - 0.58) / 0.1 * 0.82;
  if (f < 0.93) return 0.18;
  return 0.18 + (f - 0.93) / 0.07 * 0.82;
}
function skyColors(g) {
  const f = B.dayFrac(g), d = daylight(g);
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const dayTop = [94, 150, 226], dayBot = [170, 208, 244], nTop = [10, 14, 34], nBot = [30, 36, 70];
  let top = lerp(nTop, dayTop, (d - 0.18) / 0.82), bot = lerp(nBot, dayBot, (d - 0.18) / 0.82);
  const dusk = (f > 0.56 && f < 0.72) ? 1 - Math.abs(f - 0.64) / 0.08 : (f > 0.9 ? 1 - Math.abs(f - 0.96) / 0.06 : 0);
  if (dusk > 0) bot = lerp(bot, [238, 136, 92], Math.max(0, Math.min(1, dusk)) * 0.75);
  return {top: 'rgb(' + top + ')', bot: 'rgb(' + bot + ')', d};
}

Renderer.prototype.draw = function (g, now, opts) {
  const ctx = this.ctx, cv = this.cv, dpr = opts.dpr;
  const VW = cv.width, VH = cv.height;
  ctx.imageSmoothingEnabled = false;
  const realm = g.realm || 'over'; // a world that has never been through the gate has no realm set
  if (this.realm !== realm) { // a new world behind the gate: snap the camera and redraw the map
    const first = this.realm === undefined; this.realm = realm;
    if (!first) { this.rebuildMini(g); this.cam.x = g.m.x + 0.5; this.cam.y = g.m.y - 1; }
  }
  this.wildClock(now, opts.still);
  if (opts.world) return this.drawWorld(g, now, opts);
  const ts = Math.round(this.zoom * dpr);
  const m = g.m;
  // camera
  const cx = this.cam.x, cy = this.cam.y;
  const viewW = VW / ts, viewH = VH / ts;
  const left = cx - viewW / 2, topY = cy - viewH / 2;
  const x0 = Math.floor(left) - 1, y0 = Math.floor(topY) - 1, x1 = Math.ceil(left + viewW) + 1, y1 = Math.ceil(topY + viewH) + 1;
  const sx = x => Math.round((x - left) * ts), sy = y => Math.round((y - topY) * ts);
  // sky
  const deep = B.inUnder(g), sk = deep ? UNDER_SKY[g.w.biome[Math.max(0, Math.min(B.W - 1, Math.round(left + viewW / 2)))]] || UNDER_SKY[0] : skyColors(g);
  const grd = ctx.createLinearGradient(0, 0, 0, VH);
  grd.addColorStop(0, sk.top); grd.addColorStop(1, sk.bot);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, VW, VH);
  const wx = deep ? null : this.weatherSky(g, sk, ctx, VW, VH);
  // stars
  if (sk.d < 0.7 && !deep) {
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      const a = (0.7 - sk.d) / 0.52 * (0.5 + 0.5 * Math.sin(now / 900 + s.t));
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillRect(Math.floor(s.x * VW), Math.floor(s.y * VH), Math.max(1, dpr | 0), Math.max(1, dpr | 0));
    }
    ctx.globalAlpha = 1;
  }
  // sun & moon on an arc
  const f = B.dayFrac(g);
  const arc = (p) => ({x: VW * (0.1 + 0.8 * p), y: VH * 0.08 + VH * 0.3 * (1 - Math.sin(p * Math.PI))});
  const sunP = f / 0.66, moonP = ((f + 0.34) % 1) / 0.66;
  const big = Math.max(18, ts * 1.1);
  if (!deep && sunP >= 0 && sunP <= 1) { const a = arc(sunP); ctx.fillStyle = 'rgba(255,240,180,0.12)'; ctx.fillRect(a.x - big * 0.8, a.y - big * 0.8, big * 1.6, big * 1.6); ctx.fillStyle = '#fff6cf'; ctx.fillRect(a.x - big / 2, a.y - big / 2, big, big); }
  if (!deep && moonP >= 0 && moonP <= 1) { const a = arc(moonP); ctx.fillStyle = '#e8ecf5'; ctx.fillRect(a.x - big / 2.4, a.y - big / 2.4, big / 1.2, big / 1.2); ctx.fillStyle = '#c4c9d6'; ctx.fillRect(a.x - big / 6, a.y - big / 8, big / 6, big / 6); ctx.fillRect(a.x + big / 10, a.y + big / 8, big / 8, big / 8); }
  // clouds: chunky, flat-bottomed, drifting; closer layers scroll faster
  const day = sk.d, lerpC = (n, d) => Math.round(n + (d - n) * day);
  if (!deep) for (const c of this.clouds) {
    const cell = Math.max(2, Math.round(ts * (0.14 + c.par * 0.24)));
    const span = CLOUD_SPAN * ts, off = (c.x + now / 1000 * c.s - (cx + (m.journey ? m.journey.off : 0)) * c.par) * ts;
    const px = Math.round(((off % span) + span) % span - span / 2 + VW / 2);
    if (px > VW || px + c.cols.length * cell < 0) continue;
    const py = sy(cy + (c.y - cy) * (0.55 + c.par * 0.45)), a = 0.5 + c.par * 0.6;
    const main = `rgba(${lerpC(66, 255)},${lerpC(76, 255)},${lerpC(108, 255)},${a})`;
    const under = `rgba(${lerpC(48, 208)},${lerpC(56, 222)},${lerpC(84, 242)},${a})`;
    c.cols.forEach((h, k) => {
      if (!h) return;
      ctx.fillStyle = main; ctx.fillRect(px + k * cell, py - h * cell, cell, h * cell);
      ctx.fillStyle = under; ctx.fillRect(px + k * cell, py, cell, cell);
    });
  }
  if (wx) this.drawStormClouds(g, wx, ctx, ts, cx, topY, VW, VH, sk.d);
  else this.cloudPx = 0;
  if (!deep && !wx) this.drawBirds(g, ctx, sx, sy, ts, x0, x1, left, viewW, sk.d);
  // tiles
  const frame = Math.floor(now / 220) % 4;
  const tl = g.w.t, rooms = homeRooms(g).concat(villageRooms(g));
  const roomAt = (x, y) => { for (const r of rooms) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return r; return null; };
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const t = tl[y * W + x];
      const px = sx(x), py = sy(y), pw = sx(x + 1) - px, ph = sy(y + 1) - py;
      const solid = B.isSolid(t);
      const room = !solid && roomAt(x, y);
      if (room) {
        ctx.drawImage(WALL[room.wall], px, py, pw, ph);
      } else if (!solid && y > g.w.surf[x]) {
        const depth = y - g.w.surf[x];
        const wall = deep ? WALL.ash : g.w.biome[x] === 3 && depth < 9 ? WALL.sand : g.w.biome[x] === B.B_RED && depth < 20 ? WALL.red : depth < 5 ? WALL.dirt : y >= 96 ? WALL.deep : WALL.stone;
        ctx.drawImage(wall, px, py, pw, ph);
      }
      if (t === T.AIR) continue;
      const v = B.hash2(x, y, 5) * 4 | 0;
      let img;
      if (t === T.LAVA) img = TEX[t][frame]; // the whole pool flows as one, so no block is out of step with its neighbours
      else if (t === T.WATER) img = TEX[t][(frame + v) % 4];
      else if ((t === T.CHEST && !g.w.chests[y * W + x]) || (t === T.STORE_CHEST && g.m.act && g.m.act.chest === y * W + x)) img = FURN.chestOpen;
      else if (CROP_ART[t]) img = CROP_ART[t][B.cropStage(g, y * W + x)];
      else if (FURN[t]) img = !Array.isArray(FURN[t]) ? FURN[t] : FURN[t][FLAME_TILES.has(t) ? flameSize(x, y, now, FURN[t].length) : LIGHT_TILES.has(t) ? flameFrame(x, y, now) : frame % 2];
      else img = (!deep && biomeSkin(t, g.w.biome[x], y, v)) || (TEX[t] && TEX[t][v]);
      if (img) {
        if (t === T.WATER || t === T.LAVA) {
          // liquids hold a level 1..8; draw a full block when the same liquid sits on top
          const lv = g.w.lv ? g.w.lv[y * W + x] || 8 : 8;
          const full = lv >= 8 || (y > 0 && tl[(y - 1) * W + x] === t);
          const hh = full ? ph : Math.max(2, Math.round(ph * lv / 8));
          const sx0 = t === T.LAVA ? (x % LAVA_TILES) * 16 : 0, sy0 = t === T.LAVA ? (y % LAVA_TILES) * 16 : 0;
          ctx.drawImage(img, sx0, sy0 + 16 - hh / ph * 16, 16, hh / ph * 16, px, py + ph - hh, pw, hh);
          if (!full || tl[(y - 1) * W + x] !== t) { ctx.fillStyle = t === T.WATER ? 'rgba(200,225,255,0.55)' : 'rgba(255,230,140,0.7)'; ctx.fillRect(px, py + ph - hh, pw, Math.max(1, ts / 10)); }
        } else ctx.drawImage(img, px, py, pw, ph);
      }
    }
  }
  // dig progress
  const a = m.act;
  if (a && ((a.type === 'step' && a.phase === 'dig' && a.digX !== undefined) || a.type === 'dig')) {
    const dx = a.type === 'dig' ? a.x : a.digX, dy = a.type === 'dig' ? a.y : a.digY;
    const prog = a.type === 'dig' ? a.t / a.need : a.t / (a.digNeed || 1);
    if (B.isSolid(B.get(g, dx, dy)) || a.type === 'dig') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      const n = Math.floor(prog * 6);
      const r = B.mulberry(dx * 31 + dy);
      for (let i = 0; i < n * 4; i++) ctx.fillRect(sx(dx) + Math.floor(r() * 14 + 1) * ts / 16, sy(dy) + Math.floor(r() * 14 + 1) * ts / 16, ts / 8, ts / 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, dpr);
      ctx.strokeRect(sx(dx) + 0.5, sy(dy) + 0.5, ts - 1, ts - 1);
    }
  }
  if (!deep) this.drawCaveDecor(g, ctx, sx, sy, ts, x0, x1, y0, y1);
  else this.drawUnderDecor(g, ctx, sx, sy, ts, x0, x1, y0, y1);
  if (!deep) this.drawWild(g, ctx, sx, sy, ts, x0, x1, y0, y1, sk.d);
  this.drawPet(g, ctx, sx, sy, ts);
  if (!deep) this.drawTrader(g, ctx, sx, sy, ts, now);
  if (!deep) this.drawFolk(g, ctx, sx, sy, ts, now);
  // critters, monsters, miner
  const ent = (e, sprR, sprL, tall, flash) => {
    const px = e.from ? e.x : e.x, py = e.y;
    const spr = flash ? (e.facing < 0 ? flash[1] : flash[0]) : (e.facing < 0 ? sprL : sprR);
    const hgt = tall ? 2 : 1;
    const ex = sx(e.px), ey = sy(e.py - hgt + 1);
    if (e.type === 'warden') { // half again as big as anything else, with its health shown above it
      ctx.drawImage(spr, ex - ts * 0.5, ey - ts * 2, ts * 2, ts * 4);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(ex - ts, ey - ts * 2.5, ts * 3, ts * 0.22);
      ctx.fillStyle = '#ff6a2a'; ctx.fillRect(ex - ts, ey - ts * 2.5, ts * 3 * Math.max(0, e.hp / B.MON.warden.hp), ts * 0.22);
      return;
    }
    if (e.type === 'spider') { // feet on whichever side of the block it holds, legs stepping as it goes
      const frame = (e.walk || 0) % 2 ? 'spiderB' : 'spider', pic = e.hurt > 0 ? SPR[frame + (e.facing < 0 ? 'HL' : 'H')] : SPR[frame + toughTag(e) + (e.facing < 0 ? 'L' : '')];
      ctx.save(); ctx.translate(ex + ts / 2, ey + ts / 2); ctx.rotate(e.falling ? 0 : -(e.side || 0) * Math.PI / 2);
      ctx.drawImage(pic, -ts / 2, -ts / 2, ts, ts);
      ctx.restore();
      return;
    }
    if (e.type === 'blastcap') { // swells, faster and paler as it gets close to going off
      const f = e.fuse > 0 ? 1 - e.fuse / B.BLAST_FUSE : 0, s = ts * (1 + f * 0.6), blink = f > 0 && Math.floor(e.fuse / (f > 0.6 ? 2 : 5)) % 2 === 0, shake = f > 0 ? Math.sin(e.fuse * 2) * ts * 0.04 : 0;
      ctx.drawImage(blink ? SPR.blastcapH : spr, ex + (ts - s) / 2 + shake, ey + ts - s, s, s);
      return;
    }
    ctx.drawImage(spr, ex, ey, ts, ts * hgt);
  };
  const lerpEnt = e => { e.px = e.px === undefined ? e.x : e.px + (e.x - e.px) * 0.25; e.py = e.py === undefined ? e.y : e.py + (e.y - e.py) * 0.25; };
  // the pudgeon art looks left, so its plain sprite is the left-facing one
  for (const c of g.critters) { lerpEnt(c); if (c.x >= x0 && c.x <= x1) ent(c, SPR.pudgeonL, SPR.pudgeon, false, c.hurt > 0 ? [SPR.pudgeonHL, SPR.pudgeonH] : null); }
  for (const e of g.monsters) { lerpEnt(e); if (e.x >= x0 && e.x <= x1) ent(e, SPR[e.type + toughTag(e)] || SPR[e.type], SPR[e.type + toughTag(e) + 'L'] || SPR[e.type + 'L'], !B.LOW_MON[e.type], e.hurt > 0 ? [SPR[e.type + 'H'], SPR[e.type + 'HL']] : null); }
  // arrows
  for (const ar of g.arrows) {
    if (ar.mine) { // a shaft along its line of flight, with a head of its own metal
      const ang = Math.atan2(ar.vy, ar.vx), len = ts * 0.7, thick = Math.max(2, Math.round(ts / 12)), metal = MAT_COL[ar.mine.split('_')[0]];
      ctx.save(); ctx.translate(sx(ar.x), sy(ar.y)); ctx.rotate(ang);
      ctx.fillStyle = '#c8b080'; ctx.fillRect(-len / 2, -thick / 2, len, thick);
      ctx.fillStyle = metal[0]; ctx.fillRect(len / 2 - thick, -thick, thick * 2, thick * 2);
      ctx.fillStyle = '#e8e4dc'; ctx.fillRect(-len / 2 - thick, -thick, thick * 2, thick * 2);
      ctx.restore();
      continue;
    }
    ctx.fillStyle = ar.fire ? '#ff8a3a' : '#e8dcc0'; ctx.fillRect(sx(ar.x) - ts * 0.3, sy(ar.y), ts * 0.6, Math.max(1, ar.fire ? ts / 5 : ts / 10)); }
  if (!m.dead) this.drawMiner(g, ctx, sx, sy, ts, now);
  // fx
  for (const e of g.fx) {
    if (e.type === 'crumble') {
      const r = B.mulberry(e.x * 13 + e.y * 7), c = B.P[e.t].mini || '#888';
      ctx.fillStyle = c; ctx.globalAlpha = e.life / 12;
      for (let i = 0; i < 6; i++) { const ox = r(), oy = r(); ctx.fillRect(sx(e.x + ox), sy(e.y + oy + (12 - e.life) * 0.04 * (1 + oy)), ts / 6, ts / 6); }
      ctx.globalAlpha = 1;
    } else if (e.type === 'blast') { // a hard flash, then fire and smoke rolling out
      const p = 1 - e.life / 18;
      if (p < 0.2) { ctx.fillStyle = 'rgba(255,240,190,' + (0.8 - p * 3) + ')'; ctx.fillRect(sx(e.x + 0.5) - ts * 3, sy(e.y + 0.5) - ts * 3, ts * 6, ts * 6); }
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4, s = (0.5 + (i % 3) * 0.5) * p * 2.4;
        ctx.fillStyle = i % 2 ? 'rgba(255,' + Math.round(170 - p * 110) + ',60,' + (1 - p) + ')' : 'rgba(90,84,80,' + (1 - p) * 0.8 + ')';
        ctx.fillRect(sx(e.x + 0.5 + Math.cos(a) * s) - ts / 4, sy(e.y + 0.5 + Math.sin(a) * s) - ts / 4, ts / 2, ts / 2);
      }
    } else if (e.type === 'grit') { // sparks drift over to the miner
      const p = 1 - Math.min(1, e.life / 32), a = (e.seed % 628) / 100, mx = g.m.x + 0.5, my = g.m.y - 0.5, q = p * p;
      ctx.fillStyle = e.seed % 2 ? '#ffc24a' : '#ff8a2a';
      ctx.fillRect(sx(e.x + (mx - e.x) * q + Math.cos(a) * (1 - q) * 0.8) - ts / 14, sy(e.y + (my - e.y) * q + Math.sin(a) * (1 - q) * 0.8) - ts / 14, ts / 7, ts / 7);
    } else if (e.type === 'poof') {
      ctx.fillStyle = 'rgba(230,230,240,' + (e.life / 20) + ')';
      const s = (20 - e.life) * 0.05;
      for (let i = 0; i < 6; i++) ctx.fillRect(sx(e.x + 0.5 + Math.cos(i) * s) - ts / 6, sy(e.y - 0.5 + Math.sin(i) * s), ts / 3, ts / 3);
    } else if (e.type === 'steam') {
      const life = e.life / 30;
      ctx.fillStyle = 'rgba(235,235,245,' + (life * 0.7) + ')';
      for (let i = 0; i < 4; i++) ctx.fillRect(sx(e.x + 0.2 + i * 0.2 + Math.sin(e.life * 0.3 + i) * 0.1), sy(e.y - (1 - life) * 1.5 - i * 0.15), ts / 5, ts / 5);
    } else if (e.type === 'leaf') {
      ctx.fillStyle = 'rgba(70,130,50,' + (e.life / 24) + ')';
      ctx.fillRect(sx(e.x + 0.3 + Math.sin(e.life) * 0.2), sy(e.y + (24 - e.life) * 0.05), ts / 5, ts / 8);
    }
  }
  // lighting
  this.drawLight(g, ctx, x0, y0, x1, y1, sx, sy, ts, sk.d, now);
  if (!deep) this.drawFireflies(g, ctx, sx, sy, ts, x0, x1, sk.d);
  else this.drawUnderGlow(g, ctx, sx, sy, ts, x0, x1, y0, y1);
  this.drawGateMotes(g, ctx, sx, sy, ts); // over the dark: they make their own light
  if (wx) this.drawWeather(g, wx, ctx, sx, sy, ts, x0, x1, left, topY, VW, VH, dpr, opts.still);
  if (this.route && !m.dead) this.drawRoute(g, now, ctx, sx, sy, ts, dpr); // over the dark, so it can be followed underground
  // emissive eyes on top of darkness
  for (const e of g.monsters) {
    if (e.x < x0 || e.x > x1) continue;
    const eyeC = e.type === 'shambler' || e.type === 'cinderling' || e.type === 'shardling' ? '#ffcf4a' : e.type === 'crawler' ? '#ff4a6a' : e.type === 'ashcaster' ? '#ff7a3a' : '#7ad8ff';
    const tag = toughTag(e), low = !!B.LOW_MON[e.type], ex = sx(e.px), ey = sy(e.py - (low ? 0 : 1)), u = ts / 8;
    if (tag === 'T2') { // a low ember glow round the worst of them
      const cx = ex + ts / 2, cy = sy(e.py) - (low ? -ts / 2 : 0), r = ts * (low ? 1 : 1.5), glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      glow.addColorStop(0, 'rgba(255,110,30,0.3)'); glow.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.fillStyle = glow; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.fillStyle = tag ? '#ff3a2a' : eyeC;
    if (e.type === 'warden') continue; // its eyes are in the sprite
    if (e.type === 'spider') { if (e.awake) { ctx.fillStyle = '#ff3a3a'; ctx.fillRect(ex + 3 * u, ey + 4 * u, u, u); ctx.fillRect(ex + 4 * u, ey + 4 * u, u, u); } continue; }
    if (e.type === 'blastcap') { if (e.awake) { ctx.fillStyle = '#ffb04a'; ctx.fillRect(ex + 3 * u, ey + 6 * u, u, u); ctx.fillRect(ex + 5 * u, ey + 6 * u, u, u); } continue; } // asleep it's just a mushroom
    if (e.type === 'shambler' || e.type === 'cinderling' || e.type === 'shardling') { const fx = e.facing < 0; ctx.fillRect(ex + (fx ? 5 : 2) * u, ey + 3 * u, u, u); ctx.fillRect(ex + (fx ? 2 : 5) * u, ey + 3 * u, u, u); }
    else if (low) ctx.fillRect(ex + (e.facing < 0 ? 0 : 7) * u, ey + 5 * u, u, u);
    else { ctx.fillRect(ex + 3 * u, ey + 3 * u, u, u); ctx.fillRect(ex + 4 * u, ey + 3 * u, u, u); }
  }
  // floating numbers
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(Math.max(11, ts * 0.4))}px "Pixelify Sans", monospace`;
  for (const e of g.fx) {
    if (e.type !== 'num') continue;
    ctx.globalAlpha = Math.min(1, e.life / 15);
    ctx.fillStyle = '#000'; ctx.fillText(e.text, sx(e.x + 0.5) + 1, sy(e.y - (30 - e.life) * 0.02) + 1);
    ctx.fillStyle = e.color; ctx.fillText(e.text, sx(e.x + 0.5), sy(e.y - (30 - e.life) * 0.02));
  }
  ctx.globalAlpha = 1;
  this.minerScreen = {x: sx(m.px + 0.5) / dpr, y: sy(m.py - 1.6) / dpr, ts: ts / dpr};
};

Renderer.prototype.drawMiner = function (g, ctx, sx, sy, ts, now) {
  const m = g.m, a = m.act;
  const left = m.facing < 0;
  if (m.sleeping) {
    const b = m.bed || {x: m.x, y: m.y};
    ctx.drawImage(SPR.sleep, sx(b.x - 0.5), sy(b.y + 0.55), ts * 2, ts * 0.62);
    ctx.fillStyle = '#e8ecff'; ctx.font = `${Math.round(ts * 0.45)}px "Pixelify Sans", monospace`; ctx.textAlign = 'center';
    const z = (now / 600) % 3; ctx.globalAlpha = 0.8; ctx.fillText('z', sx(b.x + 0.4 + z * 0.2), sy(b.y + 0.3 - z * 0.3)); ctx.globalAlpha = 1;
    return;
  }
  const moving = a && a.type === 'step' && a.phase === 'move', fightingNow = a && a.type === 'swing' && !a.critter;
  const walkF = moving ? 1 + (Math.floor(now / 110) % 2) : 0;
  const px = sx(m.px), py = sy(m.py - 1);
  const bob = moving && walkF === 1 ? -ts / 16 : 0;
  const mat = k => k ? k.split('_')[0] : '';
  const skin = minerSkin(mat(armorPiece(m, 'helmet')), mat(armorPiece(m, 'legs')), mat(armorPiece(m, 'boots')));
  const spr = (m.hurt > 0 ? (left ? skin.hurtL : skin.hurt) : (left ? skin.L : skin.R))[walkF];
  ctx.drawImage(spr, px, py + bob, ts, ts * 2);
  const chest = mat(armorPiece(m, 'chest'));
  if (chest) ctx.drawImage(left ? SPR.plateL[chest] : SPR.plate[chest], px, py + bob, ts, ts * 2);
  if (fightingNow && m.inv.shield) ctx.drawImage(SPR.shield, px + ts * (left ? 0.02 : 0.5), py + bob + ts * 0.8, ts * 0.48, ts * 0.58);
  // arm + tool
  const working = a && (a.type === 'dig' || (a.type === 'step' && a.phase === 'dig') || a.type === 'swing');
  const fighting = a && a.type === 'swing';
  const swing = working ? Math.sin(m.swing * 0.55) : 0;
  const fishing = a && a.type === 'fish';
  const aiming = a && a.type === 'shoot';
  const ang = (left ? -1 : 1) * (aiming ? -1.57 : working ? -0.9 + swing * 1.1 : fishing ? -0.7 : 0.35);
  const shx = px + ts * (left ? 3 / 8 : 5 / 8), shy = py + bob + ts * 6.5 / 8;
  ctx.save(); ctx.translate(shx, shy); ctx.rotate(ang);
  let tool = null;
  const held = k => k && TOOL_KIND[k] ? heldTool(TOOL_KIND[k], TOOL_MAT[k]) : null;
  const pickK = equipped(m, 'pick');
  if (fighting) tool = held(equipped(m, 'sword')) || held(pickK);
  else if (working) { const tt = a.type === 'dig' ? B.get(g, a.x, a.y) : a.digs && a.digs[0] ? B.get(g, a.digs[0][0], a.digs[0][1]) : T.STONE; tool = held(toolFor(m, tt)) || held(pickK); }
  else if (a && a.type === 'step') tool = held(pickK);
  if (aiming) tool = null;
  const u = ts / 8;
  if (tool) {
    ctx.save(); if (left) ctx.scale(-1, 1);
    ctx.drawImage(tool, -u * 1, -u * 9, u * 8, u * 8);
    ctx.restore();
  }
  ctx.drawImage(SPR.arm, -u, 0, u * 2, u * 4);
  ctx.restore();
  if (aiming) { // the bow out in front, with an arrow on the string till it's loosed
    const d = left ? -1 : 1, hx = shx + d * u * 4, pull = Math.min(1, a.t / BOW_DRAW) * u * 1.5;
    ctx.drawImage(bowSprite(left), hx - u * 3, shy - u * 4, u * 8, u * 8);
    ctx.fillStyle = '#d8c8a0'; ctx.fillRect(left ? hx + u * 3 - u * 4 + pull : hx - u - pull, shy - Math.max(1, u / 4), u * 4, Math.max(1, u / 2));
  }
  if (fishing) { // rod, line and bobber; the bobber dips when something bites
    const d = left ? -1 : 1, tipX = shx + d * ts * 1.5, tipY = shy - ts * 1.2;
    const bite = a.t >= a.need - 24, lv = g.w.lv[a.y * W + a.x] || 8;
    const bx = sx(a.x + 0.5), by = sy(a.y + 1 - lv / 8) + (bite ? ts * 0.14 : Math.sin(now / 420) * ts * 0.03);
    ctx.lineWidth = Math.max(1, u * 0.7); ctx.strokeStyle = '#7a5530';
    ctx.beginPath(); ctx.moveTo(shx + d * ts * 0.2, shy + ts * 0.15); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(235,235,235,0.75)';
    ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo((tipX + bx) / 2, (tipY + by) / 2 + ts * 0.5, bx, by); ctx.stroke();
    const b = Math.max(2, Math.round(u * 1.2));
    ctx.fillStyle = '#f4f0e6'; ctx.fillRect(bx - b / 2, by - b, b, b / 2 + 1);
    ctx.fillStyle = '#d8402e'; ctx.fillRect(bx - b / 2, by - b / 2, b, b / 2 + 1);
  }
};

Renderer.prototype.drawLight = function (g, ctx, x0, y0, x1, y1, sx, sy, ts, day, now) {
  const M = 8, deep = B.inUnder(g);
  const cols = x1 - x0 + 1 + M * 2, rows = y1 - y0 + 1 + M * 2;
  const n = cols * rows;
  if (!this.skyBuf || this.skyBuf.length < n) { this.skyBuf = new Float32Array(n); this.warmBuf = new Float32Array(n); this.solidBuf = new Uint8Array(n); }
  const S = this.skyBuf, Wm = this.warmBuf, SOL = this.solidBuf;
  const bx = x0 - M, by = y0 - M;
  const tl = g.w.t, top = g.w.top;
  const flick = 0.94 + Math.sin(now / 90) * 0.03 + Math.sin(now / 37) * 0.02;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = bx + i, y = by + j, k = j * cols + i;
    if (x < 0 || x >= W || y < 0 || y >= H) { S[k] = y < 0 ? 1 : 0; Wm[k] = 0; SOL[k] = 1; continue; }
    const t = tl[y * W + x];
    SOL[k] = B.isSolid(t) ? 1 : 0;
    S[k] = y < top[x] ? 1 : 0;
    Wm[k] = t === T.TORCH || t === T.LANTERN || t === T.CAMPFIRE ? 1 : t === T.COPPER_LANTERN || t === T.COPPER_TORCH || t === T.EMBERCAP || t === T.GATE || t === T.GLIMMER || t === T.WARD_DOOR ? 0.9 : t === T.LAVA ? 0.85 : t === T.FURNACE || t === T.SMOKER || t === T.BLAST_FURNACE ? 0.55 : 0;
    Wm[k] *= LIGHT_TILES.has(t) ? flameFlick(x, y, now) : flick; // each light keeps its own time; lava and furnaces share one
  }
  // miner headlamp
  const m = g.m;
  if (!m.dead && (day < 0.6 || !B.skyAt(g, m.x, m.y - 1))) {
    const i = m.x - bx, j = m.y - 1 - by;
    if (i >= 0 && i < cols && j >= 0 && j < rows) Wm[j * cols + i] = Math.max(Wm[j * cols + i], (m.inv.mining_lantern ? 1 : 0.75) * flick);
  }
  const prop = (A, dAir, dSolid) => {
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i; let v = A[k];
        const d = SOL[k] ? dSolid : dAir;
        if (i > 0 && A[k - 1] - d > v) v = A[k - 1] - d;
        if (j > 0 && A[k - cols] - d > v) v = A[k - cols] - d;
        A[k] = v;
      }
      for (let j = rows - 1; j >= 0; j--) for (let i = cols - 1; i >= 0; i--) {
        const k = j * cols + i; let v = A[k];
        const d = SOL[k] ? dSolid : dAir;
        if (i < cols - 1 && A[k + 1] - d > v) v = A[k + 1] - d;
        if (j < rows - 1 && A[k + cols] - d > v) v = A[k + cols] - d;
        A[k] = v;
      }
    }
  };
  prop(S, 0.09, 0.3); prop(Wm, 0.12, 0.34);
  if (this.light.width !== cols || this.light.height !== rows) { this.light.width = this.warm.width = cols; this.light.height = this.warm.height = rows; this.lightImg = null; }
  const lc = this.light.getContext('2d'), wc = this.warm.getContext('2d');
  if (!this.lightImg) { this.lightImg = lc.createImageData(cols, rows); this.warmImg = wc.createImageData(cols, rows); }
  const L = this.lightImg.data, WI = this.warmImg.data;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, x = bx + i, y = by + j;
    const seen = x >= 0 && x < W && y >= 0 && y < H ? g.seen[y * W + x] : 1;
    const above = x >= 0 && x < W && y <= g.w.surf[x];
    const amb = deep ? (seen ? 0.62 : 0.3) : above ? 0.24 : seen ? 0.36 : 0.15;
    const w = Math.max(0, Wm[k]);
    const lv = Math.min(1, Math.max(S[k] * day, w, amb));
    const p = k * 4;
    L[p] = 6; L[p + 1] = 7; L[p + 2] = 16; L[p + 3] = Math.round((1 - lv) * 238);
    WI[p] = 255; WI[p + 1] = 150; WI[p + 2] = 60; WI[p + 3] = Math.round(Math.max(0, w - S[k] * day * 0.6) * 70);
  }
  lc.putImageData(this.lightImg, 0, 0); wc.putImageData(this.warmImg, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const dx = sx(bx), dy = sy(by);
  ctx.drawImage(this.light, dx, dy, cols * ts, rows * ts);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(this.warm, dx, dy, cols * ts, rows * ts);
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
};

// every torch and lantern flickers at its own pace, worked out from where it stands so nothing needs saving
function flameHash(x, y, n) {
  let h = Math.imul(x * 73 + y * 9973 + n * 263 + 1, 0x9E3779B1);
  h = Math.imul(h ^ (h >>> 15), 0x85EBCA77);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
function flameFrame(x, y, now) { return Math.floor(now / (400 + flameHash(x, y, 1) * 600) + flameHash(x, y, 2) * 2) % 2; } // the picture swaps every 0.4 to 1 seconds
// a flame stands as tall as its light is bright: the tallest picture comes first
const FLAME_TILES = new Set([T.TORCH, T.COPPER_TORCH, T.LANTERN, T.COPPER_LANTERN, T.CAMPFIRE]);
function flameSize(x, y, now, sizes) { return clamp(Math.floor((0.97 - flameFlick(x, y, now)) / 0.22 * sizes), 0, sizes - 1); }
// drifts from one fresh random value to the next, so it never settles into a rhythm. Each n needs its own odd or even run of numbers, so it steps in twos
function flameDrift(x, y, n, t) {
  const i = Math.floor(t), f = t - i, ease = f * f * (3 - 2 * f);
  const from = flameHash(x, y, n + i * 2), to = flameHash(x, y, n + (i + 1) * 2);
  return (from + (to - from) * ease) * 2 - 1;
}
function flameFlick(x, y, now) {
  const slow = now / (320 + flameHash(x, y, 3) * 380) + flameHash(x, y, 5) * 1000, quick = now / (130 + flameHash(x, y, 4) * 110) + flameHash(x, y, 6) * 1000;
  return 0.86 + flameDrift(x, y, 10, slow) * 0.13 + flameDrift(x, y, 11, quick) * 0.02;
}

Renderer.prototype.drawWorld = function (g, now, opts) {
  const ctx = this.ctx, cv = this.cv, dpr = opts.dpr;
  this.updateMini(g);
  const VW = cv.width, VH = cv.height;
  const deep = B.inUnder(g), sk = deep ? UNDER_SKY[0] : skyColors(g);
  ctx.fillStyle = '#0d0f17'; ctx.fillRect(0, 0, VW, VH);
  const avail = VW - (opts.rightPad || 0) * dpr - 24 * dpr;
  const scale = Math.min(avail / W, (VH - 40 * dpr) / H);
  const w = W * scale, h = H * scale, ox = 12 * dpr + (avail - w) / 2, oy = (VH - h) / 2;
  ctx.fillStyle = sk.top; ctx.fillRect(ox, oy, w, h * 0.45);
  ctx.drawImage(this.mini, ox, oy, w, h);
  // darkness over unexplored rock
  ctx.fillStyle = 'rgba(8,8,16,' + (0.55 - sk.d * 0.2) + ')';
  if (deep) { // name the regions along the top of the map
    ctx.fillStyle = '#e8c9a0'; ctx.font = (11 * dpr) + 'px sans-serif'; ctx.textAlign = 'center';
    for (let x = 0, from = 0; x <= W; x++) if (x === W || g.w.biome[x] !== g.w.biome[from]) { ctx.fillText(B.UNDER_BIOMES[g.w.biome[from]], ox + (from + x) / 2 * scale, oy - 6 * dpr); from = x; }
  }
  // miner marker
  const m = g.m;
  if (g.trader && !B.inUnder(g)) { ctx.fillStyle = '#6fe0a8'; ctx.fillRect(ox + g.trader.x * scale - 3 * dpr, oy + (g.trader.y - 1) * scale - 3 * dpr, 6 * dpr, 6 * dpr); }
  for (const v of B.inUnder(g) ? [] : g.w.villages || []) { ctx.fillStyle = v.kind === 'ruin' ? '#a89a8a' : '#ffd98a'; for (const h of v.houses) ctx.fillRect(ox + h.x0 * scale, oy + (h.feet - 4) * scale, Math.max(2 * dpr, (h.x1 - h.x0) * scale), 3 * dpr); }
  if (this.route && !m.dead) this.drawRouteMap(g, now, ctx, ox, oy, scale, dpr);
  const mx = ox + (m.px + 0.5) * scale, my = oy + (m.py - 0.5) * scale;
  const pulse = 3 + Math.sin(now / 200) * 1.5;
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2 * dpr;
  ctx.beginPath(); ctx.arc(mx, my, (6 + pulse) * dpr, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(mx - 2 * dpr, my - 2 * dpr, 4 * dpr, 4 * dpr);
  if (m.bed && !B.inUnder(g)) { ctx.fillStyle = '#ff6a5a'; ctx.fillRect(ox + m.bed.x * scale - 2 * dpr, oy + m.bed.y * scale - 2 * dpr, 4 * dpr, 4 * dpr); }
  for (const e of g.monsters) { ctx.fillStyle = '#b06aff'; ctx.fillRect(ox + e.x * scale - 1.5 * dpr, oy + (e.y - 0.5) * scale - 1.5 * dpr, 3 * dpr, 3 * dpr); }
  this.worldBox = {ox: ox / dpr, oy: oy / dpr, scale: scale / dpr};
  this.minerScreen = {x: mx / dpr, y: (my - 14 * dpr) / dpr, ts: 8};
};

const BurrowRender = {Renderer, buildTiles, buildSprites, icon, UI_ICONS, TEX};
