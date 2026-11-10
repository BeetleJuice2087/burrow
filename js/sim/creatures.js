// Burrow sim · creatures.js — Monsters, pudgeons, arrows, day/night helpers and damage to the miner.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// ---------- monsters & critters ----------
function spawnCritter(g, x) {
  const y = g.w.top[x] - 1;
  if (y < 2 || !passable(get(g, x, y)) || get(g, x, y + 1) === T.WATER) return;
  g.critters.push({x, y, px: x, py: y, hp: 4, moveT: 0, from: null, cd: Math.floor(g.rng() * 60), facing: 1});
}
const MON = {
  shambler: {hp: 18, dmg: 3, speed: 9, name: 'shambler'},
  crawler: {hp: 10, dmg: 2, speed: 5, name: 'cave crawler'},
  archer: {hp: 14, dmg: 3, speed: 10, name: 'hollow archer'},
  cinderling: {hp: 30, dmg: 5, speed: 6, name: 'cinderling'},
  ashcaster: {hp: 24, dmg: 5, speed: 10, name: 'ashcaster'},
  ashhound: {hp: 22, dmg: 5, speed: 4, name: 'ashhound'},
  shardling: {hp: 48, dmg: 7, speed: 9, name: 'shardling'},
  blastcap: {hp: 12, dmg: 4, speed: 12, name: 'blastcap'},
  spider: {hp: 12, dmg: 3, speed: 4, name: 'cave spider'},
  warden: {hp: 260, dmg: 8, speed: 8, name: 'Ember Warden'}
};
const SHOOTERS = {archer: 1, ashcaster: 1, warden: 1};
const LOW_MON = {crawler: 1, ashhound: 1, blastcap: 1, spider: 1}; // one tile tall
// who roams each part of the Underworld (by UNDER_BIOMES index)
const UNDER_MON = [['cinderling', 'ashcaster'], ['cinderling', 'cinderling', 'ashcaster'], ['shardling', 'shardling', 'ashcaster'], ['cinderling', 'ashcaster', 'ashcaster'], ['ashhound', 'ashhound', 'cinderling'], ['ashhound', 'ashcaster', 'cinderling']];
const underMonster = g => { const list = UNDER_MON[g.w.biome[g.m.x]] || UNDER_MON[0]; return list[Math.floor(g.rng() * list.length)]; };
function isLitByTorch(g, x, y, r) {
  for (const p of g.torches) if (Math.abs(p.x - x) <= r && Math.abs(p.y - y) <= r) return true;
  return false;
}
function skyAt(g, x, y) { return y < g.w.top[x]; }
function isNight(g) { const f = (g.time % DAY) / DAY; return f > 0.64 && f < 0.97; }
function dayFrac(g) { return (g.time % DAY) / DAY; }

const CAVE_SPAWN = 0.12, CAVE_PACK = 0.2;
function trySpawnMonster(g) {
  const m = g.m;
  if (g.monsters.length >= 6 || m.dead) return;
  const night = isNight(g);
  const dx = (g.rng() < 0.5 ? -1 : 1) * (14 + Math.floor(g.rng() * 18));
  const x = m.x + dx;
  if (x < 2 || x >= W - 2 || villageNear(g, x, VILLAGE_SAFE, true)) return;
  let y, type;
  const underground = !skyAt(g, m.x, m.y - 1);
  if (inUnder(g)) {
    if (g.rng() > 0.5) return;
    y = m.y + Math.floor((g.rng() - 0.5) * 16);
    type = underMonster(g);
  } else if (!underground && night) {
    y = g.w.top[x] - 1;
    if (get(g, x, y + 1) === T.WATER) return;
    type = g.rng() < 0.6 ? 'shambler' : 'archer';
  } else if (underground && g.rng() < (armor(m) > 0 ? CAVE_SPAWN : CAVE_SPAWN / 2)) { // gentler on a miner with no armor yet
    y = caveFloor(g, x, m.y + Math.floor((g.rng() - 0.5) * 16));
    if (y === null || skyAt(g, x, y)) return;
    type = blastcapRoll(g, y) ? 'blastcap' : g.rng() < 0.45 ? 'crawler' : g.rng() < 0.65 ? 'shambler' : 'archer';
    const perch = type === 'blastcap' ? null : spiderPerch(g, x, y);
    if (perch !== null) { type = 'spider'; y = perch; }
  } else return;
  if (y < 3 || y > H - 3) return;
  if (!monPass(get(g, x, y)) || (type !== 'spider' && !solidAt(g, x, y + 1))) return;
  if (!LOW_MON[type] && !monPass(get(g, x, y - 1))) return;
  if (isLitByTorch(g, x, y, 6)) return;
  if (!inUnder(g) && m.bed && Math.abs(x - m.home.x) <= 5 && Math.abs(y - m.home.y) <= 4) return;
  g.monsters.push({type, x, y, px: x, py: y, hp: MON[type].hp, moveT: 0, from: null, cd: 20, facing: 1, hurt: 0});
  if (type === 'blastcap' || type === 'spider') return; // it just sits there, looking like a mushroom. Or hangs up there, saying nothing
  sfx(g, 'growl', x, y, type);
  if (underground && !inUnder(g) && g.rng() < CAVE_PACK) { // they come in twos down here, now and then
    const nx = x + (g.rng() < 0.5 ? -1 : 1);
    if (monPass(get(g, nx, y)) && monPass(get(g, nx, y - 1)) && solidAt(g, nx, y + 1)) g.monsters.push({type, x: nx, y, px: nx, py: y, hp: MON[type].hp, moveT: 0, from: null, cd: 30, facing: 1, hurt: 0});
  }
}
// the nearest place to stand in this column: most of a cave wall is rock, and a monster dropped into rock is no monster at all
function caveFloor(g, x, y0) {
  for (let d = 0; d <= 10; d++) for (const y of d ? [y0 + d, y0 - d] : [y0]) {
    if (y > 3 && y < H - 3 && monPass(get(g, x, y)) && solidAt(g, x, y + 1)) return y;
  }
  return null;
}

// nothing but a drop into lava under this spot: creatures won't walk out over it
function lavaBelow(g, x, y) {
  for (let yy = y + 1; yy < H && yy <= y + 12; yy++) {
    const t = get(g, x, yy);
    if (t === T.LAVA) return true;
    if (isSolid(t)) return false;
  }
  return false;
}
function entityMove(g, e, dir, pass, tall) {
  // grid step for monsters/critters: walk, step up, or fall
  const nx = e.x + dir;
  const free = (x, y) => pass(get(g, x, y)) && (!tall || pass(get(g, x, y - 1)));
  if (free(nx, e.y)) { if (lavaBelow(g, nx, e.y)) return false; e.from = {x: e.x, y: e.y}; e.x = nx; return true; }
  if (free(nx, e.y - 1) && pass(get(g, e.x, e.y - (tall ? 2 : 1))) && solidAt(g, nx, e.y)) { e.from = {x: e.x, y: e.y}; e.x = nx; e.y -= 1; return true; }
  return false;
}
function burnUp(g, e) {
  e.hp = 0; g.fx.push({type: 'poof', x: e.x, y: e.y, life: 20}); sfx(g, 'sizzle', e.x, e.y);
}
// in lava: it sinks slowly, the way things sink in water, and burns a fifth of its health away each turn till it's gone
const LAVA_SINK = 6;
function lavaTurn(g, e) {
  if (get(g, e.x, e.y) !== T.LAVA) return false;
  const full = e.full || (e.full = Math.max(e.hp, 1));
  e.hp -= Math.max(2, Math.ceil(full * 0.2)); e.hurt = 8;
  if (e.hp <= 0) { burnUp(g, e); return true; }
  sfx(g, 'sizzle', e.x, e.y);
  if (!solidAt(g, e.x, e.y + 1) && e.y < H - 2) { e.from = {x: e.x, y: e.y}; e.y += 1; }
  e.falling = false; e.moveT = LAVA_SINK;
  return true;
}
function gravity(g, e, tall) {
  if (!solidAt(g, e.x, e.y + 1) && e.y < H - 2) {
    e.from = {x: e.x, y: e.y}; e.y += 1; return true;
  }
  return false;
}
function hurtMiner(g, dmg, src, power) {
  const m = g.m; if (m.dead || m.safe > 0) return;
  const attack = src !== 'hunger' && src !== 'long fall' && src !== 'lava';
  let f = 1 - armor(m);
  if (attack && m.inv.shield) { f *= 0.67; wear(g, 'shield'); } // the shield takes a third of the blow
  if (attack) for (const s of ARMOR_SLOTS) wear(g, armorPiece(m, s));
  const d = Math.max(1, Math.round(dmg * Math.max(f, biteThrough(power))));
  m.hp -= d; m.hurt = 8; sfx(g, 'hurt', m.x, m.y);
  g.fx.push({type: 'num', x: m.x, y: m.y - 2, text: '-' + d, life: 30, color: '#ff5a5a'});
  if (m.sleeping || m.hiding) { m.sleeping = false; m.hiding = false; m.act = null; }
  bookClose(g, src);
  if (m.hp <= 0) die(g, src);
}
// a spawner the miner has found keeps sending out monsters while it's close, whatever the light
function updateSpawners(g) {
  const m = g.m;
  if (m.dead || g.monsters.length >= 10) return;
  for (const s of g.w.spawners || []) {
    if (get(g, s.x, s.y) !== T.SPAWNER || !g.seen[s.y * W + s.x] || Math.abs(s.x - m.x) > 12 || Math.abs(s.y - m.y) > 6 || g.tick < (s.next || 0)) continue;
    s.next = g.tick + 160 + Math.floor(g.rng() * 200);
    if (g.monsters.filter(e => Math.abs(e.x - s.x) <= 8 && Math.abs(e.y - s.y) <= 5).length >= 3) continue;
    for (let i = 0; i < 8; i++) {
      const x = s.x + Math.floor(g.rng() * 7) - 3, y = s.y;
      if (Math.abs(x - m.x) < 2 || !monPass(get(g, x, y)) || !monPass(get(g, x, y - 1)) || !solidAt(g, x, y + 1)) continue;
      const type = inUnder(g) ? underMonster(g) : ['shambler', 'crawler', 'archer'][Math.floor(g.rng() * 3)];
      g.monsters.push({type, x, y, px: x, py: y, hp: MON[type].hp, moveT: 0, from: null, cd: 30, facing: 1, hurt: 0});
      g.fx.push({type: 'poof', x, y, life: 20}); sfx(g, 'growl', x, y, type);
      break;
    }
  }
}
function updateMonsters(g) {
  const m = g.m;
  for (const e of g.monsters) {
    if (e.power === undefined) toughen(g, e);
    if (e.hurt > 0) e.hurt--;
    if (e.cd > 0) e.cd--;
    if (e.type === 'blastcap' && capFuse(g, e)) continue;
    if (e.netted > g.tick) { e.from = null; continue; } // held in a silk net: it can only struggle
    e.moveT--;
    if (e.moveT > 0) continue;
    const spec = MON[e.type], tall = !LOW_MON[e.type];
    e.from = null;
    if (lavaTurn(g, e)) continue;
    if (e.type === 'spider') { spiderMove(g, e); continue; }
    if (gravity(g, e, tall)) { e.moveT = 2; continue; }
    const dx = m.x - e.x, dy = m.y - e.y, dist = Math.hypot(dx, dy);
    if (e.type === 'blastcap' && capThink(g, e, dx, dy, dist)) continue;
    if (m.dead || dist > (m.inv.leaf_cloak ? 14 : 26)) { // idle wander (a leaf cloak keeps it from being noticed so far off)
      if (g.rng() < 0.3) entityMove(g, e, g.rng() < 0.5 ? -1 : 1, monPass, tall);
      e.moveT = spec.speed * 2; continue;
    }
    e.facing = dx >= 0 ? 1 : -1;
    if (e.type === 'warden' && e.hp < spec.hp / 2 && g.tick >= (e.next || 0) && g.monsters.length < 7) { // wounded, it calls for help
      e.next = g.tick + 420;
      for (const s of [e.facing * 2]) if (monPass(get(g, e.x + s, e.y)) && monPass(get(g, e.x + s, e.y - 1))) { g.monsters.push({type: 'cinderling', x: e.x + s, y: e.y, px: e.x + s, py: e.y, hp: MON.cinderling.hp, moveT: 0, from: null, cd: 30, facing: 1, hurt: 0}); g.fx.push({type: 'poof', x: e.x + s, y: e.y, life: 20}); }
      sfx(g, 'growl', e.x, e.y, 'warden');
    }
    if (SHOOTERS[e.type] && Math.abs(dx) <= 9 && Math.abs(dy) <= 2 && e.cd <= 0 && clearLine(g, e.x, e.y - 1, m.x, m.y - 1, stopsShot)) {
      sfx(g, 'bow', e.x, e.y);
      g.arrows.push({x: e.x + 0.5, y: e.y - 0.5, vx: Math.sign(dx) * 0.35, vy: dy * 0.02, life: 40, dmg: monBite(e, spec), power: e.power, from: spec.name, fire: e.type === 'ashcaster' || e.type === 'warden'});
      e.cd = e.type === 'warden' ? 34 : 55; e.moveT = 10; continue;
    }
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      if (e.cd <= 0) { hurtMiner(g, monBite(e, spec), spec.name, e.power); e.cd = 26; e.attack = 8; }
      e.moveT = 4; continue;
    }
    if (SHOOTERS[e.type] && Math.abs(dx) <= 5 && Math.abs(dy) <= 1) { e.moveT = 8; continue; }
    if (dx !== 0 && !(e.type === 'warden' && dx > 0 && e.x >= 58)) entityMove(g, e, Math.sign(dx), monPass, tall); // it never leaves its hall
    e.moveT = spec.speed;
  }
  for (const a of g.arrows) {
    a.x += a.vx; a.y += a.vy; a.life--;
    if (stopsShot(get(g, Math.floor(a.x), Math.floor(a.y)))) { a.life = 0; continue; }
    if (a.mine) { arrowHits(g, a); continue; }
    if (!m.dead && Math.abs(a.x - (m.x + 0.5)) < 0.6 && a.y > m.y - 1.6 && a.y < m.y + 1) { hurtMiner(g, a.dmg || 3, a.from || 'hollow archer', a.power); a.life = 0; }
  }
  g.arrows = g.arrows.filter(a => a.life > 0);
  const day = !isNight(g);
  g.monsters = g.monsters.filter(e => {
    if (e.hp <= 0) return false;
    if (Math.abs(e.x - m.x) > 50 && e.type !== 'warden') return false;
    if (day && skyAt(g, e.x, e.y - 1) && g.rng() < 0.01) { g.fx.push({type: 'poof', x: e.x, y: e.y, life: 20}); return false; }
    return true;
  });
}
function clearLine(g, x0, y0, x1, y1, stops = isSolid) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 1; i < n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); if (stops(get(g, x, y))) return false; }
  return true;
}
function updateCritters(g) {
  const m = g.m;
  for (const c of g.critters) {
    if (c.expire === undefined) c.expire = g.tick + Math.floor(DAY * (1 + g.rng())); // lives one to two days
    // wander off for good once its time is up, but never in front of the miner
    if (g.tick >= c.expire && Math.abs(c.x - m.x) + Math.abs(c.y - m.y) > 24) { c.hp = 0; continue; }
    c.moveT--; if (c.moveT > 0) continue;
    c.from = null;
    if (lavaTurn(g, c)) continue;
    if (gravity(g, c, false)) { c.moveT = 2; continue; }
    const dx = c.x - m.x;
    if (Math.abs(dx) < 5 && Math.abs(c.y - m.y) < 4 && !m.dead) { // flee
      const dir = dx >= 0 ? 1 : -1; c.facing = dir;
      c.tired = (c.tired || 0) + 1;
      if (c.tired > 6 && g.rng() < 0.6) { c.moveT = 16; continue; } // out of breath: pauses
      if (!entityMove(g, c, dir, monPass, false)) { c.facing = -dir; entityMove(g, c, -dir, monPass, false); }
      c.moveT = 13; continue;
    }
    if (c.tired > 0) c.tired--;
    if (g.rng() < 0.25) { const dir = g.rng() < 0.5 ? -1 : 1; c.facing = dir; entityMove(g, c, dir, monPass, false); }
    c.moveT = 12 + Math.floor(g.rng() * 30);
  }
  g.critters = g.critters.filter(c => c.hp > 0 && c.x > 1 && c.x < W - 2);
  if (g.tick % 300 === 0 && g.critters.length < 16 && !isNight(g)) {
    for (let tries = 0, n = g.critters.length; tries < 12 && g.critters.length === n; tries++) { // grassland can be scarce
      const x = Math.floor(10 + g.rng() * (W - 20));
      if (lushBiome(g.w.biome[x]) && Math.abs(x - m.x) > 20) spawnCritter(g, x);
    }
  }
}
