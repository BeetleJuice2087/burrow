// Burrow render · textures.js — pixel helpers and the 16×16 tile, wall and furniture art.
// Plain script: uses the sim globals (Burrow, T, W, H). Load after js/sim/*.js.
'use strict';
const B = Burrow;

// ---------- small helpers ----------
let canvasMade = 0; // counted for the Under the hood panel: a steady stream of new pictures is waste
function canvas(w, h) { canvasMade++; const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function shade(rgb, f) { return 'rgb(' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v * f)))).join(',') + ')'; }
function painter(ctx) {
  return {
    px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); },
    rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  };
}
// draw ascii pixel art: rows of chars, pal maps char -> color
function art(rows, pal, scale) {
  scale = scale || 1;
  const h = rows.length, w = rows[0].length;
  const c = canvas(w * scale, h * scale), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i]; if (ch === '.' || ch === ' ') continue;
    x.fillStyle = pal[ch] || '#f0f'; x.fillRect(i * scale, j * scale, scale, scale);
  }
  return c;
}
function tint(c, col) { const o = canvas(c.width, c.height), x = o.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return o; }
function flip(c) { const o = canvas(c.width, c.height), x = o.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return o; }

// ---------- tile textures (16x16, 4 variants) ----------
const TEX = [];
const WALL = {};
const LAVA_TILES = 4; // the lava sheet is this many blocks across before it repeats
function speckle(p, r, base, amt, n) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, shade(base, 1 + (r() - 0.5) * amt));
  for (let i = 0; i < (n || 0); i++) p.px(Math.floor(r() * 16), Math.floor(r() * 16), shade(base, 0.75 + r() * 0.1));
}
function blob(p, r, cx, cy, size, col, hi) {
  for (let i = 0; i < size; i++) {
    const x = cx + Math.floor((r() - 0.5) * 4), y = cy + Math.floor((r() - 0.5) * 4);
    if (x < 1 || x > 14 || y < 1 || y > 14) continue;
    p.px(x, y, col); if (hi && r() < 0.4) p.px(x, y - 1 < 0 ? y : y - 1, hi);
  }
}
const STONE = hex('#7c7c82'), DEEP = hex('#4d4b58'), DIRT = hex('#7b5435'), SAND = hex('#dcc98c');
function paintStone(p, r, base) {
  speckle(p, r, base, 0.12, 10);
  for (let i = 0; i < 4; i++) { // cracks / blotches
    let x = Math.floor(r() * 16), y = Math.floor(r() * 16);
    for (let k = 0; k < 3 + r() * 3; k++) { p.px(x & 15, y & 15, shade(base, 0.78)); x += r() < 0.5 ? 1 : 0; y += r() < 0.5 ? 1 : 0; }
  }
  for (let i = 0; i < 5; i++) p.px(Math.floor(r() * 16), Math.floor(r() * 16), shade(base, 1.18));
}
function paintOre(p, r, base, col, hi, n) {
  paintStone(p, r, base);
  const c = hex(col);
  for (let k = 0; k < n; k++) {
    const cx = 3 + Math.floor(r() * 10), cy = 3 + Math.floor(r() * 10);
    p.px(cx, cy, shade(c, 0.8)); p.px(cx + 1, cy, col); p.px(cx, cy + 1, col); p.px(cx + 1, cy + 1, shade(c, 0.7));
    if (hi) p.px(cx + 1, cy, hi);
    if (r() < 0.5) p.px(cx - 1, cy + 1, shade(c, 0.6));
  }
}
const PAINT = {
  [T.DIRT]: (p, r) => speckle(p, r, DIRT, 0.18, 14),
  [T.GRASS]: (p, r) => { speckle(p, r, DIRT, 0.18, 12); const g = hex('#5c9c38'); for (let x = 0; x < 16; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) p.px(x, y, shade(g, 0.9 + r() * 0.25 - y * 0.04)); } },
  [T.SNOW]: (p, r) => { speckle(p, r, DIRT, 0.18, 12); for (let x = 0; x < 16; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) p.px(x, y, shade(hex('#eef2f6'), 0.95 + r() * 0.06 - y * 0.03)); } },
  [T.STONE]: (p, r) => paintStone(p, r, STONE),
  [T.DEEP]: (p, r) => { paintStone(p, r, DEEP); for (let i = 0; i < 16; i += 4) for (let x = 0; x < 16; x++) if ((x + i) % 5 === 0) p.px(x, (i + Math.floor(x / 3)) & 15, shade(DEEP, 0.85)); },
  [T.BEDROCK]: (p, r) => { speckle(p, r, hex('#2a2930'), 0.6, 30); },
  [T.SAND]: (p, r) => speckle(p, r, SAND, 0.08, 18),
  [T.SANDSTONE]: (p, r) => { speckle(p, r, hex('#cbb378'), 0.07, 6); for (const y of [4, 10, 15]) for (let x = 0; x < 16; x++) p.px(x, y, shade(hex('#cbb378'), 0.86)); },
  [T.LOG]: (p, r) => { const b = hex('#6e4a2a'); for (let x = 3; x < 13; x++) for (let y = 0; y < 16; y++) p.px(x, y, shade(b, (x % 3 === 0 ? 0.8 : 1) * (0.92 + r() * 0.14))); for (let y = 0; y < 16; y++) { p.px(3, y, shade(b, 0.65)); p.px(12, y, shade(b, 0.65)); } },
  [T.LEAVES]: (p, r) => { const g = hex('#3f7f31'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (r() < 0.1) continue; p.px(x, y, shade(g, 0.75 + r() * 0.45)); } },
  [T.PINE]: (p, r) => { const g = hex('#2c5a3e'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (r() < 0.12) continue; p.px(x, y, shade(g, 0.75 + r() * 0.4)); } },
  [T.PLANKS]: (p, r) => { const b = hex('#b48a52'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, shade(b, 0.94 + r() * 0.1)); for (const y of [3, 7, 11, 15]) for (let x = 0; x < 16; x++) p.px(x, y, shade(b, 0.7)); for (let k = 0; k < 4; k++) { const x = (k * 7 + 3) & 15; p.px(x, k * 4, shade(b, 0.7)); p.px(x, k * 4 + 1, shade(b, 0.7)); p.px(x, k * 4 + 2, shade(b, 0.7)); } },
  [T.COBBLE]: (p, r) => paintCobble(p, r, hex('#6e6e74'), null),
  [T.MOSSY]: (p, r) => paintCobble(p, r, hex('#6a6e66'), hex('#4f7a3a')),
  [T.COAL]: (p, r) => paintOre(p, r, STONE, '#26262b', '#4a4a52', 5),
  [T.COPPER]: (p, r) => paintOre(p, r, STONE, '#c8723c', '#5fc7a8', 4),
  [T.IRON]: (p, r) => paintOre(p, r, DEEP, '#d6b49a', '#f2dccb', 4),
  [T.GOLD]: (p, r) => paintOre(p, r, DEEP, '#f2c33a', '#fff3a8', 4),
  [T.GEM]: (p, r) => paintOre(p, r, DEEP, '#3fd8d0', '#d8fffb', 3),
  [T.OBSIDIAN]: (p, r) => { speckle(p, r, hex('#241a33'), 0.25, 8); for (let i = 0; i < 7; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); p.px(x, y, '#5b3a8a'); p.px(x + 1, y, '#3c2a5a'); } },
  [T.CACTUS]: (p, r) => { const g = hex('#2e7a39'); for (let y = 0; y < 16; y++) for (let x = 4; x < 12; x++) p.px(x, y, shade(g, x === 4 || x === 11 ? 0.75 : 0.95 + r() * 0.1)); for (let y = 1; y < 16; y += 3) { p.px(3, y, '#e8e2b0'); p.px(12, y + 1, '#e8e2b0'); } },
  [T.FARMLAND]: (p, r) => { speckle(p, r, DIRT, 0.18, 14); for (let x = 0; x < 16; x++) { p.px(x, 0, shade(hex('#3f2a1a'), 0.9 + r() * 0.25)); p.px(x, 1, shade(hex('#55381f'), 0.9 + r() * 0.25)); } },
  [T.BUSH]: (p, r) => paintBush(p, r, true),
  [T.BUSHE]: (p, r) => paintBush(p, r, false),
  [T.TGRASS]: (p, r) => { const g = hex('#5d9b3a'); for (let k = 0; k < 7; k++) { const x = 1 + Math.floor(r() * 14), h = 4 + Math.floor(r() * 7); for (let y = 0; y < h; y++) p.px(x + (y > h - 3 && k % 2 ? 1 : 0), 15 - y, shade(g, 0.8 + r() * 0.3)); } },
  [T.FLOWER]: (p, r) => { const cols = ['#e05a6b', '#f2c94c', '#9b7de8', '#f0f0f0']; const c = cols[Math.floor(r() * 4)]; for (let y = 9; y < 16; y++) p.px(7, y, '#4f8a33'); p.px(6, 12, '#4f8a33'); p.px(6, 7, c); p.px(8, 7, c); p.px(7, 6, c); p.px(7, 8, c); p.px(7, 7, '#f7e27a'); }
};
function paintCobble(p, r, base, moss) {
  p.rect(0, 0, 16, 16, shade(base, 0.6));
  const stones = [[0, 0, 7, 5], [7, 0, 9, 4], [0, 5, 5, 6], [5, 4, 6, 6], [11, 4, 5, 7], [0, 11, 8, 5], [8, 10, 8, 6]];
  for (const [x, y, w, h] of stones) {
    const f = 0.88 + r() * 0.25;
    p.rect(x + 1, y + 1, w - 1, h - 1, shade(base, f));
    p.rect(x + 1, y + 1, w - 2, 1, shade(base, f * 1.15));
  }
  if (moss) for (let i = 0; i < 26; i++) p.px(Math.floor(r() * 16), Math.floor(r() * 9), shade(moss, 0.8 + r() * 0.4));
}
function paintBush(p, r, berries) {
  const g = hex('#356d2c');
  for (let y = 4; y < 16; y++) for (let x = 1; x < 15; x++) {
    const dx = x - 7.5, dy = y - 10; if (dx * dx / 50 + dy * dy / 36 > 1) continue;
    p.px(x, y, shade(g, 0.75 + r() * 0.45));
  }
  if (berries) for (let k = 0; k < 6; k++) { const x = 3 + Math.floor(r() * 10), y = 6 + Math.floor(r() * 8); p.px(x, y, '#d8324a'); p.px(x, y - 1 < 0 ? 0 : y - 1, '#ff8a9a'); }
}
// furniture & placed things drawn as art
const FURN = {};
// a torch's flame at each size, tallest first. Which one shows follows the light it gives off
const TORCH_FLAMES = [
  ['.......y........', '......yyy.......', '......yYy.......', '......yOy.......', '.......O........'],
  ['................', '.......y........', '......yYy.......', '......yOy.......', '.......O........'],
  ['................', '................', '.......y........', '......yOy.......', '.......O........'],
  ['................', '................', '................', '.......y........', '.......O........']];
function torchFrames(pal, band) {
  return TORCH_FLAMES.map(flame => art(['................', '................', ...flame, '.......b........', '.......' + band + '........',
    '.......b........', '.......b........', '.......b........', '.......b........', '.......b........', '................', '................'], pal));
}
function buildFurniture() {
  FURN[T.TORCH] = torchFrames({y: '#ffe08a', Y: '#fff7d6', O: '#ff9a3c', b: '#7a5530'}, 'b');
  FURN[T.BENCH] = art([
    '................', '................', '................', '................', '.......g........', '......gg..s.....', 'wwwwwwwwwwwwwwww', 'WWWWWWWWWWWWWWWW',
    'w.w..........w.w', 'w.w..........w.w', 'w.wwwwwwwwwwww.w', 'w.w..........w.w', 'w.w..........w.w', 'w.w..........w.w', 'w.w..........w.w', 'w.w..........w.w'], {w: '#9a6a3a', W: '#c99a5c', g: '#8a8a90', s: '#6e4a2a'});
  FURN[T.FURNACE] = art([
    '................', '.cccccccccccccc.', '.cCCCCCCCCCCCCc.', '.cCccccccccccCc.', '.cCcCCCCCCCCcCc.', '.cCcCCCCCCCCcCc.', '.cCccccccccccCc.', '.cCCCCCCCCCCCCc.',
    '.cCcckkkkkkccCc.', '.cCckkkkkkkkcCc.', '.cCckOOyyOOkcCc.', '.cCckOyYYyOkcCc.', '.cCckkOOOOkkcCc.', '.cCCCCCCCCCCCCc.', '.cccccccccccccc.', '................'], {c: '#3f3f45', C: '#6c6c72', k: '#1d1d22', O: '#ff7a2a', y: '#ffc04a', Y: '#fff0b0'});
  FURN[T.CHEST] = art([
    '................', '................', '................', '................', '..bbbbbbbbbbbb..', '.bWWWWWWWWWWWWb.', '.bWwwwwwwwwwwWb.', '.bWwwwwwwwwwwWb.',
    '.bbbbbbggbbbbbb.', '.bWwwwwgywwwwWb.', '.bWwwwwggwwwwWb.', '.bWwwwwwwwwwwWb.', '.bWwwwwwwwwwwWb.', '.bWWWWWWWWWWWWb.', '.bbbbbbbbbbbbbb.', '................'], {b: '#4a2e14', W: '#b07a30', w: '#8e5f22', g: '#c9c9cf', y: '#f2d34a'});
  // a looted chest: lid flipped up behind, empty dark inside
  FURN.chestOpen = art([
    '................', '..bbbbbbbbbbbb..', '..bWWWWWWWWWWb..', '..bWwwwwwwwwWb..', '..bWwwwwwwwwWb..', '..bWWWWWWWWWWb..', '..bbbbbbbbbbbb..', '.bbbbbbbbbbbbbb.',
    '.bkkkkkkkkkkkkb.', '.bWwwwwggwwwwWb.', '.bWwwwwggwwwwWb.', '.bWwwwwwwwwwwWb.', '.bWwwwwwwwwwwWb.', '.bWWWWWWWWWWWWb.', '.bbbbbbbbbbbbbb.', '................'], {b: '#4a2e14', W: '#b07a30', w: '#8e5f22', g: '#c9c9cf', k: '#1a0f06'});
  FURN[T.BED] = art([
    '................', '................', '................', '................', '................', '................', '................', '................',
    'b...............', 'bppp............', 'bpPprrrrrrrrrrrb', 'bpPpRRRRRRRRRRRb', 'bwwwwwwwwwwwwwwb', 'bw............wb', 'b..............b', 'b..............b'], {b: '#6e4a2a', p: '#e8e4d8', P: '#ffffff', r: '#c0392b', R: '#9e2c20', w: '#9a6a3a'});
  FURN[T.DOOR] = art([
    '..bbbbbbbbbbbb..', '..bWWWWWWWWWWb..', '..bWwwwwwwwwWb..', '..bWwbbbbbbwWb..', '..bWwbwwwwbwWb..', '..bWwbwwwwbwWb..', '..bWwbbbbbbwWb..', '..bWwwwwwwwwWb..',
    '..bWwwwwwwwwWb..', '..bWwwwwwwwgWb..', '..bWwwwwwwwgWb..', '..bWwwwwwwwwWb..', '..bWwbbbbbbwWb..', '..bWwbwwwwbwWb..', '..bWwbbbbbbwWb..', '..bbbbbbbbbbbb..'], {b: '#4a2e14', W: '#a0703c', w: '#8a6036', g: '#d8c46a'});
  FURN[T.GRAVE] = art([
    '................', '................', '................', '................', '................', '................', '.....bbbbbb.....', '....b......b....',
    '...bBBBBBBBBb...', '..bBBBBBBBBBBb..', '..bBBByyBBBBBb..', '..bBBBBBBBBBBb..', '..bBBBBBBBBBBb..', '..bBBBBBBBBBBb..', '...bbbbbbbbbb...', '................'], {b: '#3a2a1a', B: '#a8743a', y: '#f2d34a'});
}
function buildTiles() {
  for (const id in PAINT) {
    TEX[id] = [];
    for (let v = 0; v < 4; v++) {
      const c = canvas(16, 16), p = painter(c.getContext('2d'));
      PAINT[id](p, B.mulberry(id * 977 + v * 131 + 7), v);
      TEX[id].push(c);
    }
  }
  // lava & water animated frames
  TEX[T.LAVA] = []; TEX[T.WATER] = [];
  // the waves fit a block exactly and repeat every 4 frames, so blocks meet with no seam. The speckle runs over a bigger sheet (see LAVA_TILES) to keep it from looking stamped
  for (let f = 0; f < 4; f++) {
    const size = LAVA_TILES * 16, c = canvas(size, size), x = c.getContext('2d'), r = B.mulberry(400 + f), k = Math.PI / 8, t = f * Math.PI / 2;
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
      const n = Math.sin(xx * k * 2 + t) + Math.cos((yy * 3 + xx) * k - t) + r() * 0.6;
      x.fillStyle = n > 1.1 ? '#ffd25a' : n > 0.2 ? '#ff8a2a' : n > -0.8 ? '#e85a1a' : '#b8380f'; x.fillRect(xx, yy, 1, 1);
    }
    TEX[T.LAVA].push(c);
  }
  for (let f = 0; f < 4; f++) {
    const w = canvas(16, 16), wx = w.getContext('2d');
    wx.fillStyle = 'rgba(52,108,214,0.42)'; wx.fillRect(0, 0, 16, 16); // see-through: what's behind and in it shows
    wx.fillStyle = 'rgba(140,190,255,0.3)';
    for (let k = 0; k < 3; k++) wx.fillRect((k * 6 + f * 2) % 16, 5 + k * 4, 4, 1);
    TEX[T.WATER].push(w);
  }
  // walls behind dug space
  const mk = (base, f) => { const c = canvas(16, 16), p = painter(c.getContext('2d')); paintStone(p, B.mulberry(f), base); const x = c.getContext('2d'); x.fillStyle = 'rgba(8,8,14,0.55)'; x.fillRect(0, 0, 16, 16); return c; };
  const pl = canvas(16, 16); pl.getContext('2d').drawImage(TEX[T.PLANKS][1], 0, 0); pl.getContext('2d').fillStyle = 'rgba(20,10,4,0.5)'; pl.getContext('2d').fillRect(0, 0, 16, 16); WALL.planks = pl;
  WALL.stone = mk(STONE, 11); WALL.deep = mk(DEEP, 12);
  const d = canvas(16, 16), dp = painter(d.getContext('2d')); speckle(dp, B.mulberry(13), DIRT, 0.18, 14); d.getContext('2d').fillStyle = 'rgba(8,6,6,0.55)'; d.getContext('2d').fillRect(0, 0, 16, 16); WALL.dirt = d;
  const s = canvas(16, 16), sp = painter(s.getContext('2d')); speckle(sp, B.mulberry(14), SAND, 0.1, 10); s.getContext('2d').fillStyle = 'rgba(30,20,10,0.5)'; s.getContext('2d').fillRect(0, 0, 16, 16); WALL.sand = s;
  const br = canvas(16, 16); br.getContext('2d').drawImage(TEX[T.STONE_BRICKS][1], 0, 0); br.getContext('2d').fillStyle = 'rgba(8,8,14,0.5)'; br.getContext('2d').fillRect(0, 0, 16, 16); WALL.bricks = br;
  buildFurniture(); buildDecor(); buildDecorItems(); buildCrops(); buildComforts();
}


// ---------- biome colours: the same blocks, in the colours of the land they're in ----------
// anything green turns the given colour, keeping its light and shade
function reskin(c, col) {
  const o = canvas(c.width, c.height), x = o.getContext('2d'); x.drawImage(c, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), to = hex(col);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2];
    if (!d.data[i + 3] || g <= r || g <= b) continue;
    const lum = g / 150;
    d.data[i] = Math.min(255, to[0] * lum); d.data[i + 1] = Math.min(255, to[1] * lum); d.data[i + 2] = Math.min(255, to[2] * lum);
  }
  x.putImageData(d, 0, 0);
  return o;
}
const RED_BANDS = ['rgba(176,70,44,0.72)', 'rgba(205,112,66,0.68)', 'rgba(222,170,112,0.6)', 'rgba(150,56,40,0.75)', 'rgba(205,112,66,0.68)'];
const BIOME_MINI = {[T.GRASS]: {4: '#5d6e34', 6: '#c0932e', 7: '#b5a544'}, [T.LEAVES]: {4: '#4a5c2a', 6: '#d97a26', 7: '#7c8a38'}, [T.DIRT]: {5: '#a8553a'}, [T.SANDSTONE]: {5: '#b8603f'}};
const BIOME_SKINS = {};
function biomeSkins() {
  const all = (t, fn) => TEX[t].map(fn), S = BIOME_SKINS;
  S[T.GRASS] = {4: all(T.GRASS, c => reskin(c, '#5d6e34')), 6: all(T.GRASS, c => reskin(c, '#c0932e')), 7: all(T.GRASS, c => reskin(c, '#b5a544'))};
  S[T.LEAVES] = {4: all(T.LEAVES, c => reskin(c, '#4e6130')), 6: all(T.LEAVES, c => reskin(c, '#df7f28')), 7: all(T.LEAVES, c => reskin(c, '#7f8e3a'))};
  S[T.TGRASS] = {4: all(T.TGRASS, c => reskin(c, '#6d8040')), 6: all(T.TGRASS, c => reskin(c, '#c89a34')), 7: all(T.TGRASS, c => reskin(c, '#cdb95a'))};
  S[T.DIRT] = {5: all(T.DIRT, c => tint(c, 'rgba(176,70,44,0.5)'))};
  S.bands = RED_BANDS.map(col => all(T.SANDSTONE, c => tint(c, col)));
}
function biomeSkin(t, b, y, v) {
  if (t !== T.GRASS && t !== T.LEAVES && t !== T.TGRASS && t !== T.DIRT && t !== T.SANDSTONE) return null;
  if (!BIOME_SKINS.bands) biomeSkins();
  if (t === T.SANDSTONE) return b === 5 ? BIOME_SKINS.bands[(y >> 1) % RED_BANDS.length][v] : null;
  const skin = BIOME_SKINS[t][b];
  return skin ? skin[v] : null;
}
