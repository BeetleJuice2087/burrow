// Burrow sim · companion.js — A companion met in a village (m.pal): walks with the miner, helps in fights, digs ore it comes across, hands it over, and points out veins. The miner still does all the building, and the replay only follows the miner.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// When the miner moves on, the companion decides whether to stay. Land left behind is gone for good, so staying is goodbye: a letter may come, and sometimes they catch up.
'use strict';

const PAL_NAMES = ['Bryn', 'Tamsin', 'Oren', 'Wick', 'Maren', 'Juniper', 'Corwin', 'Sable', 'Hollis', 'Fenna', 'Rook', 'Ansel'];
const PAL_TRAITS = {homebody: {stay: 0.3, word: 'likes a place to settle'}, steady: {stay: 0.12, word: 'steady and quiet'}, wanderer: {stay: 0.03, word: 'always looking east'}};
const PAL_LINES = {homebody: 'I think this is my stop. It feels like home.', steady: 'I’ve walked far enough. Look after yourself.', wanderer: 'Even I want to see how this place turns out.'};
const PAL_FIRST = 60, PAL_LATER = 35, PAL_SET_OFF = 5, PAL_CLOSE = 2, PAL_HIT = 10, PAL_FAR = 24, PAL_SEE = 6, PAL_REACH = 2, PAL_REST = 500, PAL_LOOK = 160, PAL_SCOUT = 4800, PAL_SHARE = 4800, PAL_DUG_FROM = 7, PAL_SCOUT_FROM = 14;
const PAL_ORES = new Set([T.COAL, T.COPPER, T.IRON, T.GOLD, T.GEM]);
const palItem = t => Object.keys(RAW_SOURCE).find(k => RAW_SOURCE[k] === t);
const palRealm = g => g.realm || 'over';
const palHash = (g, n) => skyHash(g.seed + (g.m.journey ? g.m.journey.camps : 0) * 31, n) % 100;

function palNew(g, away) {
  const s = g.stats, used = s.palNames = s.palNames || [], left = PAL_NAMES.filter(n => !used.includes(n)), pool = left.length ? left : PAL_NAMES;
  const kinds = Object.keys(PAL_TRAITS), h = skyHash(g.seed, used.length + 7);
  const name = away ? away.name : pool[h % pool.length];
  if (!away) used.push(name);
  return {name, trait: away ? away.trait : kinds[h % kinds.length], look: away ? away.look : h % 4, day: g.day, x: g.m.x, y: g.m.y, px: g.m.x, py: g.m.y, facing: 1, pack: {}, stuck: 0, realm: palRealm(g), kills: away ? away.kills : 0, gave: away ? away.gave : 0};
}
function palSay(g, text) {
  const s = g.stats;
  logEvent(g, text);
  (s.dayPal = s.dayPal || []).push(text + '.');
}
function palJoins(g, p, title, text) {
  g.m.pal = p;
  palPlace(g, p);
  bookPage(g, 'pal', title, text, g.m.x, g.m.y - 1);
}
// someone in the village is tired of it, and asks to come along
function palMeet(g, v) {
  const m = g.m, s = g.stats;
  if (m.pal || m.palOff || v.kind === 'ruin' || palHash(g, v.id + 40) >= (s.palNames && s.palNames.length ? PAL_LATER : PAL_FIRST)) return;
  const p = palNew(g);
  palJoins(g, p, p.name + ' came along', 'Met ' + p.name + ' in ' + v.name + '. Says they’re done with staying put.');
  palSay(g, p.name + ' from ' + v.name + ' is coming along with me');
  milestone(g, 'pal', 'Found a companion');
}
function palBye(g, why, text) {
  const m = g.m, s = g.stats, p = m.pal;
  palGive(g, p);
  bookPage(g, 'pal', p.name + ' ' + why, text, p.x, p.y - 1);
  palSay(g, p.name + ' ' + why);
  m.pal = null;
}
// leaving camp: the longer here and the more was built, the harder it is to go
function palDecide(g) {
  const m = g.m, p = m.pal, j = m.journey;
  if (!p) return false;
  const days = Math.max(0, g.day - (j.campDay || g.day)), rooms = j.grown || 0;
  const chance = Math.min(0.6, PAL_TRAITS[p.trait].stay + Math.min(0.2, days * 0.01) + Math.min(0.15, rooms * 0.03));
  if (palHash(g, 80) >= chance * 100) return false;
  g.stats.palAway = {name: p.name, trait: p.trait, look: p.look, kills: p.kills, gave: p.gave, camp: j.camps, day: g.day};
  palBye(g, 'stayed behind', PAL_LINES[p.trait]);
  return true;
}
// a few camps on: a letter, and now and then the writer of it
function palCamp(g) {
  const m = g.m, s = g.stats, a = s.palAway, j = m.journey;
  if (!a || m.palOff) return;
  const gone = j.camps - a.camp;
  if (gone === 2 && !a.wrote) { a.wrote = true; palSay(g, 'A letter from ' + a.name + '. Says they miss the road'); }
  if (gone >= 3 && !m.pal && palHash(g, 90) < 40) {
    s.palAway = null;
    const p = palNew(g, a);
    palJoins(g, p, a.name + ' caught up', 'Saw someone coming up the road. It was ' + a.name + '.');
    palSay(g, a.name + ' caught up with me');
  } else if (gone > 7) s.palAway = null;
}
// the button
function setPal(g, on) {
  const m = g.m;
  m.palOff = !on;
  if (!on && m.pal) palBye(g, 'went their own way', 'Said it was time. We shook hands at the fire.');
}
// a spot near the miner to stand
function palPlace(g, p) {
  const m = g.m, side = m.facing || 1;
  for (let d = 1; d <= 7; d++) for (const s of [-side, side]) for (const dy of [0, -1, 1, -2, 2, -3, 3]) {
    const x = m.x + s * d, y = m.y + dy;
    if (x > 1 && x < W - 2 && palStand(g, x, y)) { palPut(p, x, y, g); return; }
  }
  palPut(p, m.x, m.y, g);
}
function palPut(p, x, y, g) { p.x = p.px = x; p.y = p.py = y; p.stuck = 0; p.dig = null; p.step = null; p.realm = palRealm(g); }
const palBody = (g, x, y) => { const a = get(g, x, y), b = get(g, x, y - 1); return passable(a) && passable(b) && a !== T.LAVA && b !== T.LAVA; };
const palStand = (g, x, y) => palBody(g, x, y) && isSolid(get(g, x, y + 1)) && get(g, x, y) !== T.WATER;
// a step takes as long as the miner's, and rises and drops the same way
function palStepTo(g, p, x, y, mv) {
  const drop = y - p.y;
  p.step = {fx: p.x, fy: p.y, tx: x, ty: y, mv, t: 0, dur: Math.round(PACE_MOVE * {w: 7, u: 10, d: 9, f: 7 + 2 * drop}[mv])};
}
function palWalk(g, p, d) {
  const nx = p.x + d;
  p.facing = d;
  if (nx < 2 || nx > W - 3) return false;
  if (palStand(g, nx, p.y)) { palStepTo(g, p, nx, p.y, 'w'); return true; }
  if (palBody(g, p.x, p.y - 1) && palStand(g, nx, p.y - 1)) { palStepTo(g, p, nx, p.y - 1, 'u'); return true; }
  if (!palBody(g, nx, p.y)) return false;
  for (let dy = 1; dy <= 8; dy++) {
    if (!palBody(g, nx, p.y + dy)) return false;
    if (palStand(g, nx, p.y + dy)) { palStepTo(g, p, nx, p.y + dy, dy === 1 ? 'd' : 'f'); return true; }
  }
  return false; // too far to drop
}
function palMove(g, p) {
  const a = p.step;
  a.t++;
  const f = Math.min(1, a.t / a.dur);
  if (a.mv === 'u') { // climb, then step over
    const k = Math.min(1, f * 1.6), h = Math.max(0, (f - 0.55) / 0.45);
    p.px = a.fx + (a.tx - a.fx) * h; p.py = a.fy + (a.ty - a.fy) * k - Math.sin(Math.min(1, f * 1.2) * Math.PI) * 0.15;
  } else if (a.mv === 'w') { p.px = a.fx + (a.tx - a.fx) * f; p.py = a.fy; }
  else { // step over, then drop
    const h = Math.min(1, f * 2.2), k = Math.max(0, (f - 0.35) / 0.65);
    p.px = a.fx + (a.tx - a.fx) * h; p.py = a.fy + (a.ty - a.fy) * k * k;
  }
  if (a.t >= a.dur) { p.x = p.px = a.tx; p.y = p.py = a.ty; p.step = null; sfx(g, 'step', p.x, p.y, get(g, p.x, p.y + 1)); }
}
function palGive(g, p) {
  const items = Object.keys(p.pack).filter(k => p.pack[k] > 0);
  if (!items.length) return;
  for (const k of items) { add(g, k, p.pack[k]); p.gave += p.pack[k]; g.stats.palGave = (g.stats.palGave || 0) + p.pack[k]; }
  palSay(g, p.name + ' handed over ' + items.map(k => p.pack[k] + ' ' + ITEMS[k].toLowerCase()).join(', '));
  p.pack = {};
}
// what they dig is theirs till they next catch their breath together. And the miner shares its food
function palShare(g, p) {
  const m = g.m;
  palGive(g, p);
  const food = Object.keys(m.inv).find(k => FOOD[k] && m.inv[k] >= 6);
  if (food) { take(m, food, 1); g.stats.palFed = (g.stats.palFed || 0) + 1; }
}
const palFree = (g, x, y) => !(g.protect && g.protect.has(y * W + x)) && !inGateFrame(g, x, y) && !inHouse(g, x, y) && !(Math.abs(x - g.m.home.x) <= 14 && Math.abs(y - g.m.home.y) <= 10);
// ore showing in the rock close by
function palLook(g, p) {
  for (let r = 1; r <= PAL_DUG_FROM; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = p.x + dx, y = p.y + dy, t = get(g, x, y);
    if (!PAL_ORES.has(t) || !palFree(g, x, y) || digTicks(t, tier(g.m)) === INF) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => get(g, x + a, y + b) === T.AIR)) { p.dig = {x, y, t, n: 0, need: gritDig(g.m, digTicks(t, tier(g.m)))}; return; }
  }
}
// a good eye for rock: one vein the miner hasn't noticed gets pointed out
function palScout(g, p) {
  let best = -1, at = -1;
  for (let dy = -PAL_SCOUT_FROM; dy <= PAL_SCOUT_FROM; dy++) for (let dx = -PAL_SCOUT_FROM; dx <= PAL_SCOUT_FROM; dx++) {
    const x = p.x + dx, y = p.y + dy, k = y * W + x, t = get(g, x, y), v = ORE_TILES.indexOf(t);
    if (v > best && PAL_ORES.has(t) && !g.known.has(k) && palFree(g, x, y)) { best = v; at = k; }
  }
  if (at < 0) return;
  g.known.add(at);
  g.stats.palSpots = (g.stats.palSpots || 0) + 1;
  palSay(g, p.name + ' spotted ' + P[g.w.t[at]].name.toLowerCase() + ' in the rock');
}
function palFight(g, p) {
  let near = null, far = PAL_SEE + 1;
  for (const e of g.monsters) {
    if (e.hp <= 0 || e.type === 'warden' || e.type === 'blastcap') continue;
    const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    if (d < far) { far = d; near = e; }
  }
  if (!near) return false;
  p.facing = Math.sign(near.x - p.x) || p.facing;
  if (Math.abs(near.x - p.x) <= 1.5 && Math.abs(near.y - p.y) <= 1.5) { // the miner's own attack: same reach, same timing, same blow
    p.work = 'fight'; p.swing = (p.swing || 0) + 1; p.swingT = (p.swingT || 0) + 1;
    if (p.swingT >= PAL_HIT) {
      p.swingT = 0;
      const d = swordDmg(g.m), dir = Math.sign(near.x - p.x) || 1;
      near.hp -= d; near.hurt = 8; sfx(g, 'mhit', near.x, near.y, near.type);
      g.fx.push({type: 'num', x: near.x, y: near.y - 2, text: '-' + d, life: 25, color: '#ffe08a'});
      if (near.hp <= 0) { p.kills++; g.stats.palKills = (g.stats.palKills || 0) + 1; monsterFell(g, near); }
      else if (monPass(get(g, near.x + dir, near.y)) && monPass(get(g, near.x + dir, near.y - 1))) { near.x += dir; near.from = null; }
    }
    return true;
  }
  palWalk(g, p, Math.sign(near.x - p.x) || p.facing);
  return true;
}
function palDigging(g, p) {
  const c = p.dig;
  if (get(g, c.x, c.y) !== c.t || Math.abs(c.x - g.m.x) + Math.abs(c.y - g.m.y) > PAL_FAR - 8) { p.dig = null; return false; }
  if (Math.abs(c.x - p.x) <= 1 && c.y <= p.y + 1 && c.y >= p.y - 2) { // right up against it, as the miner would be
    p.work = 'dig'; p.swing = (p.swing || 0) + 1; p.facing = Math.sign(c.x - p.x) || p.facing;
    if (++c.n % 7 === 1) sfx(g, 'hit', c.x, c.y, c.t);
    if (c.n >= c.need) {
      g.fx.push({type: 'crumble', x: c.x, y: c.y, t: c.t, life: 12});
      setTile(g, c.x, c.y, T.AIR); g.known.delete(c.y * W + c.x);
      const item = palItem(c.t); p.pack[item] = (p.pack[item] || 0) + 1;
      g.stats.palDug = (g.stats.palDug || 0) + 1; p.dig = null; p.rest = g.tick + PAL_REST;
    }
    return true;
  }
  if (!palWalk(g, p, Math.sign(c.x - p.x) || p.facing)) p.dig = null;
  return true;
}
function palStep(g) {
  const m = g.m, p = m.pal;
  if (!p) return;
  if (palAtCamp(g)) { palCamp2(g, m); return; }
  if (inUnder(g)) return; // they look after the camp while the miner is below
  if (p.mode === 'camp') { p.mode = 'road'; p.act = null; p.path = []; p.job = null; palPlace(g, p); }
  p.work = null;
  if (m.dead) return;
  const dist = Math.abs(p.x - m.x) + Math.abs(p.y - m.y);
  if (dist > PAL_FAR || !palBody(g, p.x, p.y) || p.stuck > 120) { palPlace(g, p); return; }
  if (p.step) { palMove(g, p); return; }
  if (!isSolid(get(g, p.x, p.y + 1)) && get(g, p.x, p.y) !== T.WATER) { // the floor went: down to the next one, or back to the miner
    for (let dy = 1; dy <= 8 && palBody(g, p.x, p.y + dy); dy++) if (palStand(g, p.x, p.y + dy)) { palStepTo(g, p, p.x, p.y + dy, 'f'); return; }
    palPlace(g, p); return;
  }
  if (g.tick % PAL_SHARE === 0 && dist <= PAL_FAR) palShare(g, p);
  if (palFight(g, p)) return;
  if (m.sleeping) return;
  if (p.dig && palDigging(g, p)) return;
  if (g.tick % PAL_LOOK === 0 && !(p.rest > g.tick)) palLook(g, p);
  if (g.tick % PAL_SCOUT === 0) palScout(g, p);
  // set off only once the miner has really moved away, and stop close by: a miner shuffling about doesn't send them back and forth
  const gap = m.x - p.x, d = Math.sign(gap), by = Math.abs(gap);
  if (by >= PAL_SET_OFF) p.going = true;
  if (by <= PAL_CLOSE) { p.going = false; p.stuck = 0; if (d) p.facing = d; return; }
  if (!p.going) return;
  if (palWalk(g, p, d)) p.stuck = 0; else p.stuck++;
}

// ---------- at camp: a second miner ----------
// The miner's own brain runs for them: g.m is swapped to the companion for their turn, so walking, digging, climbing,
// fighting and path-finding are the very same code. They only ever gather; the miner keeps the building, the Grit,
// the scrapbook and the replay (each of those checks g.palTurn).
const PAL_WANTS = [['log', 30], ['coal', 30], ['raw_iron', 20], ['raw_copper', 16], ['raw_gold', 10], ['gem', 8]];
const PAL_TRIP_ORES = ['raw_iron', 'raw_copper', 'coal', 'raw_gold', 'gem'];
const PAL_DROP = {dirt: 1, sand: 1};
const PAL_BATCH = 8, PAL_LOAD = 48, PAL_KEEP_COBBLE = 30, PAL_KEEP_FOOD = 4, PAL_KO = 200;
const PAL_KINDS = ['pick', 'sword', 'axe', 'shovel'];
const palAtCamp = g => { const j = g.m.journey; return !!j && j.stage === 'camp' && !inUnder(g); };
// what a miner needs to be one: the fields the jobs read, with the camp's home and stations shared
function palBody2(p, mm) {
  const fill = {hp: 20, hunger: 20, inv: {}, dur: {}, act: null, path: [], job: null, chain: [], swing: 0, hurt: 0, dead: 0, sleeping: false, fails: 0, stripDir: 1, regenT: 0, hungerT: 0, thought: 'Looking around', idleT: 0};
  for (const k in fill) if (p[k] === undefined) p[k] = fill[k];
  p.home = mm.home; p.stations = mm.stations; p.journey = mm.journey; p.hut = mm.hut; p.built = mm.built; p.bed = null;
  p.gritLv = 1;
  for (const kind of PAL_KINDS) { const k = equipped(mm, kind); if (k && !equipped(p, kind)) p.inv[k] = 1; } // a set of the miner's tools, kept topped up
  if ((p.inv.cobble || 0) < 12) p.inv.cobble = (p.inv.cobble || 0) + 20;
}
function palTurn(g, fn) {
  const mm = g.m, p = mm.pal, was = {thinkAt: g.thinkAt, spotted: g.spotted, black: g.black};
  g.palBlack = g.palBlack || new Map();
  g.m = p; g.thinkAt = p.thinkAt; g.spotted = undefined; g.black = g.palBlack; g.palTurn = p; g.palMiner = mm;
  try { return fn(g, p, mm); } catch (err) { p.job = null; p.act = null; p.path = []; if (globalThis.BURROW_DEBUG) throw err; }
  finally { p.thinkAt = g.thinkAt; g.m = mm; g.thinkAt = was.thinkAt; g.spotted = was.spotted; g.black = was.black; g.palTurn = null; g.palMiner = null; }
}
const palPack = p => Object.keys(p.inv).filter(k => !TOOL_KIND[k] && k !== 'cobble' && !FOOD[k] && !PAL_DROP[k]).reduce((n, k) => n + p.inv[k], 0);
// what the camp is shortest of, measured against what the miner carries
// a trip at a time: out for wood, or down a mine for a bit of every ore, then home with the lot
function palTrip(g, p, mm) {
  const need = k => (cnt(mm, k) + cnt(p, k)) / (PAL_WANTS.find(w => w[0] === k) || [k, 10])[1];
  const ores = PAL_TRIP_ORES.filter(k => k !== 'gem' || tier(p) >= 2).sort((a, b) => need(a) - need(b));
  const wood = p.lastTrip !== 'wood' && (need('log') < 1.5 || p.lastTrip === 'mine' && need('log') < 4);
  p.lastTrip = wood ? 'wood' : 'mine';
  return wood ? {kind: 'wood', goal: cnt(p, 'log') + 24, tries: 0} : {kind: 'mine', ores, done: {}, tries: 0};
}
function palChoose(g, p, mm) {
  const home = mm.home, far = Math.abs(p.x - home.x) + Math.abs(p.y - home.y), t = p.trip;
  if (t && !t.over && (palPack(p) >= PAL_LOAD || t.tries > 12)) t.over = true;
  if (isNight(g) || p.hp < 8 || (t && t.over)) {
    if (far > 4) { const j = trekJob(g, home.x, 'camp', home.y); j.label = t && t.over ? 'Taking my haul back to camp' : 'Heading back to camp'; p.chain = []; return j; }
    if (t && t.over) p.trip = null; // home again: unloaded, so plan the next trip
    else return {name: 'rest', label: isNight(g) ? 'Sitting up by the fire' : 'Catching my breath at camp', run(g) { p.act = {type: 'wait', t: 0, dur: 60}; return 'done'; }};
  }
  if (!p.trip) p.trip = palTrip(g, p, mm);
  const tr = p.trip;
  tr.tries++;
  if (tr.kind === 'wood') {
    if (cnt(p, 'log') >= tr.goal) { tr.over = true; return palChoose(g, p, mm); }
    p.chain = ['Wood trip for camp'];
    const j = gatherJob(g, 'log', tr.goal);
    if (j) return j;
    tr.over = true; return wanderJob(g);
  }
  for (const item of tr.ores) {
    if (tr.done[item]) continue;
    tr.done[item] = true;
    p.chain = ['Mining trip for camp'];
    const j = gatherJob(g, item, cnt(p, item) + PAL_BATCH);
    if (j) return j;
  }
  if (palPack(p) < PAL_LOAD / 3 && !tr.again) { tr.again = true; tr.done = {}; return palChoose(g, p, mm); } // a thin haul: go round the ores once more
  tr.over = true;
  return palChoose(g, p, mm);
}
function palThink(g, p) {
  const food = Object.keys(p.inv).filter(k => FOOD[k] && k !== 'raw_meat' && k !== 'raw_fish').sort((a, b) => FOOD[b] - FOOD[a])[0];
  if (p.hunger <= 12 && food) { p.act = {type: 'eat', t: 0, item: food}; return true; }
  for (const e of g.monsters) {
    if (e.hp <= 0 || e.type === 'warden' || e.type === 'blastcap') continue;
    if (Math.abs(e.x - p.x) <= 1 && Math.abs(e.y - p.y) <= 1) { p.facing = Math.sign(e.x - p.x) || p.facing; p.act = {type: 'swing', t: 0, target: e}; e.chased = 0; return true; }
  }
  return false;
}
// one tick of the companion's life, as step() is for the miner
function palLive(g, p, mm) {
  if (p.dead) { if (--p.dead <= 0) { p.dead = 0; p.hp = 20; p.hunger = Math.max(p.hunger, 14); palCampSpot(g, p, mm); } return; }
  p.hungerT++;
  if (p.hungerT >= 800) { p.hungerT = 0; p.hunger = Math.max(0, p.hunger - 1); }
  if (++p.regenT >= 80) { p.regenT = 0; if (p.hunger >= 14 && p.hp < 20) p.hp++; if (p.hunger === 0) hurtMiner(g, 1, 'hunger'); }
  if (p.hurt > 0) p.hurt--;
  if (inLava(g) && g.tick % 10 === 0) hurtMiner(g, 3, 'lava');
  if (p.dead) return;
  if ((!p.act || p.act.type === 'eat' || p.act.type === 'wait') && !solidAt(g, p.x, p.y + 1)) p.act = {type: 'fall', t: 0, dist: 0};
  if (p.act) { progressAct(g); return; }
  if (!(g.thinkAt > g.tick)) { g.thinkAt = g.tick + 10; if (palThink(g, p)) return; }
  if (p.path.length) { const n = p.path.shift(); if (!startStep(g, n)) { p.path = []; p.job = null; } else progressAct(g); return; }
  if (!p.job) { p.job = palChoose(g, p, mm); p.thought = describe(g); p.jobStart = g.tick; }
  const job = p.job;
  let r;
  try { r = job.run(g); } catch (err) { r = 'fail'; if (globalThis.BURROW_DEBUG) throw err; }
  if (r === 'fail') { p.fails++; p.job = p.fails >= 3 ? wanderJob(g) : null; if (p.fails >= 3) p.fails = 0; }
  else if (r === 'done') { p.job = null; p.fails = 0; }
  else p.fails = 0;
  if (!p.act && !p.path.length) { if (++p.idleT > 120) { p.idleT = 0; p.job = wanderJob(g); g.palBlack.clear(); } } else p.idleT = 0;
  if (p.job && p.job !== job) p.thought = describe(g);
  if (r === 'run' && !p.act && !p.path.length && p.job === job && ++job.idle > 20) p.job = null;
}
function palCampSpot(g, p, mm) {
  const keep = {x: mm.x, y: mm.y, facing: mm.facing};
  mm.x = mm.home.x; mm.y = mm.home.y; palPlace(g, p); Object.assign(mm, keep);
  p.act = null; p.path = []; p.job = null;
}
// knocked out: they come round at camp a little later. Nothing dropped, nothing lost from the miner's tally
function palKO(g, src) {
  const p = g.palTurn;
  p.dead = PAL_KO; p.hp = 0; p.act = null; p.path = []; p.job = null;
  logEvent(g, 'knocked out by ' + koName(src));
}
// home, or beside the miner: the pack goes over, and some food comes back
function palUnload(g, p, mm) {
  const near = Math.abs(p.x - mm.home.x) + Math.abs(p.y - mm.home.y) <= 4 || Math.abs(p.x - mm.x) + Math.abs(p.y - mm.y) <= 3;
  if (!near || !palPack(p)) return;
  const got = [];
  for (const k of Object.keys(p.inv)) {
    if (TOOL_KIND[k] || FOOD[k] || k === 'torch' || ARMOR_SLOTS.some(s => armorPiece(p, s) === k)) continue;
    if (PAL_DROP[k]) { delete p.inv[k]; continue; } // tunnel spoil: tipped out, not carried home
    const n = k === 'cobble' ? p.inv[k] - PAL_KEEP_COBBLE : p.inv[k];
    if (n <= 0) continue;
    p.inv[k] -= n; if (!p.inv[k]) delete p.inv[k];
    add(g, k, n); got.push(n + ' ' + ITEMS[k].toLowerCase());
    p.gave = (p.gave || 0) + n; g.stats.palGave = (g.stats.palGave || 0) + n;
  }
  const have = Object.keys(p.inv).filter(k => FOOD[k]).reduce((n, k) => n + p.inv[k], 0), spare = Object.keys(mm.inv).find(k => FOOD[k] && mm.inv[k] >= 8);
  if (have < PAL_KEEP_FOOD && spare) { take(mm, spare, 3); p.inv[spare] = (p.inv[spare] || 0) + 3; g.stats.palFed = (g.stats.palFed || 0) + 1; }
  if (got.length) palSay(g, p.name + ' brought back ' + got.slice(0, 4).join(', '));
}
function palCamp2(g, mm) {
  const p = mm.pal;
  if (p.mode !== 'camp') { p.mode = 'camp'; palBody2(p, mm); p.act = null; p.path = []; p.job = null; p.step = null; p.dig = null; p.work = null; }
  if (g.palReady !== g.seed) { g.palReady = g.seed; palBody2(p, mm); p.act = null; p.path = []; p.job = null; } // a loaded world: plans don't keep
  if (g.tick % 200 === 0) palBody2(p, mm);
  if (!palBody(g, p.x, p.y) && !p.dead) palCampSpot(g, p, mm);
  palTurn(g, palLive);
  palUnload(g, p, mm);
}
