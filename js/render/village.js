// Burrow render · village.js — The people of the villages: drawn from v.folk, nothing here touches the sim.
// Plain script (no modules): shares top-level names with the other render files. Load order is set in index.html.
'use strict';

const FOLK_ROWS = ['...HH...', '..HHHH..', '..HSSH..', '..SESS..', '..SSSS..', '...SS...', '..CCCC..', '.CCCCCC.', '.SCCCCS.', '.SCCCCS.', '..CCCC..', '..AAAA..', '..AAAA..', '..A..A..', '..A..A..', '..B..B..'];
const FOLK_STEP = ['...HH...', '..HHHH..', '..HSSH..', '..SESS..', '..SSSS..', '...SS...', '..CCCC..', '.CCCCCC.', '.SCCCCS.', '.SCCCCS.', '..CCCC..', '..AAAA..', '..AAAA..', '.AA..A..', '.A...A..', '.B...B..'];
const FOLK_LOOKS = [{H: '#6a4426', S: '#e0b48c', E: '#1d1d24', C: '#a84848', A: '#e0cfa8', B: '#4a3428'}, {H: '#d0d0d0', S: '#c89870', E: '#1d1d24', C: '#4a78a8', A: '#6a5a48', B: '#3a2a20'},
  {H: '#2a2a30', S: '#9a6a48', E: '#1d1d24', C: '#c8a040', A: '#5a7a4a', B: '#3a2a20'}, {H: '#c87838', S: '#f0c8a0', E: '#1d1d24', C: '#6a8a58', A: '#8a5a7a', B: '#4a3428'}];
const PAL_ARM = ['RR', 'RR', 'RR', 'SS'];
const PAL_LOOKS = [{H: '#2f8f88', h: '#21645f', L: '#2f8f88', R: '#2f8f88', r: '#21645f', O: '#4a4238', o: '#38322a', B: '#3a2a20'},
  {H: '#5a6fc0', h: '#414f8c', L: '#5a6fc0', R: '#5a6fc0', r: '#414f8c', O: '#3c3a48', o: '#2c2a36', S: '#f0c8a0', s: '#d0a47c', B: '#b8622e'},
  {H: '#b0568f', h: '#7e3d66', L: '#b0568f', R: '#b0568f', r: '#7e3d66', O: '#4a3a3a', o: '#382c2c', S: '#9a6a48', s: '#7c5438', B: '#e8dfc8'},
  {H: '#6a9a3e', h: '#4c6e2c', L: '#6a9a3e', R: '#6a9a3e', r: '#4c6e2c', O: '#46402c', o: '#343020', S: '#d8a878', s: '#b88a5e', B: '#23232a'}];
// built like the miner: the same body, walk and arm, with a tool in hand
Renderer.prototype.palSkin = function (look) {
  if (!this.palSkins) this.palSkins = [];
  if (!this.palSkins[look]) {
    const pal = Object.assign({}, SPR.base.pal, PAL_LOOKS[look]), R = SPR.base.legs.map(l => art(SPR.base.top.concat(l), pal));
    const L = R.map(flip);
    this.palSkins[look] = {R, L, hurt: R, hurtL: L, arm: art(PAL_ARM, pal)};
  }
  return this.palSkins[look];
};
Renderer.prototype.drawPal = function (g, ctx, sx, sy, ts, now) {
  const p = g.m.pal;
  this.palScreen = null;
  if (!p || p.dead || (p.mode === 'camp' && B.inUnder(g))) return;
  if (p.mode === 'camp') { // a miner of their own: drawn just as the miner is
    this.drawMiner(g, ctx, sx, sy, ts, now, p, p.look);
    this.palName(ctx, p, sx(p.px), sy(p.py - 1), ts);
    this.palScreen = {x: sx(p.px + 0.5), y: sy(p.py - 1.6), ts, at: p.mode};
    return;
  }
  const skin = this.palSkin(p.look), left = p.facing < 0, u = ts / 8;
  const walkF = p.step ? 1 + (Math.floor(now / 110) % 2) : 0, bob = walkF === 1 ? -ts / 16 : 0;
  const px = sx(p.px), py = sy(p.py - 1);
  if (p.dig && p.work === 'dig') { // the same cracks as the miner's dig
    const dx = p.dig.x, dy = p.dig.y, n = Math.floor(p.dig.n / p.dig.need * 6), r = B.mulberry(dx * 31 + dy);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < n * 4; i++) ctx.fillRect(sx(dx) + Math.floor(r() * 14 + 1) * ts / 16, sy(dy) + Math.floor(r() * 14 + 1) * ts / 16, ts / 8, ts / 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(sx(dx) + 0.5, sy(dy) + 0.5, ts - 1, ts - 1);
  }
  ctx.drawImage((left ? skin.L : skin.R)[walkF], px, py + bob, ts, ts * 2);
  // the miner's arm: the swing follows the sim, so it speeds up with the game, and the tool is the one the miner carries
  const m = g.m, sw = p.work ? Math.sin((p.swing || 0) * 0.55) : 0, ang = (left ? -1 : 1) * (p.work ? -0.9 + sw * 1.1 : 0.35);
  const held = k => k && TOOL_KIND[k] ? heldTool(TOOL_KIND[k], TOOL_MAT[k]) : null, pick = held(equipped(m, 'pick'));
  const tool = p.work === 'fight' ? held(equipped(m, 'sword')) || pick : p.work || p.step ? pick : null;
  ctx.save(); ctx.translate(px + ts * (left ? 3 / 8 : 5 / 8), py + bob + ts * 6.5 / 8); ctx.rotate(ang);
  if (tool) { ctx.save(); if (left) ctx.scale(-1, 1); ctx.drawImage(tool, -u, -u * 9, u * 8, u * 8); ctx.restore(); }
  ctx.drawImage(skin.arm, -u, 0, u * 2, u * 4);
  ctx.restore();
  this.palName(ctx, p, px, py, ts);
  this.palScreen = {x: px + ts / 2, y: py - ts * 0.6, ts, at: p.mode};
};
Renderer.prototype.palName = function (ctx, p, px, py, ts) {
  const u = ts / 8;
  ctx.font = '600 ' + Math.min(18, Math.max(11, ts * 0.45)) + 'px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,8,14,0.75)'; ctx.fillText(p.name, px + ts / 2 + 1, py - u * 3);
  ctx.fillStyle = '#9fe8e0'; ctx.fillText(p.name, px + ts / 2, py - u * 3 - 1);
};
Renderer.prototype.drawFolk = function (g, ctx, sx, sy, ts) {
  if (!this.folkArt) this.folkArt = FOLK_LOOKS.map(p => { const a = [art(FOLK_ROWS, p), art(FOLK_STEP, p)]; return [a, a.map(flip)]; });
  for (const v of g.w.villages || []) for (const p of v.folk || []) {
    const walking = Math.abs(p.x - p.px) > 0.05, frame = walking && Math.floor(p.px * 3) % 2 ? 1 : 0;
    ctx.drawImage(this.folkArt[p.look][p.facing < 0 ? 1 : 0][frame], sx(p.px), sy(p.py - 1), ts, ts * 2);
  }
};
