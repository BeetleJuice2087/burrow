// Burrow render · comforts.js — Home comforts: their pictures, and the moving parts drawn over them (the vane turning in the wind,
// chimes swaying, water in the barrel, trophies on the shelf), the kite on its string, and the pet curled up in its bed.
// Drawn only: what they do is in sim/comforts.js.
'use strict';

const COMFORT_ART = {
  weathervane: {rows: ['................', '................', '................', '................', '................', '.......bb.......', '.......kk.......', '.......kk.......', '.....k.kk.k.....', '......kkkk......', '.......kk.......', '.......kk.......', '.......kk.......', '.......kk.......', '......kkkk......', '.....kkkkkk.....'], pal: {k: '#3a3440', b: '#c88a4a'}},
  trophy_shelf: {rows: ['................', '................', '................', '................', '................', '................', '.wwwwwwwwwwwwww.', '.WWWWWWWWWWWWWW.', '..k..........k..', '................', '................', '................', '.wwwwwwwwwwwwww.', '.WWWWWWWWWWWWWW.', '..k..........k..', '................'], pal: {w: '#c8955a', W: '#7a5232', k: '#4a3020'}},
  map_table: {rows: ['................', '................', '................', '................', '................', '................', '................', '..pppppppppppp..', '..pPPpgpPpPPpp..', '.wwwwwwwwwwwwwww', '.WWWWWWWWWWWWWWW', '..W..........W..', '..W..........W..', '..W..........W..', '..W..........W..', '.WWW........WWW.'], pal: {w: '#c8955a', W: '#7a5232', p: '#e8dcb4', P: '#b8a878', g: '#6a9a4a'}},
  rain_barrel: {rows: ['................', '................', '................', '................', '................', '....bbbbbbbb....', '...bwWwWwWwWb...', '...iiiiiiiiii...', '...bWwWwWwWwb...', '...bwWwWwWwWb...', '...bWwWwWwWwb...', '...iiiiiiiiii...', '...bwWwWwWwWb...', '...bWwWwWwWwb...', '....bbbbbbbb....', '................'], pal: {b: '#4a3020', w: '#8a6036', W: '#a8743e', i: '#6a6a74'}},
  wind_chimes: {rows: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................'], pal: {}},
  pet_bed: {rows: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '..rr........rr..', '.rRRr......rRRr.', '.rRRccccccccRRr.', '.rRRRRRRRRRRRRr.', '..rrrrrrrrrrrr..', '................'], pal: {r: '#7a2e24', R: '#b8503a', c: '#e8d8b0'}}
};
MISC_ICONS.kite = {rows: ['.......r........', '......rRr.......', '.....rRRRr......', '....rRRyRRr.....', '...rRRyyyRRr....', '....rRRyRRr.....', '.....rRRRr......', '......rRr.......', '.......r........', '.......w........', '........w..b....', '.........w.b....', '.........w......', '........w...b...', '.......w....b...', '................'], pal: {r: '#8a2a2a', R: '#e04a3a', y: '#ffd24a', w: '#e6dcc4', b: '#4a8ad0'}};
// food and charms
MISC_ICONS.glow_broth = {rows: ['................', '................', '......kkkk......', '.......cc.......', '......cGGc......', '.....cGgGGc.....', '....cGGGGgGc....', '....cGgGGGGc....', '....cGGGGGgc....', '....cgGGgGGc....', '.....cGGGGc.....', '......cccc......', '................', '................', '................', '................'], pal: {k: '#6a4a2a', c: '#a8b4c8', G: '#9ad8ff', g: '#e8f8ff'}};
MISC_ICONS.firewalk_tea = {rows: ['................', '................', '................', '....w..w........', '.....w..w.......', '................', '...cccccccc.....', '...cOOOOOOcccc..', '...cOoOOOOc..c..', '...cOOOOoOc..c..', '...cOOOOOOcccc..', '....cOOOOc......', '.....cccc.......', '................', '................', '................'], pal: {c: '#d8d0c0', O: '#e8702a', o: '#ffd24a', w: '#e8e8f0'}};
MISC_ICONS.camp_stew = {rows: ['................', '................', '.....w...w......', '......w...w.....', '................', '..kkkkkkkkkkkk..', '..kBBMBBpBBMBk..', '..kBpBBBBBpBBk..', '...kkkkkkkkkk...', '...kKKKKKKKKk...', '....kKKKKKKk....', '.....kkkkkk.....', '................', '................', '................', '................'], pal: {k: '#2a2a32', K: '#4a4a54', B: '#a8602e', M: '#6a3a1a', p: '#e8c84a', w: '#e8e8f0'}};
MISC_ICONS.lucky_charm = {rows: ['................', '.......yy.......', '......y..y......', '......y..y......', '.......yy.......', '.......yy.......', '......gggg......', '.....gGGGGg.....', '....gGGWGGGg....', '....gGGGGGGg....', '.....gGGGGg.....', '......gGGg......', '.......gg.......', '................', '................', '................'], pal: {y: '#e8c84a', g: '#2a8a4a', G: '#4ad87a', W: '#d8ffe0'}};
function buildComforts() {
  const pic = k => art(COMFORT_ART[k].rows, COMFORT_ART[k].pal);
  FURN[T.WEATHERVANE] = pic('weathervane'); FURN[T.TROPHY_SHELF] = pic('trophy_shelf'); FURN[T.MAP_TABLE] = pic('map_table');
  FURN[T.RAIN_BARREL] = pic('rain_barrel'); FURN[T.WIND_CHIMES] = pic('wind_chimes'); FURN[T.PET_BED] = pic('pet_bed');
  // the chimes' own icon: drawn once, hanging still
  const c = canvas(16, 16), x = c.getContext('2d');
  x.fillStyle = '#4a3020'; x.fillRect(2, 2, 12, 2);
  [[3, 9], [6, 12], [9, 10], [12, 7]].forEach(([cx, h]) => { x.fillStyle = '#e6dcc4'; x.fillRect(cx, 4, 1, 2); x.fillStyle = '#c88a4a'; x.fillRect(cx, 6, 2, h - 2); x.fillStyle = '#f2c070'; x.fillRect(cx, 6, 1, h - 2); });
  CHIME_ICON = c;
}
let CHIME_ICON = null;
const TROPHY_ART = {};
const _decorIconArt = decorIconArt;
decorIconArt = function (name) { return name === 'wind_chimes' && CHIME_ICON ? CHIME_ICON : _decorIconArt(name); };
// what goes on the shelf: the biggest moments so far, best first
const TROPHIES = [['q_warden', 'ember_crown'], ['q_open', 'ward_key'], ['c_cinder_sword', 'cinder_sword'], ['c_reinforced_pick', 'reinforced_pick'], ['c_gem_pick', 'gem_pick'],
  ['first_gem', 'gem'], ['first_grapple', 'grapple'], ['first_net', 'silk_net'], ['c_iron_sword', 'iron_sword'], ['first_raw_gold', 'gold_ingot'], ['c_fishing_rod', 'raw_fish'], ['first_kill', 'stone_sword']];

Renderer.prototype.drawComforts = function (g, ctx, sx, sy, ts, now, x0, y0, x1, y1) {
  if (g.realm === 'under') { this.drawCharm(g, ctx, sx, sy, ts, now); return; }
  const W = B.W, tl = g.w.t, CT = [T.WEATHERVANE, T.WIND_CHIMES, T.RAIN_BARREL, T.TROPHY_SHELF];
  let wind = null, fill = null, prizes = null;
  for (let y = Math.max(1, y0); y <= y1; y++) for (let x = Math.max(1, x0); x <= x1; x++) {
    const t = tl[y * W + x];
    if (!CT.includes(t)) continue;
    const px = sx(x), py = sy(y), u = ts / 16;
    if (t === T.WEATHERVANE) { // the arrow points down the wind, turning idly when it's light
      wind = wind || windNow(g);
      const a = (wind.dir > 0 ? 0 : Math.PI) + Math.sin(now / (900 - wind.s * 600) + x) * (1 - wind.s) * 1.6 + Math.sin(now / 90 + x) * wind.s * 0.15;
      const c = Math.cos(a), cx = px + 8 * u, cy = py + 4 * u, L = 6.5 * u;
      ctx.fillStyle = '#2a2430'; ctx.fillRect(cx - L * c - u * 0.5, cy - u * 0.5, L * 2 * c + u, u * 1.4);
      ctx.fillStyle = '#c88a4a'; ctx.fillRect(cx + L * c - (c > 0 ? 2 * u : 0), cy - 1.5 * u, 2 * u * Math.max(0.3, Math.abs(c)), 3.4 * u); // the head
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(cx - L * c - (c > 0 ? 0 : 1.5 * u), cy - 2 * u, 1.5 * u * Math.max(0.3, Math.abs(c)), 4 * u); // the tail
    } else if (t === T.WIND_CHIMES) { // a bar off the wall, tubes swinging under it
      wind = wind || windNow(g);
      const side = B.isSolid(tl[y * W + x - 1]) ? -1 : 1, bx = side < 0 ? px : px + 4 * u;
      ctx.fillStyle = '#4a3020'; ctx.fillRect(bx, py + 2 * u, 12 * u, 1.5 * u);
      [[2, 9], [5, 12], [8, 10], [11, 7]].forEach(([o, h], i) => {
        const sw = Math.sin(now / (260 - wind.s * 120) + i * 1.7 + x) * (0.08 + wind.s * 0.45);
        ctx.save(); ctx.translate(bx + o * u, py + 3.5 * u); ctx.rotate(sw);
        ctx.fillStyle = '#e6dcc4'; ctx.fillRect(-u * 0.25, 0, u * 0.5, 2 * u);
        ctx.fillStyle = '#c88a4a'; ctx.fillRect(-u, 2 * u, 2 * u, h * u * 0.8);
        ctx.fillStyle = '#f2c070'; ctx.fillRect(-u, 2 * u, u, h * u * 0.8);
        ctx.restore();
      });
    } else if (t === T.RAIN_BARREL) { // the water line inside the rim
      fill = fill === null ? barrelFill(g) : fill;
      const h = Math.max(1, Math.round(fill * 3)) * u;
      ctx.fillStyle = 'rgba(70,130,220,0.9)'; ctx.fillRect(px + 4 * u, py + 5 * u + (3 * u - h), 8 * u, h);
      ctx.fillStyle = 'rgba(200,225,255,0.8)'; ctx.fillRect(px + 4 * u, py + 5 * u + (3 * u - h), 8 * u, u * 0.6);
    } else if (t === T.TROPHY_SHELF) { // two to a shelf
      prizes = prizes || TROPHIES.filter(([id]) => g.stats.milestones.some(s => s.id === id)).slice(0, 4).map(q => TROPHY_ART[q[1]] || (TROPHY_ART[q[1]] = iconArt(q[1]))).filter(Boolean);
      prizes.forEach((img, i) => ctx.drawImage(img, px + (i % 2 ? 8.5 : 1.5) * u, py + (i < 2 ? 0 : 6) * u, 6 * u, 6 * u));
    }
  }
  this.drawKite(g, ctx, sx, sy, ts, now);
  this.drawCharm(g, ctx, sx, sy, ts, now);
};
// the lucky charm hanging off the back of the pack, and motes drifting off it while glow broth is working
Renderer.prototype.drawCharm = function (g, ctx, sx, sy, ts, now) {
  const m = g.m;
  if (m.dead || g.palTurn) return;
  const u = ts / 16, d = m.facing || 1;
  if (m.inv.lucky_charm) {
    const cx = sx(m.px + 0.5 - d * 0.42), cy = sy(m.py - 0.95) + Math.sin(now / 260) * u * 0.6;
    ctx.fillStyle = '#e8c84a'; ctx.fillRect(cx - u * 0.5, cy - 2 * u, u, 2 * u);
    ctx.fillStyle = '#2a8a4a'; ctx.fillRect(cx - 1.5 * u, cy, 3 * u, 3 * u);
    ctx.fillStyle = '#6ae88a'; ctx.fillRect(cx - u, cy + u * 0.5, u, u);
  }
  if (m.glowUntil > g.tick) for (let i = 0; i < 5; i++) {
    const p = ((now / 1800) + i / 5) % 1, a = i * 2.4 + now / 900;
    ctx.fillStyle = 'rgba(170,220,255,' + (0.8 * (1 - p)).toFixed(2) + ')';
    ctx.fillRect(sx(m.px + 0.5 + Math.cos(a) * 0.6) - u, sy(m.py - 1 - p * 1.4 + Math.sin(a) * 0.3) - u, 2 * u, 2 * u);
  }
};
// out on a breezy afternoon: the kite high up on its string, bobbing and diving
Renderer.prototype.drawKite = function (g, ctx, sx, sy, ts, now) {
  const m = g.m, a = m.act;
  if (m.dead || !a || a.type !== 'kite') return;
  const up = Math.min(1, a.t / (B.TPS * 3)), d = m.facing || 1, w = windNow(g).s;
  const kx = m.px + 0.5 + d * (2 + up * (5 + w * 3)) + Math.sin(now / 700) * 0.6, ky = m.py - 1.6 - up * (6 + w * 3) + Math.sin(now / 430) * 0.5 + Math.sin(now / 170) * 0.15;
  const hx = sx(m.px + 0.5 + d * 0.3), hy = sy(m.py - 0.9), tx = sx(kx), tyy = sy(ky);
  ctx.strokeStyle = 'rgba(230,220,196,0.85)'; ctx.lineWidth = Math.max(1, ts / 20);
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + tx) / 2, Math.max(hy, tyy) - (hy - tyy) * 0.15, tx, tyy); ctx.stroke();
  const tilt = Math.sin(now / 300) * 0.3, s = ts * 0.55;
  ctx.save(); ctx.translate(tx, tyy); ctx.rotate(tilt);
  ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s * 1.1); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(0, -s * 0.45); ctx.lineTo(s * 0.32, 0); ctx.lineTo(0, s * 0.5); ctx.lineTo(-s * 0.32, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a8ad0'; // the tail, flicking about
  for (let i = 1; i <= 4; i++) ctx.fillRect(Math.sin(now / 120 + i) * s * 0.3 * i * 0.4 - s * 0.12, s * 1.1 + i * s * 0.4, s * 0.24, s * 0.16);
  ctx.restore();
};
// the pet's bed at home, if there is one close by
function petBedNear(g, x0, y0) {
  for (let y = y0 - 8; y <= y0 + 3; y++) for (let x = x0 - 16; x <= x0 + 16; x++) if (B.get(g, x, y) === T.PET_BED) return {x, y};
  return null;
}
