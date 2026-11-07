// Burrow sim · visitors.js — Those who turn up at the homestead: a burrowling that moves in for good, and the travelling trader.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// Names and offers come from a hash of the seed, never g.rng, so adding them doesn't reshuffle a run.
'use strict';

const PET_NAMES = ['Nib', 'Pip', 'Mote', 'Tuck', 'Smudge', 'Biscuit', 'Crumb', 'Pebble'];
const TRADER = 'Odalin';
// [give, how many, how many the miner keeps, get, how many]
const TRADE_POOL = [['cobble', 24, 16, 'cooked_meat', 3], ['coal', 8, 4, 'iron_ingot', 1], ['dirt', 16, 4, 'bread', 2], ['log', 8, 4, 'apple', 3], ['iron_ingot', 6, 4, 'gold_ingot', 1],
  ['gold_ingot', 2, 2, 'gem', 1], ['gem', 2, 2, 'golden_apple', 1], ['raw_fish', 2, 1, 'torch', 8], ['raw_cinderite', 4, 4, 'gold_ingot', 2], ['sand', 12, 2, 'bread', 2]];
// the first full day after the hut goes up, a burrowling is sat on the doorstep and that's that
function adoptPet(g) {
  const m = g.m;
  if (m.pet || !m.hut || g.day < 3 || inUnder(g)) return;
  m.pet = {name: PET_NAMES[skyHash(g.seed, 91) % PET_NAMES.length], day: g.day};
  milestone(g, 'pet', 'A burrowling called ' + m.pet.name + ' moved in');
}
function traderDue(g) {
  const f = dayFrac(g);
  return g.day >= 5 && (g.day + skyHash(g.seed, 17) % 5) % 5 === 0 && f > 0.04 && f < 0.6;
}
// sets up by the homestead for most of a day, every five days
function updateTrader(g) {
  const m = g.m, t = g.trader;
  if (t) {
    if (traderDue(g)) return;
    g.trader = null;
    logEvent(g, TRADER + ' packed up and moved on');
    return;
  }
  const v = inUnder(g) ? null : villageNear(g, m.x, 60, true), at = v ? {x: villageMid(v), y: v.houses[0].feet} : m.home;
  if (!traderDue(g) || (!m.hut && !v) || inUnder(g)) return;
  let x = null, y = null; // the usual pitch may be fenced in, paved over or dug out by now
  for (const dx of [9, 15, 16, 17, 18, -14, -15, -16, -17, 19, 20, -18, -19, -20, 21, 22, 23, 24]) {
    const gy = groundAt(g, at.x + dx, at.y);
    if (gy !== null && villageFeet(g, at.x + dx) === null && isSolid(get(g, at.x + dx, gy + 1)) && get(g, at.x + dx, gy) !== T.WATER && !CROP_TILE_SET.has(get(g, at.x + dx, gy))) { x = at.x + dx; y = gy; break; }
  }
  if (x === null) return;
  const order = TRADE_POOL.map((o, i) => [skyHash(g.seed + g.day, i), o]).sort((a, b) => a[0] - b[0]).map(q => q[1]);
  g.trader = {x, y, offers: order.slice(0, 4)};
  logEvent(g, TRADER + ' the trader set up ' + (v ? 'in ' + v.name : 'by the homestead'));
  sfx(g, 'trade', m.x, m.y); // heard wherever the miner is
}
function traderJob(g) {
  const m = g.m, t = g.trader;
  if (!t || m.tradedDay === g.day || inUnder(g) || Math.abs(t.x - m.x) + Math.abs(t.y - m.y) > 150) return null;
  const good = t.offers.filter(o => cnt(m, o[0]) >= o[1] + o[2]); // no deal to be had is no reason not to drop by
  return {
    name: 'trade', label: 'Off to see what ' + TRADER + ' has', to: {x: t.x, y: t.y},
    run(g) {
      if (!g.trader) return 'done';
      if (Math.abs(m.x - t.x) <= 2 && Math.abs(m.y - t.y) <= 2) {
        m.facing = Math.sign(t.x - m.x) || m.facing;
        m.tradedDay = g.day;
        m.act = {type: 'craft', t: 0, item: null, fn: () => {
          const plot = m.farm && m.farm.plots[1];
          if (plot && cnt(m, 'potato') === 0 && emptyCells(g, plot) === PLOT_LEN) { // a pot of potatoes for the plot that's standing empty
            const pay = ['cobble', 'dirt', 'sand', 'log'].find(k => cnt(m, k) >= 6);
            if (pay) { take(m, pay, 6); add(g, 'potato', 3); g.stats.trades = (g.stats.trades || 0) + 1; logEvent(g, 'Swapped 6 ' + ITEMS[pay].toLowerCase() + ' for 3 potatoes'); }
          }
          const extras = traderExtras(g);
          if (!good.length && !extras && g.stats.milestones.some(q => q.id === 'trader')) m.thought = 'Nothing to swap today. Nice to see a face, though';
          for (const [give, n, keep, get_, out] of good) {
            if (cnt(m, give) < n + keep) continue;
            take(m, give, n); add(g, get_, out);
            g.stats.trades = (g.stats.trades || 0) + 1;
            logEvent(g, 'Swapped ' + n + ' ' + ITEMS[give].toLowerCase() + ' for ' + out + ' ' + ITEMS[get_].toLowerCase());
          }
          sfx(g, 'trade', m.x, m.y);
          milestone(g, 'trader', 'Struck a deal with ' + TRADER);
        }};
        return 'done';
      }
      const path = travel(g, t.x, t.y, 1);
      if (!path) { m.tradedDay = g.day; return 'fail'; }
      m.path = path;
      return 'run';
    }
  };
}
