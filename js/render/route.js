// Burrow render · route.js — The route overlay: where the miner is headed, and what it will walk, dig and build on the way.
'use strict';

const ROUTE_COL = {path: '#f2b84b', dig: '#ff7a3c', build: '#62d0ff', shade: 'rgba(12,10,20,0.75)'};
// the moves still to come, turned into a line, the cells to dig, the blocks to place, and the end of it all
function routePlan(g) {
  const m = g.m, a = m.act, step = a && a.type === 'step' ? a.n : null;
  const nodes = step && m.path[0] !== step ? [step].concat(m.path) : m.path;
  let x = step ? a.fx : m.x, y = step ? a.fy : m.y;
  const pts = [{x: m.px, y: m.py}], digs = [], builds = [];
  const dig = (cx, cy) => { if (B.isSolid(B.get(g, cx, cy))) digs.push([cx, cy]); };
  const build = (cx, cy) => { if (!B.isSolid(B.get(g, cx, cy))) builds.push([cx, cy]); };
  for (const n of nodes) { // the same cells startStep will clear when it gets there
    if (n.m === 'w' || n.m === 'f' || n.m === 'b') { dig(n.x, y); dig(n.x, y - 1); }
    else if (n.m === 'u') { dig(x, y - 2); dig(n.x, y - 1); dig(n.x, y - 2); }
    else if (n.m === 'd') { dig(n.x, y); dig(n.x, y + 1); }
    else if (n.m === 'D') dig(x, y + 1);
    else if (n.m === 'p') { dig(x, y - 2); build(x, y); }
    if (n.m === 'b') build(n.x, n.y + 1);
    pts.push({x: n.x, y: n.y});
    x = n.x; y = n.y;
  }
  const last = pts[pts.length - 1], to = m.job && m.job.to;
  const far = to ? {x: to.x, y: to.y === undefined ? last.y : to.y, level: to.y === undefined} : null;
  return {pts, digs, builds, end: last, moving: nodes.length > 0, far: far && Math.abs(far.x - last.x) + Math.abs(far.y - last.y) > 3 ? far : null};
}
// a job can be between two legs for a tick or two: hold the last plan so the line doesn't blink
Renderer.prototype.routeNow = function (g, now) {
  const p = routePlan(g);
  if (p.moving || p.far) { this.routeHeld = p; this.routeAt = now; return p; }
  return this.routeHeld && now - this.routeAt < 300 ? this.routeHeld : null;
};
const routeWalk = (pts, gap, phase, fn) => { // calls fn at even steps along a line
  let left = phase;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = left;
    while (d < len) { fn(a.x + (b.x - a.x) * d / len, a.y + (b.y - a.y) * d / len); d += gap; }
    left = d - len;
  }
};
function routeCell(ctx, x, y, s, col, fill) {
  const c = Math.max(3, s / 4), w = Math.max(2, Math.round(s / 12));
  ctx.fillStyle = fill; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = col;
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]]) { // corner marks
    ctx.fillRect(dx > 0 ? cx : cx - c, dy > 0 ? cy : cy - w, c, w);
    ctx.fillRect(dx > 0 ? cx : cx - w, dy > 0 ? cy : cy - c, w, c);
  }
}
function routePin(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = ROUTE_COL.shade; ctx.fillRect(-r - 2, -r - 2, r * 2 + 4, r * 2 + 4);
  ctx.fillStyle = ROUTE_COL.path; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}
// the part of the screen the panel isn't covering, in canvas pixels. Folded or collapsed, it's only a small card: see routeBlocks
function routeArea(dpr) {
  const box = document.getElementById('panel').getBoundingClientRect();
  const side = box.height > innerHeight * 0.7, sheet = !side && box.width > innerWidth * 0.8;
  return {l: 14 * dpr, t: 14 * dpr, r: (side ? box.left : innerWidth) * dpr - 14 * dpr, b: (sheet ? box.top : innerHeight) * dpr - 14 * dpr};
}
// the cards floating over the canvas, which would hide a marker drawn under them
function routeBlocks(dpr) {
  const out = [];
  for (const q of ['.hud', '.controls', '#routeKey', '#panel']) {
    const b = document.querySelector(q).getBoundingClientRect();
    if (b.width && b.height) out.push({l: b.left * dpr, t: b.top * dpr, r: b.right * dpr, b: b.bottom * dpr});
  }
  return out;
}
const routeUnder = (blocks, x, y, pad) => blocks.find(b => x > b.l - pad && x < b.r + pad && y > b.t - pad && y < b.b + pad);
Renderer.prototype.drawRoute = function (g, now, ctx, sx, sy, ts, dpr) {
  const p = this.routeNow(g, now);
  if (!p) return;
  const area = routeArea(dpr), blocks = routeBlocks(dpr);
  for (const [x, y] of p.digs) routeCell(ctx, sx(x), sy(y), ts, ROUTE_COL.dig, 'rgba(255,122,60,0.2)');
  for (const [x, y] of p.builds) routeCell(ctx, sx(x), sy(y), ts, ROUTE_COL.build, 'rgba(98,208,255,0.25)');
  const size = Math.max(3 * dpr, Math.round(ts / 7)), dot = (x, y) => {
    const px = sx(x + 0.5) - size / 2, py = sy(y - 0.5) - size / 2;
    ctx.fillStyle = ROUTE_COL.shade; ctx.fillRect(px - 1, py - 1, size + 2, size + 2);
    ctx.fillStyle = ROUTE_COL.path; ctx.fillRect(px, py, size, size);
  };
  routeWalk(p.pts, 0.5, 0.5 - (now / 700 % 1) * 0.5, dot); // the dots march the way the miner will go
  const aim = p.far || p.end, bob = Math.sin(now / 260) * ts * 0.08;
  if (p.far && !p.far.level) { // the rest of the way hasn't been planned yet: only the heading is known
    ctx.globalAlpha = 0.4;
    routeWalk([p.end, p.far], 1.5, 1.5 - (now / 700 % 1) * 0.5, dot);
    ctx.globalAlpha = 1;
  }
  const ax = sx(aim.x + 0.5), ay = sy(aim.y - 1) - ts * 0.55 + bob;
  if (ax >= area.l && ax <= area.r && ay >= area.t && ay <= area.b && !routeUnder(blocks, ax, ay, 8 * dpr)) {
    if (!p.far || !p.far.level) routeCell(ctx, sx(aim.x), sy(aim.y - 1), ts, ROUTE_COL.path, 'rgba(242,184,75,0.1)'), routeCell(ctx, sx(aim.x), sy(aim.y), ts, ROUTE_COL.path, 'rgba(242,184,75,0.1)');
    routePin(ctx, ax, ay, Math.max(4 * dpr, ts * 0.17));
    return;
  }
  // off screen: an arrow at the edge, pointing the way, with how far it is
  const m = g.m, cx = Math.max(area.l + 10 * dpr, Math.min(area.r - 10 * dpr, ax));
  let cy = Math.max(area.t + 10 * dpr, Math.min(area.b - 10 * dpr, sy(aim.y)));
  for (let i = 0, b; i < 3 && (b = routeUnder(blocks, cx, cy, 16 * dpr)); i++) cy = b.b + 18 * dpr < area.b ? b.b + 18 * dpr : b.t - 18 * dpr; // slide out from under a card
  const ang = Math.atan2(sy(aim.y) - cy, ax - cx) || 0, s = 9 * dpr;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, -s * 0.8); ctx.lineTo(-s * 0.3, 0); ctx.lineTo(-s * 0.7, s * 0.8); ctx.closePath();
  ctx.fillStyle = ROUTE_COL.path; ctx.strokeStyle = ROUTE_COL.shade; ctx.lineWidth = 2 * dpr; ctx.stroke(); ctx.fill();
  ctx.restore();
  const away = Math.abs(aim.x - m.x) + Math.abs(aim.y - m.y), label = away + (away === 1 ? ' tile' : ' tiles');
  ctx.font = `${13 * dpr}px "Pixelify Sans", monospace`; ctx.textBaseline = 'middle';
  const w = ctx.measureText(label).width, left = cx < (area.l + area.r) / 2 ? cx + 16 * dpr : cx - 16 * dpr - w, ty = Math.max(area.t + 8 * dpr, Math.min(area.b - 8 * dpr, cy + (Math.abs(ang) > 0.5 && Math.abs(ang) < 2.6 ? -14 * dpr * Math.sign(ang) : 0)));
  ctx.fillStyle = ROUTE_COL.shade; ctx.fillRect(left - 5 * dpr, ty - 10 * dpr, w + 10 * dpr, 20 * dpr);
  ctx.fillStyle = ROUTE_COL.path; ctx.textAlign = 'left'; ctx.fillText(label, left, ty + dpr);
  ctx.textBaseline = 'alphabetic';
};
// the same thing on the world map: a thin line and a marker at the end
Renderer.prototype.drawRouteMap = function (g, now, ctx, ox, oy, scale, dpr) {
  const p = this.routeNow(g, now);
  if (!p) return;
  ctx.fillStyle = ROUTE_COL.path;
  routeWalk(p.pts, Math.max(1, 3 * dpr / scale), 0, (x, y) => ctx.fillRect(ox + (x + 0.5) * scale - dpr, oy + (y - 0.5) * scale - dpr, 2 * dpr, 2 * dpr));
  const aim = p.far || p.end;
  routePin(ctx, ox + (aim.x + 0.5) * scale, oy + (aim.y - 0.5) * scale, 4 * dpr);
};
