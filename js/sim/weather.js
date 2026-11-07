// Burrow sim · weather.js — Rain and storms over the overworld, and heading indoors until they pass.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// The forecast is worked out from the seed and the clock, never g.rng, so it needs no saving and can't disturb anything else.
'use strict';

const WEATHER_SLOT = DAY / 3;
const skyHash = (seed, n) => { let h = Math.imul(seed ^ Math.imul(n + 1, 2654435761), 1274126177); h = Math.imul(h ^ h >>> 15, 2246822519); return (h ^ h >>> 13) >>> 0; };
// {type: 'clear' | 'rain' | 'storm', level: 0..1}. It fades in and out over each stretch of weather
function weatherNow(g) {
  const slot = Math.floor(g.time / WEATHER_SLOT), p = g.time / WEATHER_SLOT - slot, roll = skyHash(g.seed, slot) % 18;
  if (slot < 6 || roll > 2) return {type: 'clear', level: 0};
  return {type: roll === 0 ? 'rain' : 'storm', level: Math.min(1, Math.min(p, 1 - p) / 0.1)};
}
// a storm sends the miner home from a long way off; rain only if home is close. Underground, nobody cares
function weatherCalls(g) {
  const m = g.m, wx = weatherNow(g);
  if (wx.type === 'clear' || wx.level < 0.2 || inUnder(g) || !m.hut || (m.dryUntil || 0) > g.tick) return false;
  const spot = m.bed || m.home, d = Math.abs(m.x - spot.x) + Math.abs(m.y - spot.y);
  return d <= (wx.type === 'storm' ? 140 : 30) && (d <= 4 || m.y - g.w.top[m.x] <= 3);
}
function shelterJob(g) {
  const m = g.m, spot = m.bed || m.home, storm = weatherNow(g).type === 'storm';
  return {
    name: 'shelter', label: storm ? 'Running home from the storm' : 'Heading in out of the rain', to: {x: spot.x, y: spot.y},
    run(g) {
      const wx = weatherNow(g);
      if (wx.type === 'clear' || wx.level < 0.2) return 'done';
      if (Math.abs(m.x - spot.x) <= 1 && Math.abs(m.y - spot.y) <= 1) {
        if (!g.stats.dayWet) g.stats.wetDays = (g.stats.wetDays || 0) + 1;
        g.stats.dayWet = wx.type === 'storm' || g.stats.dayWet === 'storm' ? 'storm' : 'rain';
        if (wx.type === 'storm') milestone(g, 'storm', 'Waited out a storm');
        m.act = {type: 'wait', t: 0, dur: 40};
        return 'run';
      }
      const path = travel(g, spot.x, spot.y, 1);
      if (!path) { m.dryUntil = g.tick + WEATHER_SLOT; return 'fail'; } // can't get home: stay wet
      m.path = path;
      return 'run';
    }
  };
}
