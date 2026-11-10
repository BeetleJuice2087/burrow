// Burrow sim · miner.js — Knockouts and respawn, timed actions (steps, digging, crafting), torches.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// ---------- miner: life, death ----------
function die(g, src) {
  if (g.palTurn) return palKO(g, src);
  sfx(g, 'ko', g.m.x, g.m.y);
  const m = g.m;
  m.dead = 60; m.hp = 0; m.act = null; m.path = []; m.job = null; m.sleeping = false;
  g.stats.deaths++;
  bookKO(g, src);
  loseGrit(g);
  trailKO(g);
  let gx = m.x, gy = m.y;
  if (!passable(get(g, gx, gy)) || get(g, gx, gy) === T.TORCH) gy--;
  if (CROP_TILE_SET.has(get(g, gx, gy))) for (const dx of [1, -1, 2, -2, 3, -3, 4, -4]) if (get(g, m.x + dx, gy) === T.AIR) { gx = m.x + dx; break; } // never on top of the crops
  const KEEP = ['ward_key', 'glimmer', 'bow', 'wood_pick','stone_pick','iron_pick','gem_pick','wood_sword','stone_sword','iron_sword','copper_armor','iron_armor'];
  const items = {}, kept = {};
  const worn = ['pick', 'sword', 'axe', 'shovel'].map(s => equipped(m, s)).concat(ARMOR_SLOTS.map(s => armorPiece(m, s))); // the gear in use stays on
  for (const k in m.inv) (KEEP.includes(k) || worn.includes(k) ? kept : items)[k] = m.inv[k];
  if (Object.keys(items).length) {
    setTile(g, gx, gy, T.GRAVE);
    g.w.graves[gy * W + gx] = items;
  }
  m.inv = kept;
  logEvent(g, 'Knocked out by ' + koName(src) + ' (day ' + g.day + ')');
  (g.stats.dayKO = g.stats.dayKO || []).push(src);
  m.thought = 'Ouch. Dropped my pack.';
}
function monsterFell(g, e) {
  sfx(g, 'mdie', e.x, e.y, e.type); g.stats.kills++; g.fx.push({type: 'poof', x: e.x, y: e.y, life: 20});
  gainGrit(g, gritFor(e), e.x, e.y);
  if (e.type === 'blastcap') { blastcapBurst(g, e); milestone(g, 'first_cap', 'Popped a blastcap'); } // beaten or not, it goes off
  milestone(g, 'first_kill', 'Won a first fight');
  if (e.type === 'warden') wardenFell(g, e);
  kitDrops(g, e);
  if (!inUnder(g) && g.rng() < 1 / 6) add(g, 'potato', 1);
}
function respawn(g) {
  const m = g.m;
  if (inUnder(g)) switchRealm(g, 'over', m.home.x, m.home.y); // the pack stays down there till the next trip
  const p = m.bed && get(g, m.bed.x, m.bed.y) === T.BED ? m.bed : m.home;
  m.x = p.x; m.y = p.y;
  while (!passable(get(g, m.x, m.y)) || !passable(get(g, m.x, m.y - 1))) m.y--;
  m.hidDay = -1; m.safe = 80;
  g.monsters = g.monsters.filter(e => e.type === 'warden'); // the rest lose interest while it's out cold: a crowd left on its dropped pack would knock it out again and again
  m.px = m.x; m.py = m.y; m.hp = maxHp(m); m.hunger = Math.max(m.hunger, 14);
  m.thought = 'Back at home. Time to get my stuff back.';
}

// ---------- actions ----------
// boxed in by lava: wall off what touches the cells it's about to open, so the way out doesn't flood behind it
function sealLava(g, cells) {
  for (const [cx, cy] of cells) {
    if (get(g, cx, cy) === T.LAVA) placeBlock(g, cx, cy);
    if (!isSolid(get(g, cx, cy))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(g, cx + dx, cy + dy) === T.LAVA) placeBlock(g, cx + dx, cy + dy);
  }
}
// m.act types: step, dig, craft, place, eat, swing, sleep, wait
function startStep(g, n) {
  const m = g.m, x = m.x, y = m.y, d = Math.sign(n.x - x);
  // the step must start where the miner actually stands, or the path is stale
  const ddx = Math.abs(n.x - x), ddy = n.y - y;
  const fits = {w: ddx === 1 && ddy === 0, b: ddx === 1 && ddy === 0, j: ddx === 2 && ddy === 0, u: ddx === 1 && ddy === -1,
    d: ddx === 1 && ddy === 1, D: ddx === 0 && ddy === 1, p: ddx === 0 && ddy === -1, g: ddx === 1 && ddy <= -2 && ddy >= -GRAPPLE_UP, f: ddx === 1 && ddy >= 1 && ddy <= (n.drop ? 45 : 6)}[n.m];
  if (!fits) return false;
  let digs = [];
  switch (n.m) {
    case 'w': case 'f': case 'b': digs = [[n.x, y], [n.x, y - 1]]; break;
    case 'u': digs = fixedRoof(g, x, y - 2, tier(m)) ? [[n.x, y - 1], [n.x, y - 2]] : [[x, y - 2], [n.x, y - 1], [n.x, y - 2]]; break;
    case 'd': digs = [[n.x, y], [n.x, y + 1]]; break;
    case 'D': digs = [[x, y + 1]]; break;
    case 'p': digs = [[x, y - 2]]; break;
  }
  if (n.risk) sealLava(g, digs);
  digs = digs.filter(([cx, cy]) => isSolid(get(g, cx, cy)));
  // validate
  for (const [cx, cy] of digs) { pathLavaRisk = !!n.risk; const c = cellCost(g, cx, cy, tier(m), false); pathLavaRisk = false; if (c === INF) return false; }
  if ((n.m === 'p' || n.m === 'b') && blocksAvail(m) === 0) return false;
  if (n.m === 'b' && !(n.risk && isSolid(get(g, n.x, n.y + 1)))) { const under = get(g, n.x, n.y + 1); if ((under !== T.AIR && under !== T.TORCH && !(n.risk && under === T.LAVA)) || !placeBlock(g, n.x, n.y + 1)) return false; }
  if (n.m === 'w' && !solidAt(g, n.x, n.y + 1)) return false;
  if (n.m === 'j' && (!passable(get(g, n.x, n.y)) || !passable(get(g, n.x, n.y - 1)) || !passable(get(g, x + d, y)) || !passable(get(g, x + d, y - 1)))) return false; // the landing (or the gap) got filled since the path was made
  if (n.m === 'g') { // the line goes up to the ledge, and the miner after it: a clear way up its own column, and room on top
    if (!cnt(m, 'grapple') || !solidAt(g, x, y + 1) || !solidAt(g, n.x, n.y + 1) || !passable(get(g, n.x, n.y)) || !passable(get(g, n.x, n.y - 1))) return false;
    for (let yy = y - 2; yy >= n.y - 1; yy--) if (!passable(get(g, x, yy))) return false;
  }
  if (n.m === 'f') {
    for (let yy = y + 1; yy <= n.y; yy++) if (!passable(get(g, n.x, yy))) return false;
    const k = n.y - y; if (k > 3 && !n.drop && m.hp - (k - 3) * 2 * (1 - armor(m)) < 10) return false;
  }
  for (const [cx, cy] of [[n.x, n.y], [n.x, n.y - 1]]) if (get(g, cx, cy) === T.LAVA && !(cy === n.y && n.m === 'w' && kitWading(g, n.x, n.y))) return false; // with the treads, thin lava is only a wade
  if (d) m.facing = d;
  const dur = Math.round(PACE_MOVE * {w: 7, f: 7 + 2 * (n.y - y), j: 12, u: 10, d: 9, D: 8, p: 14, b: 12, g: 14 + 3 * (y - n.y)}[n.m]);
  m.act = {type: 'step', n, digs, t: 0, phase: digs.length ? 'dig' : 'move', dur, fx: x, fy: y};
  return true;
}
function progressAct(g) {
  const m = g.m, a = m.act;
  if (a.type === 'step') {
    if (a.phase === 'dig') {
      const [cx, cy] = a.digs[0];
      const t = get(g, cx, cy);
      if (!isSolid(t)) { a.digs.shift(); a.t = 0; if (!a.digs.length) a.phase = 'move'; return; }
      const need = gritDig(m, digTicks(t, tier(m)));
      if (need === INF) { m.act = null; m.path = []; return; }
      a.t += toolBoost(m, t); a.digX = cx; a.digY = cy; a.digNeed = need; m.swing++;
      if (a.t % 7 === 1) sfx(g, 'hit', cx, cy, t);
      if (a.t >= need) { breakTile(g, cx, cy); a.digs.shift(); a.t = 0; if (!a.digs.length) a.phase = 'move'; }
      return;
    }
    a.t++;
    const p = Math.min(1, a.t / a.dur);
    const mv = a.n.m;
    if (mv === 'g') { // the line goes up, it hauls itself up its own column, then steps over onto the ledge
      if (a.t === 1) sfx(g, 'bow', m.x, m.y - 1);
      const up = clamp((p - 0.2) / 0.6, 0, 1), over = clamp((p - 0.8) / 0.2, 0, 1);
      m.px = a.fx + (a.n.x - a.fx) * over; m.py = a.fy + (a.n.y - a.fy) * up * (2 - up);
    } else if (mv === 'u') { // climb, then step over
      const k = Math.min(1, p * 1.6), h = Math.max(0, (p - 0.55) / 0.45);
      m.px = a.fx + (a.n.x - a.fx) * h; m.py = a.fy + (a.n.y - a.fy) * k - Math.sin(Math.min(1, p * 1.2) * Math.PI) * 0.15;
    } else if (mv === 'd' || mv === 'f') { // step over, then drop
      const h = Math.min(1, p * 2.2), k = Math.max(0, (p - 0.35) / 0.65);
      m.px = a.fx + (a.n.x - a.fx) * h; m.py = a.fy + (a.n.y - a.fy) * k * k;
    } else {
      m.px = a.fx + (a.n.x - a.fx) * p;
      m.py = a.fy + (a.n.y - a.fy) * p - (mv === 'j' ? Math.sin(p * Math.PI) * 0.5 : 0);
    }
    if (a.t >= a.dur) {
      const ox = m.x, oy = m.y;
      m.x = a.n.x; m.y = a.n.y; m.px = m.x; m.py = m.y; m.act = null;
      g.stats.walked++;
      g.stats.distance = (g.stats.distance || 0) + Math.abs(m.x - ox); // ground covered: climbing and falling don't count
      sfx(g, a.n.m === 'f' && a.n.y - oy > 1 ? 'land' : 'step', m.x, m.y, get(g, m.x, m.y + 1));
      if (a.n.m === 'p') { if (!placeBlock(g, ox, oy)) { m.path = []; } }
      if (a.n.m === 'g') { g.stats.grapples = (g.stats.grapples || 0) + 1; milestone(g, 'first_grapple', 'Climbed a cliff with the grapple line'); }
      if (a.n.m === 'f' && a.n.y - oy > 3) hurtMiner(g, (a.n.y - oy - 3) * 2, 'long fall');
      afterMove(g);
    }
    return;
  }
  a.t += a.type === 'dig' ? toolBoost(m, get(g, a.x, a.y)) : 1;
  if (a.type === 'dig') {
    m.swing++;
    if (a.t >= a.need) { breakTile(g, a.x, a.y); m.act = null; afterMove(g); }
  } else if (a.type === 'craft') {
    if (a.t === 1) sfx(g, RECIPES[a.item] && RECIPES[a.item].st === 'furnace' ? 'smelt' : 'craft', m.x, m.y);
    if (a.t >= (a.fast ? 12 : 24)) { if (a.fn) a.fn(); else doCraft(g, a.item); m.act = null; }
  } else if (a.type === 'fish') {
    if (a.t === 1) sfx(g, 'cast', m.x, m.y);
    if (a.t === a.need - 24) sfx(g, 'splash', a.x, a.y);
    const danger = m.hurt > 0 || get(g, a.x, a.y) !== T.WATER || (a.t % 10 === 0 && (isNight(g) || g.monsters.some(e => Math.abs(e.x - m.x) + Math.abs(e.y - m.y) <= 6)));
    if (danger) { m.act = null; if (m.job && m.job.name === 'fish') m.job = null; }
    else if (a.t >= a.need) { landCatch(g); m.act = null; }
  } else if (a.type === 'eat') {
    if (a.t >= 20) {
      take(m, a.item, 1); m.hunger = Math.min(20, m.hunger + FOOD[a.item]); g.stats.eaten++; sfx(g, 'eat', m.x, m.y);
      if (a.item === 'raw_meat' || a.item === 'raw_fish') m.hp = Math.max(1, m.hp - 1);
      if (a.item === 'camp_stew') stewShared(g);
      if (a.item === 'golden_apple') { m.hp = Math.min(maxHp(m), m.hp + 10); m.safe = Math.max(m.safe || 0, 60); g.fx.push({type: 'num', x: m.x, y: m.y - 2.5, text: '+10', life: 40, color: '#ffd84a'}); }
      m.act = null;
    }
  } else if (a.type === 'swing') {
    m.swing++;
    if (a.t >= 10) {
      const e = a.target;
      if (e && e.hp > 0 && Math.abs(e.x - m.x) <= 1.5 && Math.abs(e.y - m.y) <= 1.5) {
        const d = swordDmg(m); e.hp -= d; e.hurt = 8; if (!a.critter) wear(g, equipped(m, 'sword')); sfx(g, a.critter ? 'coo' : 'mhit', e.x, e.y, e.type);
        g.fx.push({type: 'num', x: e.x, y: e.y - 2, text: '-' + d, life: 25, color: '#ffe08a'});
        if (e.hp <= 0) {
          if (a.critter) { const n = 1 + (g.rng() < 0.5 ? 1 : 0); add(g, 'raw_meat', n); g.fx.push({type: 'poof', x: e.x, y: e.y, life: 20}); }
          else monsterFell(g, e);
        } else if (!a.critter && !(e.netted > g.tick)) { // (a netted one is held where it is)
          const dir = Math.sign(e.x - m.x) || 1; if (monPass(get(g, e.x + dir, e.y)) && monPass(get(g, e.x + dir, e.y - 1))) { e.x += dir; e.from = null; }
        }
      }
      m.act = null;
    }
  } else if (a.type === 'shoot') {
    if (a.t >= BOW_DRAW) { fireArrow(g, a.target); m.act = null; }
  } else if (a.type === 'place') {
    if (a.t >= 6) { a.fn(); m.act = null; sfx(g, 'place', m.x, m.y); }
  } else if (a.type === 'fall') {
    if (a.t % 3 === 0) {
      if (solidAt(g, m.x, m.y + 1)) { m.act = null; if (a.dist > 3) hurtMiner(g, (a.dist - 3) * 2, 'long fall'); sfx(g, 'land', m.x, m.y); look(g); return; }
      if (!passable(get(g, m.x, m.y + 1)) && get(g, m.x, m.y + 1) !== T.LAVA) { m.act = null; return; }
      m.y++; a.dist++; m.py = m.y; m.px = m.x;
      if (get(g, m.x, m.y) === T.WATER) a.dist = 0; // water breaks the fall
    }
  } else if (a.type === 'drink') {
    if (a.t >= 16) { m.act = null; drinkDone(g, a.item); }
  } else if (a.type === 'kite') { // flying the kite: anything coming, or a knock, and it's reeled in
    if (a.t >= a.dur || m.hurt > 0 || (a.t % 10 === 0 && g.monsters.some(e => !capAsleep(e) && Math.abs(e.x - m.x) + Math.abs(e.y - m.y) <= 8))) m.act = null;
  } else if (a.type === 'throw') {
    if (a.t >= a.dur) { m.act = null; a.fn(); }
  } else if (a.type === 'blast') { // set against the rock face, a short fuse, then it goes
    const s = a.spot;
    if (a.t === 10) { g.fx.push({type: 'charge', x: m.x + 0.5 + s.dir * 0.42, y: m.y + 0.8, dir: s.dir, life: CHARGE_FUSE}); sfx(g, 'fizz', m.x + s.dir, m.y); }
    if (a.t >= a.dur) { m.act = null; chargeBurst(g, s); }
  } else if (a.type === 'hide') {
    if (!isNight(g)) { m.hiding = false; m.act = null; m.hidDay = g.day; logEvent(g, 'Made it through the night in a burrow'); }
  } else if (a.type === 'sleep') {
    if (!isNight(g)) { m.sleeping = false; m.act = null; m.sleptDay = g.day; logEvent(g, 'Slept through the night'); milestone(g, 'first_sleep', 'Slept in a bed'); }
  } else if (a.type === 'wait') {
    if (a.t >= a.dur) m.act = null;
  }
}
function afterMove(g) {
  const m = g.m;
  // gravity safety
  if (!solidAt(g, m.x, m.y + 1)) {
    let k = 0; while (k < 30 && passable(get(g, m.x, m.y + 1)) && !solidAt(g, m.x, m.y + 1)) { m.y++; k++; }
    m.py = m.y; if (k > 3) hurtMiner(g, (k - 3) * 2, 'long fall');
  }
  look(g);
  if (inUnder(g)) return;
  const depth = m.y - g.w.surf[g.w.spawn.x];
  if (depth > g.stats.deepest) g.stats.deepest = depth;
  if (m.y >= 100) milestone(g, 'deep', 'Reached the deep rock');
  if (m.y >= 113) milestone(g, 'bottom', 'Reached the lava layer');
  maybeTorch(g);
}
function maybeTorch(g) {
  const m = g.m;
  if (cnt(m, 'torch') <= 0) return;
  // out in the open (sky above, or only a roof of our own over the ground) a torch would just hang in the air
  const open = skyAt(g, m.x, m.y - 1) || m.y < g.w.surf[m.x] + 2;
  if (open && !isNight(g)) return;
  if (open && Math.abs(m.x - m.home.x) > 8) return;
  if (isLitByTorch(g, m.x, m.y, 5)) return;
  const c = get(g, m.x, m.y - 1);
  if (c !== T.AIR || (g.noTorch && g.noTorch.has((m.y - 1) * W + m.x))) return;
  take(m, 'torch', 1); setTile(g, m.x, m.y - 1, T.TORCH); g.stats.torches++; sfx(g, 'torch', m.x, m.y);
}
function doCraft(g, item) {
  const m = g.m, R = RECIPES[item];
  for (const k in R.in) if (cnt(m, k) < R.in[k]) return false;
  for (const k in R.in) take(m, k, R.in[k]);
  add(g, item, R.out);
  g.stats.crafted[item] = (g.stats.crafted[item] || 0) + R.out;
  g.fx.push({type: 'num', x: m.x, y: m.y - 2.5, text: '+' + ITEMS[item], life: 40, color: '#bfe8ff'});
  const big = {wood_pick: 'Crafted a wood pickaxe', stone_pick: 'Crafted a stone pickaxe', iron_pick: 'Crafted an iron pickaxe', gem_pick: 'Crafted the gem pickaxe',
    stone_sword: 'Crafted a stone sword', iron_sword: 'Crafted an iron sword', copper_armor: 'Suited up in copper', iron_armor: 'Suited up in iron', torch: 'Made first torches',
    fishing_rod: 'Made a fishing rod', bow: 'Made a bow', gem_sword: 'Crafted a gem sword', gem_armor: 'Suited up in gem', reinforced_pick: 'Crafted a reinforced pickaxe', golden_apple: 'Made a golden apple', cinder_ingot: 'Forged the first cinder ingot', cinder_pick: 'Crafted a cinder pickaxe', cinder_sword: 'Crafted a cinder sword', cinder_armor: 'Suited up in cinder'};
  if (big[item]) milestone(g, 'c_' + item, big[item]);
  if (big[item] && item !== 'torch') logEvent(g, big[item]);
  return true;
}
