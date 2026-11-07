// Burrow sim · spider.js — Cave spiders: they roam the floors, walls and roofs of the caves, drop from the ceiling when they see the miner, and climb after it.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

const SPIDER_SHARE = 3 / 4, SPIDER_MOST = 5, SPIDER_SEE = 11, SPIDER_FORGET = 18, SPIDER_DROP = 5, SPIDER_ROOM = 2, SPIDER_SEARCH = 500, SPIDER_REST = 0.03;
const SPIDER_WAYS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const spiderOpen = t => monPass(t) && t !== T.WATER;
// open, with something to hold on to. Corners count, or it could never get round the edge of a block
function spiderGrip(g, x, y) {
  if (!spiderOpen(get(g, x, y))) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && solidAt(g, x + dx, y + dy)) return true;
  return false;
}
// which way its feet point: 0 floor, 1 right wall, 2 ceiling, 3 left wall. On a corner it keeps the last
function spiderSide(g, x, y, was) {
  if (solidAt(g, x, y + 1)) return 0;
  if (solidAt(g, x, y - 1)) return 2;
  if (solidAt(g, x + 1, y)) return 1;
  if (solidAt(g, x - 1, y)) return 3;
  return was || 0;
}
// the roof over this spot, if there's room below it to fall through
function spiderPerch(g, x, y) {
  if (g.monsters.filter(e => e.type === 'spider').length >= SPIDER_MOST || g.rng() >= SPIDER_SHARE) return null;
  for (let up = 0; up <= 10; up++) {
    const yy = y - up;
    if (!spiderOpen(get(g, x, yy))) return null;
    if (solidAt(g, x, yy - 1)) return up >= SPIDER_ROOM ? yy : null;
  }
  return null;
}
// first step of the shortest crawl to the miner, over any surface
function spiderRoute(g, e) {
  const m = g.m, seen = new Map([[e.y * W + e.x, -1]]), line = [[e.x, e.y]];
  for (let i = 0; i < line.length && i < SPIDER_SEARCH; i++) {
    const [x, y] = line[i];
    if (Math.abs(x - m.x) <= 1 && y >= m.y - 1 && y <= m.y + 1) {
      let k = y * W + x, back = seen.get(k);
      if (back === -1) return null;
      while (seen.get(back) !== -1) { k = back; back = seen.get(k); }
      return {x: k % W, y: (k / W) | 0};
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (!seen.has(k) && spiderGrip(g, nx, ny)) { seen.set(k, y * W + x); line.push([nx, ny]); }
    }
  }
  return null;
}
function spiderStep(g, e, to) {
  const dx = to.x - e.x, dy = to.y - e.y;
  e.x = to.x; e.y = to.y; e.side = spiderSide(g, e.x, e.y, e.side);
  const ahead = [dx, -dy, -dx, dy][e.side || 0]; // the art is turned to suit the surface, so "forward" depends on which side it's on
  if (ahead) e.facing = Math.sign(ahead);
  e.walk = (e.walk || 0) + 1;
}
// no way over the surfaces: as near as it can get. Off the end of a ledge, if that's what it takes
function spiderToward(g, e, dx, dy) {
  const sx = Math.sign(dx), sy = Math.sign(dy);
  if (sx && spiderGrip(g, e.x + sx, e.y)) return {x: e.x + sx, y: e.y};
  if (sy && spiderGrip(g, e.x, e.y + sy)) return {x: e.x, y: e.y + sy};
  if (sx && spiderOpen(get(g, e.x + sx, e.y))) { e.falling = true; return {x: e.x + sx, y: e.y}; }
  return null;
}
// nothing leads to it: along the ledge one way till there's a way down, round the edge or off the end
function spiderRoam(g, e, dx) {
  const d = e.roam || (e.roam = Math.sign(dx) || e.facing);
  if (!solidAt(g, e.x, e.y + 1) && spiderGrip(g, e.x, e.y + 1)) return {x: e.x, y: e.y + 1};
  if (spiderGrip(g, e.x + d, e.y)) return {x: e.x + d, y: e.y};
  if (spiderOpen(get(g, e.x + d, e.y))) { e.falling = true; return {x: e.x + d, y: e.y}; }
  e.roam = -d;
  return null;
}
// somewhere it will walk of its own accord: on a surface, not into lava, and not out of the cave into daylight
function spiderHaunt(g, x, y) {
  return spiderGrip(g, x, y) && get(g, x, y) !== T.LAVA && (inUnder(g) || y > g.w.surf[x]);
}
// nobody about: it keeps walking along whatever it's on, round the corners from floor to wall to roof, stopping now and then
function spiderWander(g, e) {
  const spec = MON.spider, way = e.way || (e.way = SPIDER_WAYS[Math.floor(g.rng() * 4)]);
  if (g.rng() < SPIDER_REST) {
    e.moveT = 20 + Math.floor(g.rng() * 60);
    if (g.rng() < 0.25) e.way = [-way[0], -way[1]];
    return;
  }
  const open = SPIDER_WAYS.filter(d => spiderHaunt(g, e.x + d[0], e.y + d[1]));
  const onward = open.filter(d => d[0] !== -way[0] || d[1] !== -way[1]), keep = onward.find(d => d === way || (d[0] === way[0] && d[1] === way[1]));
  const next = keep && g.rng() < 0.9 ? keep : onward.length ? onward[Math.floor(g.rng() * onward.length)] : open[0]; // back the way it came only at a dead end
  e.moveT = spec.speed * 2;
  if (next) { e.way = next; spiderStep(g, e, {x: e.x + next[0], y: e.y + next[1]}); }
}
// its whole turn: it doesn't take gravity like the others, it holds on
function spiderMove(g, e) {
  const m = g.m, spec = MON.spider;
  if (get(g, e.x, e.y) === T.LAVA) { e.hp = 0; return; }
  if (e.falling) {
    if (solidAt(g, e.x, e.y + 1) || !monPass(get(g, e.x, e.y + 1))) { e.falling = false; e.side = 0; e.moveT = 6; sfx(g, 'step', e.x, e.y, T.STONE); }
    else { e.y++; e.moveT = 1; }
    return;
  }
  if (!spiderGrip(g, e.x, e.y)) { e.falling = true; return; } // whatever it held on to has been dug away
  e.side = spiderSide(g, e.x, e.y, e.side);
  const dx = m.x - e.x, dy = m.y - e.y, dist = Math.hypot(dx, dy), sees = !m.dead && dist <= SPIDER_SEE && clearLine(g, e.x, e.y, m.x, m.y - 1, stopsShot);
  if (e.awake && (m.dead || dist > SPIDER_FORGET)) e.awake = false;
  if (!e.awake) {
    if (sees) { e.awake = true; sfx(g, 'hiss', e.x, e.y); e.moveT = 8; return; }
    spiderWander(g, e);
    return;
  }
  e.facing = dx >= 0 ? 1 : -1;
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    if (e.cd <= 0) { hurtMiner(g, monBite(e, spec), spec.name, e.power); e.cd = 26; e.attack = 8; }
    e.moveT = 4;
    return;
  }
  if (!solidAt(g, e.x, e.y + 1) && sees && Math.abs(dx) <= SPIDER_DROP && m.y > e.y + 1) { e.falling = true; e.moveT = 2; sfx(g, 'hiss', e.x, e.y); return; }
  const to = (sees && !solidAt(g, e.x, e.y + 1) && spiderToward(g, e, dx, 0)) || spiderRoute(g, e) || spiderRoam(g, e, dx); // in sight from the roof: straight over to it, not the long way round by the walls
  if (to) { spiderStep(g, e, to); if (e.walk % 3 === 0) sfx(g, 'skitter', e.x, e.y); }
  e.moveT = spec.speed;
}
