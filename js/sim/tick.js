// Burrow sim · tick.js — One simulation tick, the thought text, and the public Burrow API.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// ---------- main tick ----------
function step(g) {
  const m = g.m;
  if (!m.obsidian) obsidianWorld(g);
  if (m.gritLv === undefined) gritWorld(g);
  if (m.journey && m.journey.stage === 'travel' && m.x >= W - SHIFT_AT && !m.act) shiftWorld(g);
  g.tick++;
  g.time += m.sleeping ? 6 : m.hiding ? 4 : 1;
  const nd = Math.floor(g.time / DAY) + 1;
  if (nd !== g.day) { writeDiary(g, g.day); g.day = nd; logEvent(g, 'Day ' + nd + ' begins'); seedTrees(g); refoliate(g); if (nd === 2) milestone(g, 'night1', 'Survived the first night'); adoptPet(g); }
  // world upkeep
  if (g.decay && g.decay.length && g.tick % 5 === 0) {
    g.decay = g.decay.filter(d => {
      if (d.at > g.tick) return true;
      const t = get(g, d.x, d.y);
      if ((t === T.LEAVES || t === T.PINE) && !hasLogNear(g, d.x, d.y)) { setTile(g, d.x, d.y, T.AIR); g.fx.push({type: 'leaf', x: d.x, y: d.y, life: 24}); if (!m.dead && Math.abs(d.x - m.x) <= 12 && Math.abs(d.y - m.y) <= 10) { if (g.rng() < 0.5) add(g, 'leaf', 1); if (g.rng() < 0.05) add(g, 'apple', 1); } }
      return false;
    });
  }
  if (g.w.regrow && g.tick % 50 === 0) g.w.regrow = g.w.regrow.filter(r => {
    if (r.at > g.tick) return true;
    if (r.leaf) { if (regrowLeaf(g, r)) return false; r.at = g.tick + 400; return true; }
    if (r.tree) {
      const x = r.k % W, y = (r.k / W) | 0;
      if (g.w.t[r.k] !== T.SAPLING) return false;
      if (inHomeYard(g, x)) { setTile(g, x, y, T.AIR); return false; }
      if (growTree(g, x, y)) return false;
      r.at = g.tick + Math.floor(DAY * 0.25); return true; // try again later
    }
    if (g.w.t[r.k] === T.BUSHE) { const x = r.k % W, y = (r.k / W) | 0; setTile(g, x, y, T.BUSH); } return false; });
  if (g.tick % 40 === 0) trySpawnMonster(g);
  if (g.tick % 100 === 0) updateTrader(g);
  if (g.tick % 20 === 0) updateSpawners(g);
  updateMonsters(g);
  updateCritters(g);
  if (g.w.villages) updateVillages(g);
  trailStep(g);
  palStep(g);
  comfortStep(g);
  updateFluids(g);
  for (const f of g.fx) f.life--;
  g.fx = g.fx.filter(f => f.life > 0);
  if (m.hurt > 0) m.hurt--;
  if (m.safe > 0) m.safe--;

  if (m.dead) { if (--m.dead <= 0) { m.dead = 0; respawn(g); } return; }
  // needs
  m.hungerT += m.sleeping ? 0.4 : 1;
  if (m.hungerT >= 800) { m.hungerT = 0; m.hunger = Math.max(0, m.hunger - 1); }
  m.regenT++;
  if (m.regenT >= 80) {
    m.regenT = 0;
    if (m.hunger >= 14 && m.hp < maxHp(m)) m.hp++;
    if (m.hunger === 0) hurtMiner(g, 1, 'hunger');
  }
  if (inLava(g)) {
    if (g.tick % 10 === 0 && !firewalkSaves(g)) hurtMiner(g, 3, 'lava');
    if (m.job && m.job.name !== 'escape') { m.job = null; m.path = []; if (m.act && m.act.type !== 'step') m.act = null; }
  }
  if (m.dead) return;
  // nothing underneath any more (sand fell, block mined out): drop
  if ((!m.act || m.act.type === 'craft' || m.act.type === 'eat' || m.act.type === 'wait' || m.act.type === 'fish') && !m.sleeping && !solidAt(g, m.x, m.y + 1)) m.act = {type: 'fall', t: 0, dist: 0};

  if (m.act) { progressAct(g); return; }
  // every ~10 ticks, on the first free tick (a tick-modulo check can keep landing mid-step while walking)
  if (!(g.thinkAt > g.tick)) { g.thinkAt = g.tick + 10; thinkInterrupts(g); }
  // spotted the ore it's strip mining for: stop the tunnel here and go and get it
  if (g.spotted !== undefined) {
    if (m.job && m.job.name === 'strip' && g.spotted === RAW_SOURCE[m.job.item]) m.path = [];
    g.spotted = undefined;
  }
  if (m.path.length) {
    const n = m.path.shift();
    if (!startStep(g, n)) { m.path = []; m.job = null; }
    else progressAct(g);
    return;
  }
  if (!m.job) {
    m.job = chooseJob(g);
    m.thought = describe(g);
    m.jobStart = g.tick;
  }
  const job = m.job;
  let r;
  try { r = job.run(g); } catch (err) { r = 'fail'; if (globalThis.BURROW_DEBUG) throw err; }
  if (m.job !== job && m.job) { m.thought = describe(g); return; }
  if (r === 'fail') { m.fails++; m.job = m.fails >= 3 ? wanderJob(g) : null; if (m.fails >= 3) m.fails = 0; }
  else if (r === 'done') { m.job = null; m.fails = 0; }
  else m.fails = 0;
  if (!m.act && !m.path.length) { m.idleT = (m.idleT || 0) + 1; if (m.idleT > 120) { m.idleT = 0; m.job = wanderJob(g); g.black.clear(); } }
  else m.idleT = 0;
  if (r === 'run' && !m.act && !m.path.length && m.job === job) {
    job.idle = (job.idle || 0) + 1;
    if (job.idle > 20) m.job = null;
  }
}
function describe(g) {
  const m = g.m, j = m.job;
  if (!j) return m.thought;
  const c = m.chain;
  if (j.name === 'collect' || j.name === 'strip') {
    const last = c.length ? c[c.length - 1] : '';
    const goal = c.length > 1 ? c[0] : '';
    if (last && goal) return 'Need ' + last.replace(' × ', ' ').toLowerCase() + ' for: ' + goal.toLowerCase();
  }
  if ((j.name === 'craft' || j.name === 'surface') && c[0] && !j.label.endsWith(c[0].toLowerCase())) return j.label + ' → ' + c[0].toLowerCase();
  return j.label;
}

globalThis.Burrow = {B_RED, B_MIRE, B_AMBER, B_SAVANNA, W, H, TPS, DAY, T, P, ITEMS, RECIPES, GOALS, BIOMES, MON, FOOD, LOW_MON, BLAST_FUSE, newGame, step, tier, isNight, dayFrac, skyAt, isSolid, passable, cnt, armor, swordDmg, get, mulberry, hash2,
  DUR, durLeft, equipped, armorPiece, collectionCount, COLLECTION, gritProgress, gritLevel, gritHearts, gritDigs, maxHp, PERK_DIG, campRange, makeUnderState, renewUnder, switchRealm, inUnder, moveOn, holdJourney, setPal, UNDER_BIOMES, weatherNow, cropStage};
