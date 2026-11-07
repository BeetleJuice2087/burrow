// Burrow sim · bow.js — The bow: choosing what to shoot, the shots themselves, and keeping the quiver filled.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

const QUIVER_MAX = 30, ARROW_BATCH = 4, QUIVER_LOW = 10, QUIVER_LOW_EARLY = 3, BOW_NEAR = 4, BOW_FAR = 13, BOW_RISE = 6, BOW_DRAW = 14, ARROW_SPEED = 0.7;
const arrowCount = m => ARROWS.reduce((n, a) => n + cnt(m, a.id), 0);
// enough for this monster and no better, or the best in the quiver if nothing is
function arrowFor(m, e) {
  const held = ARROWS.filter(a => cnt(m, a.id) > 0);
  return held.find(a => a.dmg >= e.hp) || held[held.length - 1] || null;
}
const aimY = e => e.y - (LOW_MON[e.type] ? 0 : 1);
// the nearest monster it could put an arrow into from here. Up close the sword is better
function bowTarget(g) {
  const m = g.m;
  if (!cnt(m, 'bow') || !arrowCount(m)) return null;
  let best = null, bd = INF;
  for (const e of g.monsters) {
    const dx = Math.abs(e.x - m.x), dy = Math.abs(e.y - m.y), d = Math.max(dx, dy);
    if (e.hp <= 0 || capAsleep(e) || d < BOW_NEAR || dx > BOW_FAR || dy > BOW_RISE || d >= bd || e.noShot > g.tick) continue;
    if (clearLine(g, m.x, m.y - 1, e.x, aimY(e), stopsShot)) { best = e; bd = d; }
  }
  return best;
}
function shootJob(g, e) {
  const m = g.m, name = MON[e.type].name;
  return {
    name: 'shoot', label: 'Shooting at ' + (e.type === 'warden' ? 'the ' : /^[aeiou]/.test(name) ? 'an ' : 'a ') + name,
    run(g) {
      if (e.hp <= 0 || !g.monsters.includes(e) || !arrowCount(m) || e.noShot > g.tick) return 'done';
      const d = Math.max(Math.abs(e.x - m.x), Math.abs(e.y - m.y));
      if (d < BOW_NEAR - 1 || d > BOW_FAR + 2 || !clearLine(g, m.x, m.y - 1, e.x, aimY(e), stopsShot)) return 'done';
      m.facing = Math.sign(e.x - m.x) || m.facing;
      m.act = {type: 'shoot', t: 0, target: e};
      return 'run';
    }
  };
}
function fireArrow(g, e) {
  const m = g.m, kind = arrowFor(m, e);
  if (!kind) return;
  take(m, kind.id, 1);
  g.stats.shots = (g.stats.shots || 0) + 1;
  const sx = m.x + 0.5 + m.facing * 0.5, sy = m.y - 0.9, dx = e.x + 0.5 - sx, dy = aimY(e) + 0.5 - sy, d = Math.hypot(dx, dy) || 1;
  g.arrows.push({x: sx, y: sy, vx: dx / d * ARROW_SPEED, vy: dy / d * ARROW_SPEED, life: 36, dmg: kind.dmg, mine: kind.id});
  sfx(g, 'bow', m.x, m.y);
  e.shots = (e.shots || 0) + 1;
  if (e.shots >= 4) { e.shots = 0; e.noShot = g.tick + 600; } // four misses: something keeps getting in the way, so leave it be for a while
}
// the miner's own arrows fly past it and stick in the first monster they meet
function arrowHits(g, a) {
  for (const e of g.monsters) {
    if (e.hp <= 0 || Math.abs(a.x - (e.x + 0.5)) > 0.7 || a.y < e.y - (LOW_MON[e.type] ? 0.3 : 1.3) || a.y > e.y + 1.1) continue;
    e.hp -= a.dmg; e.hurt = 8; e.shots = 0; a.life = 0;
    sfx(g, 'mhit', e.x, e.y, e.type);
    g.fx.push({type: 'num', x: e.x, y: e.y - 2, text: '-' + a.dmg, life: 25, color: '#ffe08a'});
    if (e.hp <= 0) { monsterFell(g, e); milestone(g, 'first_shot', 'Beat a monster with the bow'); }
    return;
  }
}
// tops up with the best arrows it has spare metal for. It never goes mining for this: arrows come out of what's in the pack
function quiverJob(g) {
  const m = g.m;
  if (!cnt(m, 'bow')) {
    if (!m.journey && !(g.stats.underTrips > 0)) return null; // the checklist sees to it until then
    m.chain = ['Make a bow'];
    return need(g, 'bow', 1, m.chain);
  }
  const room = QUIVER_MAX - arrowCount(m), early = tier(m) < 4; // the gem pickaxe comes first: until then a few copper arrows will do
  if (arrowCount(m) > (early ? QUIVER_LOW_EARLY : QUIVER_LOW)) return null;
  for (let i = ARROWS.length - 1; i >= 0; i--) {
    const a = ARROWS[i], spare = cnt(m, a.mat) + (a.raw ? cnt(m, a.raw) : 0) - a.spare;
    if (spare <= 0 || (early && i > 0)) continue;
    const batches = Math.min(spare, Math.floor(room / ARROW_BATCH), early ? 3 : INF);
    if (batches <= 0) continue;
    m.chain = ['Fill the quiver'];
    const j = need(g, a.id, cnt(m, a.id) + batches * ARROW_BATCH, m.chain);
    if (j) return j;
  }
  return null;
}
