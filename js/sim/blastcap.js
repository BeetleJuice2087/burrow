// Burrow sim · blastcap.js — The blastcap: a cave mushroom that sleeps like scenery, wakes, swells and bursts. And how the miner deals with one.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

const BLAST_DEEP = 70, BLAST_SHARE = 1 / 6, BLAST_MOST = 2, BLAST_WAKE = 7, BLAST_FORGET = 12, BLAST_FUSE = 40, BLAST_REACH = 3.5, BLAST_DMG = 10, BLAST_FLEES = 3;
const BLAST_ROCK = new Set([T.STONE, T.DEEP, T.DIRT]); // plain ground only: never ore, or anything the miner built or laid
const capAsleep = e => e.type === 'blastcap' && !e.awake;
// one in a few of the monsters that turn up deep down, once it has armor to take a burst in
function blastcapRoll(g, y) {
  return y >= BLAST_DEEP && armor(g.m) > 0 && g.rng() < BLAST_SHARE && g.monsters.filter(e => e.type === 'blastcap').length < BLAST_MOST;
}
// runs every tick: once it's swelling nothing stops it
function capFuse(g, e) {
  if (!(e.fuse > 0)) return false;
  if (--e.fuse <= 0) blastcapBurst(g, e);
  return true;
}
// true when that's its move for now
function capThink(g, e, dx, dy, dist) {
  const m = g.m, sees = !m.dead && dist <= BLAST_WAKE && clearLine(g, e.x, e.y, m.x, m.y - 1, stopsShot);
  if (!e.awake) {
    e.moveT = 15;
    if (sees) { e.awake = true; sfx(g, 'fizz', e.x, e.y); }
    return true;
  }
  if (m.dead || dist > BLAST_FORGET) { e.awake = false; e.moveT = 15; return true; }
  if ((Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && sees) || (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)) { e.fuse = BLAST_FUSE; e.facing = dx >= 0 ? 1 : -1; sfx(g, 'fizz', e.x, e.y); return true; }
  return false;
}
function blastcapBurst(g, e) {
  if (e.burst) return;
  e.burst = true; e.hp = 0;
  const m = g.m, ax = e.x + 0.5, ay = e.y + 0.5;
  sfx(g, 'blast', e.x, e.y);
  g.fx.push({type: 'blast', x: e.x, y: e.y, life: 18});
  for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = e.x + dx, y = e.y + dy, k = y * W + x;
    if (dx * dx + dy * dy > 2.5 || !BLAST_ROCK.has(get(g, x, y)) || y <= g.w.surf[x] + 2) continue;
    if ((g.protect && g.protect.has(k)) || inGateFrame(g, x, y) || inHouse(g, x, y) || (Math.abs(x - m.home.x) <= 14 && Math.abs(y - m.home.y) <= 10)) continue;
    g.fx.push({type: 'crumble', x, y, t: get(g, x, y), life: 12});
    setTile(g, x, y, T.AIR);
  }
  for (const o of g.monsters) {
    if (o === e || o.hp <= 0 || Math.hypot(o.x - e.x, o.y - e.y) > BLAST_REACH) continue;
    if (o.type === 'blastcap') { o.awake = true; if (!(o.fuse > 0)) o.fuse = 6; continue; } // they set each other off
    if (o.type !== 'warden') { o.hp -= BLAST_DMG; o.hurt = 8; }
  }
  const d = Math.hypot(m.x + 0.5 - ax, m.y - ay);
  if (d <= BLAST_REACH && clearLine(g, e.x, e.y, m.x, m.y - 1, stopsShot)) hurtMiner(g, Math.ceil(BLAST_DMG * (1 - d / 4.5)), 'blastcap');
}
// the nearest one worth getting away from. With a bow it only has to keep shooting range; without one it wants no part of it
function capToFlee(g) {
  const m = g.m, r = cnt(m, 'bow') && arrowCount(m) ? BOW_NEAR - 1 : 5;
  let best = null, bd = INF;
  for (const e of g.monsters) {
    if (e.type !== 'blastcap' || !e.awake || e.hp <= 0 || (e.flees || 0) >= BLAST_FLEES || e.ignore > g.tick) continue;
    const d = Math.max(Math.abs(e.x - m.x), Math.abs(e.y - m.y));
    if ((d <= r || (e.fuse > 0 && d <= 5)) && d < bd) { bd = d; best = e; }
  }
  return best;
}
// nowhere to go, or it has run from this one long enough: chooseJob falls through to the sword
function backAwayJob(g, e) {
  const m = g.m, away = (x, y) => Math.max(Math.abs(x - e.x), Math.abs(y - e.y));
  const path = findPath(g, {goal: (x, y) => away(x, y) >= 8 && solidAt(g, x, y + 1), h: (x, y) => Math.max(0, 8 - away(x, y)) * 5, maxNodes: 1500, range: 16, noDig: true, noPillar: true});
  e.flees = (e.flees || 0) + 1;
  if (!path || !path.length) return null;
  let set = false;
  return {
    name: 'flee', label: 'Backing away from a blastcap',
    run(g) {
      if (set) return 'done';
      set = true; m.path = path; return 'run';
    }
  };
}
