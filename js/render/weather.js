// Burrow render · weather.js — Rain, snow on the peaks, storm clouds, and the storm's light and lightning.
'use strict';

const DROPS = Array.from({length: 320}, (_, i) => { const r = mulberry(i * 7 + 3); return {x: r(), y: r(), s: 0.7 + r() * 0.6}; });
// the storm front: heaps of round puffs painted once into small canvases (day, night and lightning-lit), then scrolled. One pixel is one cell
const CLOUD_W = 512, CLOUD_H = 76;
function cloudShades(seed) {
  const r = mulberry(seed), out = new Float32Array(CLOUD_W * CLOUD_H).fill(-1);
  for (let y = 0; y < CLOUD_H - 26; y++) for (let x = 0; x < CLOUD_W; x++) out[y * CLOUD_W + x] = 0.8 * (1 - 0.38 * y / CLOUD_H); // the dark gaps between puffs
  for (let row = 4; row < CLOUD_H - 22; row += 8) for (let x = r() * 8; x < CLOUD_W; x += 7 + r() * 10) {
    const rad = (6 + r() * 6) * (1 + row / CLOUD_H * 0.5), cy = row + r() * 4, depth = 1 - 0.38 * row / CLOUD_H;
    for (let dy = -Math.ceil(rad); dy <= rad; dy++) for (let dx = -Math.ceil(rad); dx <= rad; dx++) {
      const py = Math.round(cy + dy), px = (Math.round(x + dx) + CLOUD_W) % CLOUD_W;
      if (py < 0 || py >= CLOUD_H || dx * dx + dy * dy > rad * rad) continue;
      out[py * CLOUD_W + px] = (1.2 - Math.round(Math.hypot(dx / rad + 0.2, dy / rad + 0.45) * 3) / 3 * 0.5) * depth; // round: bright high up, shadowed at the rim, in hard pixel steps
    }
  }
  return out;
}
function cloudBake(shades, tint) {
  const cv = document.createElement('canvas'); cv.width = CLOUD_W; cv.height = CLOUD_H;
  const c = cv.getContext('2d'), img = c.createImageData(CLOUD_W, CLOUD_H);
  shades.forEach((v, i) => { if (v < 0) return; for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.min(255, tint[k] * v); img.data[i * 4 + 3] = 255; });
  c.putImageData(img, 0, 0);
  return cv;
}
let cloudLayers = null;
const weatherLabel = g => { const w = B.weatherNow(g); return w.type === 'clear' || w.level < 0.2 ? '' : w.type === 'storm' ? ' · Storm' : ' · Rain'; };
// dims the sky and the daylight; sk is the frame's own copy of the sky
Renderer.prototype.weatherSky = function (g, sk, ctx, VW, VH) {
  const w = B.weatherNow(g);
  this.wxT = this.wxT || 0;
  if (!w.level) return null;
  const k = w.level * (w.type === 'storm' ? 0.7 : 0.45);
  ctx.fillStyle = `rgba(66,72,86,${k})`; ctx.fillRect(0, 0, VW, VH);
  sk.d = sk.d * (1 - k * 0.6);
  return w;
};
// drawn over the sun and the fair-weather clouds, behind the land. It rolls in from the top as the weather builds
Renderer.prototype.drawStormClouds = function (g, w, ctx, ts, cx, topY, VW, VH, day) {
  cloudLayers = cloudLayers || [3, 8].map(seed => { const sh = cloudShades(seed); return {day: cloudBake(sh, [122, 130, 148]), night: cloudBake(sh, [40, 44, 58]), lit: cloudBake(sh, [214, 218, 240])}; });
  // the puffs never get so small that the heap stops short of the top of the screen
  const storm = w.type === 'storm', cell = Math.max(3, Math.round(ts * 0.2), Math.ceil(VH * 0.46 / (CLOUD_H - 8))), t = (this.wildT || 0) / 1000, width = CLOUD_W * cell, height = CLOUD_H * cell;
  const base = Math.round(VH * (storm ? 0.46 : 0.38) - (1 - Math.min(1, w.level * 1.3)) * VH * 0.65);
  const fade = Math.min(1, w.level * 2.5), dark = Math.max(1 - day, storm ? 0.42 : 0.12);
  this.cloudPx = base; this.cloudY = topY + base / ts;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  cloudLayers.forEach((layer, i) => {
    const y = base - height + (i ? 0 : cell * 5), off = (((t * (storm ? 1.6 : 0.8) * (0.6 + i * 0.5) - (cx + wildOff(g)) * (0.2 + i * 0.16) * ts / cell) * cell) % width + width) % width;
    for (const [img, a] of [[layer.day, fade], [layer.night, fade * dark], [layer.lit, fade * (this.flash || 0) * 0.75]]) {
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      for (let x = Math.round(off) - width; x < VW; x += width) ctx.drawImage(img, x, y, width, height);
    }
  });
  ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = smooth;
};
Renderer.prototype.drawWeather = function (g, w, ctx, sx, sy, ts, x0, x1, left, topY, VW, VH, dpr, still) {
  const t = this.wildT, count = Math.floor(DROPS.length * w.level * (w.type === 'storm' ? 1 : 0.55));
  for (let i = 0; i < count; i++) {
    const d = DROPS[i], fall = t / 1000 * d.s;
    const px = ((d.x + fall * 0.09) % 1) * VW, py = ((d.y + fall * 1.5) % 1) * VH;
    const col = Math.floor(left + px / ts);
    if (col < 0 || col >= B.W || topY + py / ts >= g.w.top[col] || py < (this.cloudPx || 0)) continue; // falls from the cloud, stops at the roof or the ground
    const b = g.w.biome[col];
    if (b === 0) { // snow drifts
      const sway = Math.sin(t / 500 + i) * 6 * dpr, sz = Math.max(2, ts / 12), sy2 = ((d.y + fall * 0.32) % 1) * VH;
      if (topY + sy2 / ts >= g.w.top[col] || sy2 < (this.cloudPx || 0)) continue;
      ctx.fillStyle = 'rgba(240,244,250,0.85)'; ctx.fillRect(px + sway, sy2, sz, sz);
    } else {
      ctx.fillStyle = 'rgba(170,196,230,0.55)'; ctx.fillRect(px, py, Math.max(1, ts / 20), ts * 0.4);
    }
  }
  if (w.type !== 'storm' || w.level < 0.6) return;
  const m = g.m, open = g.w.top[Math.max(0, Math.min(B.W - 1, m.x))] + 8 > topY;
  if (!still && !this.flash && Math.random() < 0.007) { // sometimes a strike in view, sometimes only the clouds lighting up far off
    const far = Math.random() < 0.4;
    this.flash = far ? 0.55 : 1; this.flick = Math.random() < 0.6 ? 6 : 0; this.bolt = [];
    if (!far) {
      const c = Math.floor(x0 + Math.random() * (x1 - x0)), end = g.w.top[Math.max(0, Math.min(B.W - 1, c))];
      const fork = (x, y, stop, main) => { // one jagged line; the main one throws off short branches
        const line = [[x, y]];
        this.bolt.push(line);
        while (y < stop) {
          y = Math.min(stop, y + 0.5 + Math.random() * 1.1); x += (Math.random() - 0.5) * 1.5;
          line.push([x, y]);
          if (main && y < stop - 2 && Math.random() < 0.13) fork(x, y, Math.min(stop, y + 2 + Math.random() * 4));
        }
      };
      fork(c, this.cloudY === undefined ? topY - 1 : this.cloudY, end, true);
    }
    if (m.y - g.w.top[m.x] <= 12) { this.boom = true; this.boomFar = far; }
  }
  if (this.flash) {
    if (open) {
      ctx.fillStyle = `rgba(226,232,255,${this.flash * 0.28})`; ctx.fillRect(0, 0, VW, VH);
      if (this.flash > 0.3 && this.bolt && this.bolt.length) {
        ctx.lineJoin = 'miter';
        for (const [colour, wide] of [['rgba(170,190,255,0.35)', Math.max(5, ts / 3.5)], ['#f4f6ff', Math.max(2, ts / 10)]]) {
          ctx.strokeStyle = colour; ctx.lineWidth = wide;
          ctx.beginPath();
          for (const line of this.bolt) line.forEach(([x, y], i) => i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)));
          ctx.stroke();
        }
      }
    }
    this.flash = this.flash < 0.04 ? 0 : this.flash * 0.86;
    if (this.flick && --this.flick === 0) this.flash = Math.max(this.flash, 0.8); // the second flicker of the same strike
  }
};
