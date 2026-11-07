// Burrow sim · trail.js — The way the miner has walked, for the replay (stats.trail): flat [time, at, y, realm] per point, where at is x counted from the start of the journey and realm is 0, or the Underworld's era + 1.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// A point goes down only when the miner has moved, so a long stay costs nothing. Past the limit the older half loses every other point: recent days stay sharp and the whole life still fits in a save.
'use strict';

const TRAIL_EVERY = 60, TRAIL_MOVED = 3, TRAIL_MOST = 8000, TRAIL_KOS = 300;
const trailTime = g => Math.floor(g.time / 20);
function trailStep(g) {
  if (g.tick % TRAIL_EVERY || g.m.dead) return;
  const m = g.m, s = g.stats, j = m.journey, deep = inUnder(g), t = s.trail = s.trail || [];
  const realm = deep ? (g.w.era || 0) + 1 : 0, at = m.x + (!deep && j ? j.off : 0), n = t.length;
  if (n && t[n - 1] === realm && Math.abs(t[n - 3] - at) + Math.abs(t[n - 2] - m.y) < TRAIL_MOVED) return;
  t.push(trailTime(g), at, m.y, realm);
  if (t.length >= TRAIL_MOST * 4) thinTrail(s);
}
function thinTrail(s) {
  const t = s.trail, half = (t.length >> 3) * 4, kept = [];
  for (let i = 0; i < half; i += 8) kept.push(t[i], t[i + 1], t[i + 2], t[i + 3]);
  s.trail = kept.concat(t.slice(half));
}
function trailKO(g) {
  const s = g.stats;
  (s.koAt = s.koAt || []).push(trailTime(g));
  if (s.koAt.length > TRAIL_KOS) s.koAt.shift();
}
