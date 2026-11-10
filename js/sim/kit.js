// Burrow sim · kit.js — The adventuring kit: the grapple line, ember treads, silk nets and blast charges, and making them.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// Spiders drop silk and beaten blastcaps leave blast powder; the miner makes the kit from those once it has them.
// The grapple is a pathfinding move ('g', see findPath), the treads let it wade lava one block deep (kitWading),
// nets hold a monster still (e.netted, see updateMonsters) and charges blow open rock ahead in a strip mine (stripJob).
'use strict';

const GRAPPLE_UP = 6, NET_HOLD = 6 * TPS, NET_FAR = 6, CHARGE_FUSE = 30, CHARGE_KEEP = 3;
const KIT_ITEMS = ['grapple', 'ember_treads', 'silk_net', 'blast_charge', 'silk', 'blast_powder'];

// feet in lava one block deep, with ground under it and air for the head: with the treads on, that's only wading
function kitWading(g, x, y) {
  return cnt(g.m, 'ember_treads') > 0 && get(g, x, y) === T.LAVA && get(g, x, y - 1) !== T.LAVA && isSolid(get(g, x, y + 1));
}
// what a beaten monster leaves for the kit
function kitDrops(g, e) {
  if (g.palTurn) return;
  if (e.type === 'spider') add(g, 'silk', 1 + (g.rng() < 0.5 ? 1 : 0));
  if (e.type === 'blastcap') add(g, 'blast_powder', 1);
}

// ---------- making it ----------
// once the silk or powder is in the pack, the rest is gathered like any recipe. Not on the road, and never the companion
function kitJob(g) {
  const m = g.m;
  if (g.palTurn || tier(m) < 3 || inUnder(g) || (m.journey && m.journey.stage === 'travel') || g.tick < (m.kitNext || 0)) return null;
  const want = [];
  if (!cnt(m, 'grapple') && cnt(m, 'silk') >= 3) want.push(['grapple', 'Make a grapple line']);
  else if (cnt(m, 'grapple') && cnt(m, 'silk_net') < 2 && cnt(m, 'silk') >= 3) want.push(['silk_net', 'Weave a silk net']);
  if (cnt(m, 'blast_charge') < CHARGE_KEEP && cnt(m, 'blast_powder') >= 1) want.push(['blast_charge', 'Make blast charges']);
  if (!cnt(m, 'lucky_charm') && tier(m) >= 4 && g.stats.crafted.gem_pick) want.push(['lucky_charm', 'Make a lucky charm']);
  if (cnt(m, 'glow_broth') < 2 && cnt(m, 'glimmer') >= 1 && (quested(m, 'q_open') || cnt(m, 'glimmer') > RECIPES.ward_key.in.glimmer)) want.push(['glow_broth', 'Brew glow broth']); // the key's glimmer comes first
  if (cnt(m, 'firewalk_tea') < 2 && cnt(m, 'emberfruit') >= 1) want.push(['firewalk_tea', 'Brew firewalk tea']);
  if (!cnt(m, 'ember_treads') && tier(m) >= 4 && (g.stats.underTrips > 0 || m.journey)) want.push(['ember_treads', 'Make ember treads']);
  for (const [item, label] of want) {
    const chain = [label], j = need(g, item, cnt(m, item) + 1, chain);
    if (!j) continue;
    // a day and a half on one piece without making it (no obsidian about, say): leave the kit be for a few days
    const w = m.kitWork;
    if (!w || w.item !== item) m.kitWork = {item, at: g.tick};
    else if (g.tick - w.at > DAY * 1.5) { m.kitWork = null; m.kitNext = g.tick + DAY * 3; return null; }
    m.chain = chain; return j;
  }
  m.kitWork = null;
  return null;
}

// ---------- the silk net ----------
// worth a net: something tough coming at it from a few tiles off, with nothing else held already
function netTarget(g, e, d) {
  const m = g.m;
  if (!e || !cnt(m, 'silk_net') || d < 2 || d > NET_FAR || e.type === 'blastcap' || e.type === 'warden' || e.netted > g.tick) return null;
  if (e.hp < 10 || g.monsters.some(o => o.netted > g.tick)) return null;
  return clearLine(g, m.x, m.y - 1, e.x, e.y, stopsShot) ? e : null;
}
function netJob(g, e) {
  const m = g.m;
  return {name: 'fight', label: 'Throwing a net over the ' + MON[e.type].name, run(g) {
    m.facing = Math.sign(e.x - m.x) || m.facing;
    m.act = {type: 'throw', t: 0, dur: 10, fn: () => {
      if (!cnt(m, 'silk_net')) return;
      take(m, 'silk_net', 1);
      e.netted = g.tick + NET_HOLD; e.moveT = Math.max(e.moveT, 1);
      g.fx.push({type: 'net', x: e.x, y: e.y, life: 12});
      sfx(g, 'snap', e.x, e.y);
      g.stats.netted = (g.stats.netted || 0) + 1;
      milestone(g, 'first_net', 'Caught a monster in a silk net');
    }};
    return 'done';
  }};
}

// ---------- the blast charge ----------
// the cells a charge set against the rock face would open: three rows, five long, from the face onward
function chargeCells(m, dir) {
  const out = [];
  for (let i = 1; i <= 5; i++) for (let dy = -2; dy <= 0; dy++) if (!((i === 1 || i === 5) && dy === -2)) out.push([m.x + dir * i, m.y + dy]);
  return out;
}
const CHARGE_ROCK = new Set([T.STONE, T.DEEP, T.DIRT, T.COAL, T.COPPER, T.IRON, T.GOLD, T.GEM]);
// mostly solid plain rock ahead, nothing wet or built near it, and the miner well back: worth a charge
function chargeSpot(g, dir) {
  const m = g.m;
  if (!dir || cnt(m, 'blast_charge') < 1 || g.palTurn || !isSolid(get(g, m.x + dir, m.y)) && !isSolid(get(g, m.x + dir, m.y - 1))) return null;
  const cells = chargeCells(m, dir);
  let rock = 0;
  for (const [x, y] of cells) {
    const t = get(g, x, y), k = y * W + x;
    if (x < 3 || x >= W - 3 || y <= g.w.surf[x] + 3) return null;
    if ((g.protect && g.protect.has(k)) || inGateFrame(g, x, y) || inHouse(g, x, y) || (Math.abs(x - m.home.x) <= 14 && Math.abs(y - m.home.y) <= 10)) return null;
    if (CHARGE_ROCK.has(t)) rock++;
    else if (isSolid(t)) return null; // something built, or too hard to blow
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = get(g, x + dx, y + dy); if (n === T.LAVA || n === T.WATER || n === T.SAND) return null; }
  }
  return rock >= 10 ? {dir, x: m.x + dir * 3, y: m.y - 1, cells} : null;
}
function throwCharge(g, s) {
  const m = g.m;
  m.facing = s.dir;
  m.act = {type: 'blast', t: 0, dur: 10 + CHARGE_FUSE, spot: s};
}
// the charge goes off: rock comes away (ore and some of the stone into the pack), monsters close by are hurt
function chargeBurst(g, s) {
  const m = g.m;
  if (!cnt(m, 'blast_charge')) return;
  take(m, 'blast_charge', 1);
  sfx(g, 'blast', s.x, s.y);
  g.fx.push({type: 'blast', x: s.x, y: s.y + 1, life: 18});
  for (const [x, y] of s.cells) {
    const t = get(g, x, y);
    if (!CHARGE_ROCK.has(t) || bodyHas(m, x, y)) continue;
    g.stats.mined[t] = (g.stats.mined[t] || 0) + 1;
    if (GRIT_ORE[t]) gainGrit(g, GRIT_ORE[t], x, y);
    g.known.delete(y * W + x);
    const drop = P[t].drop;
    if (drop && (ORE_TILES.includes(t) || g.rng() < 0.5)) add(g, drop, 1);
    g.fx.push({type: 'crumble', x, y, t, life: 12});
    setTile(g, x, y, T.AIR);
  }
  for (const o of g.monsters) if (o.hp > 0 && o.type !== 'warden' && Math.hypot(o.x - s.x, o.y - s.y) <= BLAST_REACH) {
    if (o.type === 'blastcap') { o.awake = true; if (!(o.fuse > 0)) o.fuse = 6; continue; }
    o.hp -= BLAST_DMG; o.hurt = 8; if (o.hp <= 0) monsterFell(g, o);
  }
  g.stats.blasts = (g.stats.blasts || 0) + 1;
  milestone(g, 'first_blast', 'Blew open a tunnel with a charge');
  look(g);
}

// ---------- brews and the charm ----------
const GLOW_TIME = DAY / 4, FIREWALK_TIME = 30 * TPS, CHARM_LUCK = 0.15;
// deep in the dark with no glow on: a drink of glow broth lights the way for a good while
function drinkJob(g) {
  const m = g.m;
  if (g.palTurn || !cnt(m, 'glow_broth') || m.glowUntil > g.tick) return null;
  if (!inUnder(g) && m.y < g.w.surf[m.x] + 15) return null;
  return {name: 'eat', label: 'Drinking glow broth', run(g) { m.act = {type: 'drink', t: 0, item: 'glow_broth'}; return 'done'; }};
}
function drinkDone(g, item) {
  const m = g.m;
  if (!cnt(m, item)) return;
  take(m, item, 1); sfx(g, 'eat', m.x, m.y);
  if (item === 'glow_broth') { m.glowUntil = g.tick + GLOW_TIME; m.hunger = Math.min(20, m.hunger + 2); g.stats.glowed = (g.stats.glowed || 0) + 1; milestone(g, 'first_glow', 'Drank glow broth and lit up the dark'); }
  if (item === 'firewalk_tea') { m.fireUntil = g.tick + FIREWALK_TIME; g.stats.firewalks = (g.stats.firewalks || 0) + 1; }
}
// in lava with firewalk tea in the pack: gulped down on the spot, and the lava can't hurt it for half a minute
function firewalkSaves(g) {
  const m = g.m;
  if (m.fireUntil > g.tick) return true;
  if (!cnt(m, 'firewalk_tea')) return false;
  drinkDone(g, 'firewalk_tea');
  g.fx.push({type: 'num', x: m.x, y: m.y - 2.5, text: 'Firewalk!', life: 40, color: '#ffb04a'});
  logEvent(g, 'Gulped firewalk tea in the lava'); milestone(g, 'first_firewalk', 'Firewalk tea saved it from the lava');
  return true;
}
// the lucky charm: now and then an ore gives up a second one
function charmLuck(g, t) {
  const m = g.m;
  if (!cnt(m, 'lucky_charm') || !ORE_TILES.includes(t) || !P[t].drop || g.rng() >= CHARM_LUCK) return null;
  g.stats.lucky = (g.stats.lucky || 0) + 1;
  return P[t].drop;
}
// a pot of stew eaten at camp gets shared with the companion
function stewShared(g) {
  const m = g.m, p = m.pal;
  if (!p || m.palOff || g.palTurn || Math.abs(p.x - m.x) > 12 || Math.abs(p.y - m.y) > 6) return;
  g.fx.push({type: 'num', x: p.x, y: p.y - 2.2, text: '\u2665', life: 40, color: '#ff7a8a'});
  if (m.stewDay !== g.day) { m.stewDay = g.day; logEvent(g, 'Shared a pot of camp stew with ' + p.name); }
}
