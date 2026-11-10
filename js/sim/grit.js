// Burrow sim · grit.js — Grit: what the miner earns by digging, fighting and getting on with it. Levels make the monsters tougher, and the miner a bit tougher too.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

const GRIT_ORE = {[T.COAL]: 1, [T.COPPER]: 2, [T.IRON]: 3, [T.GOLD]: 5, [T.GEM]: 8, [T.OBSIDIAN]: 4, [T.CINDERITE]: 6, [T.GLIMMER]: 4};
const GRIT_MILESTONE = 5, GRIT_CAMP = 15, GRIT_KEEP = 20;
const TOUGH_FROM = 12, TOUGH_STEP = 0.02, TOUGH_LATE = 40, TOUGH_LATE_STEP = 0.06, TOUGH_MOST = 4.5, TOUGH_BITE = 0.6; // from this level monsters gain health each level, faster once the miner is in its best gear, up to four and a half times. Their bite grows at this share of that
const THROUGH_STEP = 0.1, THROUGH_MOST = 0.35;
const PERK_MOST = 5, PERK_DIG = 0.06, GRIT_KO_LOSS = 5;

const gritCost = lv => 20 + 5 * lv + (lv * lv >> 2); // from this level to the next: each one takes longer, so a long journey still has levels left
const gritLevel = m => m.gritLv || 1;
// how far through the current level, 0..1, for the meter
function gritProgress(m) {
  let left = m.grit || 0;
  for (let l = 1; l < gritLevel(m); l++) left -= gritCost(l);
  return clamp(left / gritCost(gritLevel(m)), 0, 1);
}
function gritLevelFor(points) {
  let lv = 1;
  while (points >= gritCost(lv)) points -= gritCost(lv++);
  return lv;
}
// a world from before Grit: what it has already done counts
function gritWorld(g) {
  const m = g.m, s = g.stats;
  let n = (s.kills || 0) * 6 + (s.milestones || []).length * GRIT_MILESTONE + (s.camps || 0) * GRIT_CAMP + (s.keeps || 0) * GRIT_KEEP;
  for (const t in GRIT_ORE) n += (s.mined[t] || 0) * GRIT_ORE[t];
  m.grit = n; m.gritLv = gritLevelFor(n);
}
// the perks take turns every 10 levels: a heart, then quicker digging
const gritHearts = lv => Math.min(PERK_MOST, Math.floor((lv + 10) / 20)), gritDigs = lv => Math.min(PERK_MOST, Math.floor(lv / 20));
const maxHp = m => 20 + gritHearts(gritLevel(m)) * 2;
const gritDig = (m, need) => need === INF ? INF : Math.max(1, Math.ceil(need * (1 - gritDigs(gritLevel(m)) * PERK_DIG)));
function gainGrit(g, n, x, y) {
  if (g.palTurn) return; // Grit is the miner's
  const m = g.m;
  if (m.gritLv === undefined) gritWorld(g);
  m.grit += n;
  if (x !== undefined) for (let i = Math.min(4, 1 + (n >> 1)); i > 0; i--) g.fx.push({type: 'grit', x: x + 0.5, y: y + 0.5, life: 26 + i * 3, seed: g.tick + i * 7});
  const lv = gritLevelFor(m.grit);
  if (lv === m.gritLv) return;
  const hearts = gritHearts(lv) > gritHearts(m.gritLv), digs = gritDigs(lv) > gritDigs(m.gritLv);
  m.gritLv = lv; g.stats.dayLevel = lv;
  bookGrit(g, lv);
  if (hearts) m.hp = Math.min(maxHp(m), m.hp + 2);
  sfx(g, 'level', m.x, m.y);
  g.fx.push({type: 'num', x: m.x, y: m.y - 3, text: 'Grit ' + lv, life: 60, color: '#ffc24a'});
  logEvent(g, 'Reached Grit level ' + lv + (hearts ? ': one more heart' : digs ? ': digging a little quicker' : ''));
}
// a knockout costs levels, keeping its place within the level it lands on. Perks and monster strength follow the level down
function loseGrit(g) {
  const m = g.m, s = g.stats;
  if (m.gritLv === undefined) gritWorld(g);
  const was = gritLevel(m), lv = Math.max(1, was - GRIT_KO_LOSS);
  if (lv === was) return;
  const part = gritProgress(m);
  let points = Math.floor(part * gritCost(lv));
  for (let l = 1; l < lv; l++) points += gritCost(l);
  m.grit = points; m.gritLv = lv;
  s.gritBest = Math.max(s.gritBest || 0, was);
  s.gritLost = (s.gritLost || 0) + was - lv;
  g.fx.push({type: 'num', x: m.x, y: m.y - 3, text: 'Grit ' + lv, life: 60, color: '#ff6a5a'});
  logEvent(g, 'Lost ' + (was - lv) + ' Grit levels, down to ' + lv);
}
// what it's worth to the miner when it goes down
const gritFor = e => Math.max(2, Math.round((MON[e.type] || {hp: 12}).hp / 3));
// a monster takes its strength from how the miner stands when it first turns up, and keeps it
const toughAt = lv => Math.min(TOUGH_MOST, 1 + Math.max(0, Math.min(lv, TOUGH_LATE) - TOUGH_FROM) * TOUGH_STEP + Math.max(0, lv - TOUGH_LATE) * TOUGH_LATE_STEP);
function toughen(g, e) {
  e.power = e.type === 'warden' ? 1 : toughAt(gritLevel(g.m));
  e.hp = Math.round(e.hp * e.power);
}
const monBite = (e, spec) => Math.round(spec.dmg * (1 + ((e.power || 1) - 1) * TOUGH_BITE));
// the share of a blow that gets through any armor: nothing from a plain monster, more from a tough one. Only matters to a miner well armored against it
const biteThrough = power => Math.min(THROUGH_MOST, ((power || 1) - 1) * THROUGH_STEP);
