// Burrow render · portal.js — Motes of ember light drifting into the gate, on whichever side of it the miner is.
'use strict';

// the gate in the realm on show, once it's actually standing
function gateNow(g) {
  const c = B.inUnder(g) ? g.w.gate : g.m.gate;
  return c && B.get(g, c.x, c.y) === T.GATE && B.get(g, c.x, c.y - 1) === T.GATE ? c : null;
}
const GATE_MOTES = ['#ffd24a', '#ff8a3a', '#ff5a2a', '#ffb060', '#d8a0ff'];
Renderer.prototype.drawGateMotes = function (g, ctx, sx, sy, ts) {
  const c = gateNow(g);
  if (!c) return;
  const px = sx(c.x + 0.5), py = sy(c.y); // the middle of the two-block opening
  if (px < -ts * 5 || px > this.cv.width + ts * 5 || py < -ts * 5 || py > this.cv.height + ts * 5) return;
  const t = this.wildT, size = Math.max(2, Math.round(ts / 10));
  for (let i = 0; i < 34; i++) {
    const h = wildHash(c.x, i, 41), life = 1800 + h % 1600, p = (t / life + (h >>> 8) / 991) % 1;
    // each one starts out in the air around the gate and spirals in, faster at the end
    const r = (1 - p * p) * (1.1 + (h >>> 4) % 12 / 13), a = (h >>> 12) / 57 + p * 2.4, x = px + Math.cos(a) * r * ts, y = py + Math.sin(a) * r * ts * 1.25;
    ctx.globalAlpha = Math.min(1, p * 5) * (p > 0.9 ? (1 - p) * 10 : 1) * 0.9;
    ctx.fillStyle = GATE_MOTES[h % GATE_MOTES.length];
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
    // a soft halo and a tail pointing back the way it came
    ctx.globalAlpha *= 0.35;
    ctx.fillRect(Math.round(x) - size, Math.round(y) - size, size * 3, size * 3);
    const back = 1 + p * 0.5;
    ctx.fillRect(Math.round(px + (x - px) * back), Math.round(py + (y - py) * back), size, size);
  }
  ctx.globalAlpha = 1;
};
