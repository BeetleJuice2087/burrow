// Burrow render · village.js — The people of the villages: drawn from v.folk, nothing here touches the sim.
// Plain script (no modules): shares top-level names with the other render files. Load order is set in index.html.
'use strict';

const FOLK_ROWS = ['...HH...', '..HHHH..', '..HSSH..', '..SESS..', '..SSSS..', '...SS...', '..CCCC..', '.CCCCCC.', '.SCCCCS.', '.SCCCCS.', '..CCCC..', '..AAAA..', '..AAAA..', '..A..A..', '..A..A..', '..B..B..'];
const FOLK_STEP = ['...HH...', '..HHHH..', '..HSSH..', '..SESS..', '..SSSS..', '...SS...', '..CCCC..', '.CCCCCC.', '.SCCCCS.', '.SCCCCS.', '..CCCC..', '..AAAA..', '..AAAA..', '.AA..A..', '.A...A..', '.B...B..'];
const FOLK_LOOKS = [{H: '#6a4426', S: '#e0b48c', E: '#1d1d24', C: '#a84848', A: '#e0cfa8', B: '#4a3428'}, {H: '#d0d0d0', S: '#c89870', E: '#1d1d24', C: '#4a78a8', A: '#6a5a48', B: '#3a2a20'},
  {H: '#2a2a30', S: '#9a6a48', E: '#1d1d24', C: '#c8a040', A: '#5a7a4a', B: '#3a2a20'}, {H: '#c87838', S: '#f0c8a0', E: '#1d1d24', C: '#6a8a58', A: '#8a5a7a', B: '#4a3428'}];
Renderer.prototype.drawFolk = function (g, ctx, sx, sy, ts) {
  if (!this.folkArt) this.folkArt = FOLK_LOOKS.map(p => { const a = [art(FOLK_ROWS, p), art(FOLK_STEP, p)]; return [a, a.map(flip)]; });
  for (const v of g.w.villages || []) for (const p of v.folk || []) {
    const walking = Math.abs(p.x - p.px) > 0.05, frame = walking && Math.floor(p.px * 3) % 2 ? 1 : 0;
    ctx.drawImage(this.folkArt[p.look][p.facing < 0 ? 1 : 0][frame], sx(p.px), sy(p.py - 1), ts, ts * 2);
  }
};
