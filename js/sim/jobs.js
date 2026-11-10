// Burrow sim · jobs.js — Jobs the miner can run (collect, strip mine, hunt, travel, craft) and the crafting planner.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// ---------- jobs ----------
function bodyHas(m, x, y) { return x === m.x && (y === m.y || y === m.y - 1); }
function inReach(m, x, y) { return Math.abs(x - m.x) <= 2 && y >= m.y - 3 && y <= m.y + 1 && (Math.abs(x - m.x) <= 1 || (y >= m.y - 2 && y <= m.y)); }
function reachGoal(targets) {
  // goal: some target within reach of (x,y)
  return (x, y) => { for (const t of targets) if (Math.abs(t.x - x) <= 2 && t.y >= y - 3 && t.y <= y + 1 && (Math.abs(t.x - x) <= 1 || (t.y >= y - 2 && t.y <= y))) return true; return false; };
}
function nearestH(targets) {
  return (x, y) => { let b = INF; for (const t of targets) { const d = Math.max(0, Math.abs(t.x - x) - 1) * 5 + Math.max(0, Math.abs(t.y - (y - 1)) - 1) * 6; if (d < b) b = d; } return b; };
}
function blacklisted(g, k) { const u = g.black.get(k); return u && u > g.tick; }
function blacklist(g, k, dur) { g.black.set(k, g.tick + (dur || 2400)); }

// Collect tiles of given types
// seen ore of this kind touching ore mined in the last little while: the rest of the vein
function veinRest(g, ore) {
  const m = g.m, out = [], got = new Set();
  for (const v of m.veinLog || []) {
    if (v.t !== ore || g.tick - v.at > 3000) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = v.x + dx, y = v.y + dy, k = y * W + x;
      if (got.has(k) || g.w.t[k] !== ore || !g.seen[k] || blacklisted(g, k)) continue;
      got.add(k); out.push({x, y, d: Math.abs(x - m.x) + Math.abs(y - m.y)});
    }
  }
  return out.sort((a, b) => a.d - b.d);
}
function collectJob(g, item, n, tiles, label, opts) {
  opts = opts || {};
  return {
    name: 'collect', label, item,
    run(g) {
      const m = g.m;
      // got enough: with ore, finish off the vein it's in before moving on (up to a pack's worth extra)
      let vein = null;
      if (cnt(m, item) >= n) {
        if (!opts.vein || cnt(m, item) >= n + 32) return 'done';
        vein = veinRest(g, tiles[0]);
        if (!vein.length) return 'done';
        m.thought = 'Mining out the rest of this ' + P[tiles[0]].name.replace(' ore', '') + ' vein';
      }
      // if a target is within reach right now, work it
      const tr = tier(m);
      let best = null, bd = INF;
      for (let dy = -3; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = m.x + dx, y = m.y + dy;
        if (!tiles.includes(get(g, x, y)) || !inReach(m, x, y)) continue;
        if (vein && !vein.some(c => c.x === x && c.y === y)) continue;
        if (opts.needSeen && !g.seen[y * W + x]) continue;
        if (dy === 1 && dx === 0 && !solidAt(g, x, m.y + 2)) { // digging the floor over a drop: only a short, safe one
          let d = 2; while (d <= 5 && passable(get(g, x, m.y + d)) && get(g, x, m.y + d) !== T.LAVA) d++;
          if (d > 4 || !solidAt(g, x, m.y + d) || get(g, x, m.y + d - 1) === T.LAVA) continue;
        }
        if (cellCost(g, x, y, tr, false) === INF && isSolid(get(g, x, y))) continue;
        const d = Math.abs(dx) + Math.abs(dy) + (dy === 1 ? 2 : 0);
        if (d < bd) { bd = d; best = {x, y}; }
      }
      if (best) {
        const t = get(g, best.x, best.y);
        const need = isSolid(t) ? gritDig(m, digTicks(t, tr)) : Math.ceil(P[t].base * 1.6 / (1 + tr * 0.4));
        m.facing = Math.sign(best.x - m.x) || m.facing;
        m.act = {type: 'dig', x: best.x, y: best.y, t: 0, need};
        return 'run';
      }
      // find targets
      const targets = (vein || opts.find(g)).filter(t => {
        if (!isSolid(get(g, t.x, t.y)) || cellCost(g, t.x, t.y, tr, false) < INF) return true;
        blacklist(g, t.y * W + t.x, 8000); return false;
      });
      if (!targets.length) return vein ? 'done' : opts.fallback ? opts.fallback(g) : 'fail';
      const path = findPath(g, {goal: reachGoal(targets), h: nearestH(targets), maxNodes: opts.maxNodes || 9000, range: 90});
      if (!path && vein) { for (const t of targets) blacklist(g, t.y * W + t.x, 1800); return 'done'; }
      if (!path) { for (const t of targets) blacklist(g, t.y * W + t.x, 1800); return 'fail'; }
      if (!path.length) { for (const t of targets) if (Math.abs(t.x - m.x) <= 2 && Math.abs(t.y - m.y) <= 3) blacklist(g, t.y * W + t.x, 3000); return vein ? 'done' : 'fail'; }
      m.path = path;
      if (m.thought.startsWith('Looking around')) m.thought = describe(g);
      return 'run';
    }
  };
}
function scanTiles(g, tiles, rx, ry, filter) {
  const m = g.m, out = [];
  for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
    const x = m.x + dx, y = m.y + dy;
    if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
    if (!tiles.includes(g.w.t[y * W + x])) continue;
    if (blacklisted(g, y * W + x) || (g.protect && g.protect.has(y * W + x)) || inHouse(g, x, y)) continue;
    if (filter && !filter(x, y)) continue;
    out.push({x, y, d: Math.abs(dx) + Math.abs(dy) * 1.5});
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, 12);
}

function atSurface(g, x, y) { return skyAt(g, x, y - 1) && y <= g.w.surf[x] + 4; } // open sky AND near real ground level (not the bottom of a pit)
function surfaceFirst(g, why) {
  // walk back to daylight if far underground
  const m = g.m;
  if (atSurface(g, m.x, m.y) || m.y <= g.w.top[m.x] + 1) return null;
  return {
    name: 'surface', label: 'Heading up to the surface ' + why,
    run(g) {
      if (atSurface(g, m.x, m.y)) return 'done';
      const path = findPath(g, {goal: (x, y) => atSurface(g, x, y), h: (x, y) => Math.max(0, y - g.w.surf[x]) * 6, maxNodes: 20000, range: 60, partial: true});
      if (!path || !path.length) return 'fail';
      m.path = path; return 'done';
    }
  };
}

function gatherJob(g, item, n) {
  const m = g.m;
  if (item === 'log' || item === 'leaf') {
    const tiles = item === 'log' ? [T.LOG] : [T.LEAVES, T.PINE];
    const s = surfaceFirst(g, item === 'log' ? 'for wood' : 'for leaves'); if (s) return s;
    return collectJob(g, item, n, tiles, item === 'log' ? 'Chopping wood' : 'Gathering leaves', {
      find: g => {
        const list = scanTiles(g, tiles, 45, 14, (x, y) => y <= g.w.surf[x] + 1); // real trees, not mineshaft beams
        if (item === 'log') list.sort((a, b) => (a.d - b.d) - (a.y - b.y) * 0.5);
        return list;
      },
      fallback: g => exploreSurface(g, 'trees')
    });
  }
  if (item === 'apple') {
    const s = surfaceFirst(g, 'for apples'); if (s) return s;
    return collectJob(g, 'apple', n, [T.LEAVES, T.PINE], 'Shaking trees for apples', {find: g => scanTiles(g, [T.LEAVES, T.PINE], 45, 14), fallback: g => exploreSurface(g, 'trees')});
  }
  if (item === 'berries') {
    const s = surfaceFirst(g, 'for berries'); if (s) return s;
    return collectJob(g, 'berries', n, [T.BUSH], 'Picking berries', {find: g => scanTiles(g, [T.BUSH], 60, 12), fallback: g => exploreSurface(g, 'berry bushes')});
  }
  if (item === 'dirt' || item === 'sand') {
    const tiles = item === 'dirt' ? [T.DIRT, T.GRASS, T.SNOW] : [T.SAND];
    return collectJob(g, item, n, tiles, 'Digging ' + item, {find: g => scanTiles(g, tiles, 14, 8)});
  }
  if (item === 'cobble') {
    const tiles = inUnder(g) ? [T.ASHROCK, T.SHARDROCK] : tier(m) >= 2 ? [T.STONE, T.MOSSY, T.DEEP] : [T.STONE, T.MOSSY];
    return collectJob(g, item, n, tiles, 'Quarrying stone', {
      find: g => scanTiles(g, tiles, 12, 12, (x, y) => !skyAt(g, x, y - 3) || y > g.w.top[x]),
      fallback: g => { m.path = findPath(g, {goal: (x, y) => y >= m.y + 3, h: (x, y) => Math.max(0, m.y + 3 - y) * 6, maxNodes: 3000}) || []; return m.path.length ? 'run' : 'fail'; }
    });
  }
  if (item === 'raw_meat') return huntJob(g);
  if (item === 'raw_fish') return cnt(m, 'fishing_rod') > 0 ? fishJob(g, n, 'Fishing') : need(g, 'fishing_rod', 1, []);
  if ((item === 'raw_cinderite' || item === 'glimmer') && !inUnder(g) && m.journey && !campGate(g)) return null;
  if ((item === 'raw_cinderite' || item === 'glimmer') && !inUnder(g)) return tripJob(g, item === 'glimmer' ? 0 : n, []);
  const ore = RAW_SOURCE[item];
  if (ore !== undefined) {
    const need = P[ore].tier;
    if (tier(m) < need) return null;
    return collectJob(g, item, n, [ore], 'Mining ' + P[ore].name, {
      needSeen: true, maxNodes: 14000, vein: true,
      find: g => {
        const out = [];
        for (const k of g.known) {
          const x = k % W, y = (k / W) | 0;
          if (g.w.t[k] !== ore) { if (!ORE_TILES.includes(g.w.t[k])) g.known.delete(k); continue; } // other ores stay remembered
          if (blacklisted(g, k) || !inCampRange(g, x)) continue;
          const d = Math.abs(x - m.x) + Math.abs(y - m.y) * 1.2;
          if (d < 80) out.push({x, y, d});
        }
        out.sort((a, b) => a.d - b.d);
        return out.slice(0, 10);
      },
      fallback: g => { m.job = stripJob(g, item); return 'run'; }
    });
  }
  return null;
}
function exploreSurface(g, what) {
  const m = g.m;
  // keep heading the same way until the world edge or a dead end, so it actually covers new ground
  if (!m.exploreDir) m.exploreDir = g.rng() < 0.5 ? -1 : 1;
  const dir = m.exploreDir;
  const tx = clamp(m.x + dir * 30, 3, W - 4);
  const path = Math.abs(tx - m.x) < 4 ? null : findPath(g, {goal: (x, y) => Math.abs(x - tx) <= 1 && skyAt(g, x, y - 1), h: (x, y) => Math.abs(x - tx) * 5, maxNodes: 8000, range: 40, partial: true});
  if (!path || !path.length || Math.abs(path[path.length - 1].x - m.x) < 3) {
    m.exploreDir = -dir; m.exploreFails = (m.exploreFails || 0) + 1;
    // boxed in both ways: grab some dirt so it can bridge gaps and climb out
    if (m.exploreFails >= 2 && blocksAvail(m) < 8) { m.exploreFails = 0; m.job = gatherJob(g, 'dirt', cnt(m, 'dirt') + 12); m.chain = ['Grab dirt to build with']; return 'run'; }
    return 'fail';
  }
  // stop each leg on open surface: ending in a pit makes the next think head back up, then down again, forever
  let end = -1;
  for (let i = 0; i < path.length; i++) if (atSurface(g, path[i].x, path[i].y)) { end = i; if (i >= 4) break; }
  if (end < 0 || Math.abs(path[end].x - m.x) < 2) { m.exploreDir = -dir; m.exploreFails = (m.exploreFails || 0) + 1; return 'fail'; }
  m.exploreFails = 0;
  m.path = path.slice(0, end + 1); m.thought = 'Looking around for ' + what; // short legs, so it keeps looking as it walks
  return 'run';
}
function stripJob(g, item) {
  const m = g.m;
  const band = STRIP_BAND[item] || [70, 100];
  const under = (x, y) => y >= g.w.surf[x] + 3; // a strip mine is a tunnel: never a row of sky over a valley
  let tries = 0;
  return {
    name: 'strip', label: 'Strip mining for ' + ITEMS[item].toLowerCase(), item,
    run(g) {
      // already breaking out of a lava pocket: see it through, whatever got in the way of the last try
      const going = m.strip && m.strip.item === item && m.strip.escape;
      if (going) {
        const clear = Math.abs(m.x - going.x) + Math.abs(m.y - going.y) >= 30;
        if (!clear && ++going.tries <= 40 && unstick(g, m.strip)) return 'run';
        m.strip.escape = null;
      }
      // stop as soon as we know where some is
      const ore = RAW_SOURCE[item];
      for (const k of g.known) if (g.w.t[k] === ore && !blacklisted(g, k)) {
        const x = k % W, y = (k / W) | 0;
        if (!inCampRange(g, x)) continue;
        if (cellCost(g, x, y, tier(m), false) === INF) { blacklist(g, k, 8000); continue; }
        if (Math.abs(x - m.x) + Math.abs(y - m.y) < 70) return 'done';
      }
      if (++tries > 6) return 'done';
      let st = m.strip;
      if (!st || st.item !== item) {
        const y0 = clamp(m.y, band[0], band[1]);
        st = m.strip = {item, y: y0, minX: m.x, maxX: m.x, fails: 0};
      }
      if (!st.home || Math.abs(m.x - st.home.x) + Math.abs(m.y - st.home.y) > 16) st.home = {x: m.x, y: m.y, t: g.tick};
      // a wider pocket can pace further than that, but it never reaches new ground
      let seen = st.been;
      if (!seen || seen.x1 - seen.x0 > 70) seen = st.been = {x0: m.x, x1: m.x, y0: m.y, y1: m.y, t: g.tick};
      if (m.x < seen.x0 || m.x > seen.x1 || m.y < seen.y0 || m.y > seen.y1) { seen.x0 = Math.min(seen.x0, m.x); seen.x1 = Math.max(seen.x1, m.x); seen.y0 = Math.min(seen.y0, m.y); seen.y1 = Math.max(seen.y1, m.y); seen.t = g.tick; }
      if (g.tick - seen.t > 2400) { st.home.t = 0; seen.t = g.tick; }
      if (g.tick - st.home.t > 1800 && unstick(g, st)) return 'run';
      let depth = Math.max(st.y, g.w.surf[m.x] + 3);
      while (depth > 60 && (get(g, m.x, depth) === T.LAVA || get(g, m.x, depth - 1) === T.LAVA)) depth -= 2;
      // every row here is mined out (or walled by the world edge): head sideways to unseen rock
      // instead of climbing between the same rows forever
      if (st.swaps >= 2) {
        // pick the row in the band and the side with the most unseen rock
        const unseen = (y, d) => { let n = 0; for (let k = 6; k <= 250; k++) { const xx = m.x + d * k; if (xx < 4 || xx >= W - 4) break; if (!g.seen[y * W + xx]) n++; } return n; };
        const opts = [];
        st.tried = st.tried || [];
        for (let y = band[0]; y <= band[1]; y++) for (const d of [1, -1]) {
          const key = y + ':' + d + ':' + Math.round(m.x / 16); // don't retry a move that led nowhere
          const n = st.tried.includes(key) ? 0 : unseen(y, d); if (n) opts.push({y, d, n, key});
        }
        opts.sort((a, b) => b.n - a.n);
        st.swaps = 0;
        for (const o of opts.slice(0, 4)) {
          let tx = m.x + o.d * 6;
          while (tx > 4 && tx < W - 5 && g.seen[o.y * W + tx]) tx += o.d;
          if (!under(tx, o.y) || !inCampRange(g, tx)) continue;
          const path = travel(g, tx, o.y, 2);
          if (path) { st.tried.push(o.key); if (st.tried.length > 30) st.tried.shift(); m.path = path; m.stripDir = o.d; st.y = o.y; st.minX = st.maxX = path[path.length - 1].x; return 'run'; }
        }
      }
      if (Math.abs(m.y - depth) > 1) {
        const path = findPath(g, {goal: (x, y) => Math.abs(y - depth) <= 1 && under(x, y), h: (x, y) => Math.abs(y - depth) * 6, maxNodes: 14000, range: 40, partial: true});
        if (path && path.length) { m.path = path; st.minX = st.maxX = path[path.length - 1].x; return 'run'; }
        st.y = nextRow(st.y, band); st.fails = 0;
        return 'fail';
      }
      // tunnel toward unseen rock along this row
      const yy = st.y, dir = m.stripDir, x0 = m.x;
      const V = 6;
      const fresh = V & 1 ? (x, y) => { let n = 0; for (let k = 2; k <= 8; k++) { const xx = x + dir * k; if (xx < 2 || xx >= W - 2) return false; for (let dy = -3; dy <= 2; dy++) if (!g.seen[(y + dy) * W + xx]) n++; } return n >= 10; }
        : (x, y) => { let n = 0; for (let k = 1; k <= 7; k++) { const xx = x + dir * k; if (xx < 2 || xx >= W - 2) return false; if (!g.seen[y * W + xx]) n++; } return n >= 4; };
      { const s = Math.abs(m.y - yy) <= 1 && chargeSpot(g, dir); if (s) { throwCharge(g, s); return 'run'; } } // solid rock ahead and a charge in the pack: blow it open
      // a search from this spot that found nothing a little while ago won't find anything now: near lava each try is a big one
      const deadKey = yy + ':' + dir + ':' + Math.round(x0 / 3) + ':' + m.y, dead = m.stripDead = m.stripDead || {}; // kept on the miner: heading back to camp starts a fresh strip
      // and a quick look first: with no unseen rock along this row in range there's nothing for the search to find
      let any = false;
      for (let k = 2; k <= 90 && !any; k++) { const x = x0 + dir * k; if (x < 2 || x >= W - 2) break; if (!inCampRange(g, x)) continue; for (let y = yy - 2; y <= yy + 2 && !any; y++) if (Math.abs(y - yy) <= (V & 1 ? 2 : 1) && fresh(x, y)) any = true; }
      if (!any) dead[deadKey] = g.tick + 1500;
      const path = dead[deadKey] > g.tick ? null : findPath(g, {goal: (x, y) => Math.abs(y - yy) <= (V & 1 ? 2 : 1) && dir * (x - x0) >= 2 && under(x, y) && inCampRange(g, x) && fresh(x, y), h: (x, y) => Math.max(0, 60 - dir * (x - x0)) * 0.5 + Math.abs(y - yy) * 6, maxNodes: 12000, range: 90, noPillar: !(V & 2)});
      if (!path && !(dead[deadKey] > g.tick)) { dead[deadKey] = g.tick + 1500; const ks = Object.keys(dead); if (ks.length > 40) for (const k of ks) if (dead[k] <= g.tick) delete dead[k]; }
      if (path && path.length) {
        // only count it as progress if it reaches past what this row has already covered;
        // otherwise it can pace between two dead ends (rock left unseen behind lava or water)
        const ex = path[path.length - 1].x, further = dir > 0 ? ex > st.maxX : ex < st.minX;
        st.minX = Math.min(st.minX, ex); st.maxX = Math.max(st.maxX, ex);
        if (further) { m.path = path; st.fails = 0; st.swaps = 0; st.tried = []; return 'run'; }
        if (st.fails < 2) { m.path = path; st.fails++; return 'run'; }
      }
      m.stripDir = -dir; st.fails++;
      if (st.fails >= 3) { st.y = nextRow(st.y, band); st.fails = 0; st.swaps = (st.swaps || 0) + 1; st.minX = st.maxX = m.x; }
      return 'run';
    }
  };
}
// a minute and a half of strip mining without getting anywhere: it's stranded (out of blocks at the
// end of its own bridge, walled in by lava). Break what's in reach for blocks, then leave the area.
function unstick(g, st) {
  const m = g.m, tr = tier(m), a = st.escape || st.home;
  m.thought = 'Stuck here. Looking for a way out';
  if (blocksAvail(m) < 6) {
    // needs blocks to get out with. Rock that touches lava is the last choice, but it's better than none: the first block walls off the next
    for (const risk of [false, true]) {
      let best = null, bd = INF;
      pathLavaRisk = risk;
      for (let dy = -3; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = m.x + dx, y = m.y + dy;
        if ((dx === 0 && dy === 1) || !inReach(m, x, y) || !isSolid(get(g, x, y)) || cellCost(g, x, y, tr, false) === INF) continue;
        if (digTicks(get(g, x, y), tr) === INF) continue;
        const d = Math.abs(dx) + Math.abs(dy); if (d < bd) { bd = d; best = {x, y}; }
      }
      pathLavaRisk = false;
      if (best) {
        if (risk) sealLava(g, [[best.x, best.y]]);
        m.facing = Math.sign(best.x - m.x) || m.facing;
        m.act = {type: 'dig', x: best.x, y: best.y, t: 0, need: gritDig(m, digTicks(get(g, best.x, best.y), tr))};
        return true;
      }
    }
    if (blocksAvail(m) < 3) { // none in reach out here in the open: over to the nearest wall
      const rock = (x, y) => isSolid(get(g, x, y)) && digTicks(get(g, x, y), tr) !== INF;
      const walk = findPath(g, {noDig: true, goal: (x, y) => rock(x - 1, y) || rock(x + 1, y) || rock(x - 1, y - 1) || rock(x + 1, y - 1), h: () => 0, maxNodes: 3000, range: 40});
      if (walk && walk.length) { m.path = walk; return true; }
    }
  }
  const away = (x, y) => Math.abs(x - a.x) + Math.abs(y - a.y);
  const leave = {goal: (x, y) => away(x, y) >= 30, h: (x, y) => Math.max(0, 30 - away(x, y)) * 5, maxNodes: 20000, range: 90, maxFall: 3 + Math.floor(Math.max(0, m.hp - 5) / 2)};
  let path = findPath(g, leave);
  if (!path || !path.length) { // every way out touches lava: risk it rather than pace about in there for good
    pathLavaRisk = true;
    try { path = findPath(g, leave); } finally { pathLavaRisk = false; }
    if (path) for (const n of path) n.risk = true; // the step checks need to know this path accepted the risk
    if (path && path.length) { m.thought = 'Lava all round. Have to risk it'; st.escape = st.escape || {x: a.x, y: a.y, tries: 0}; }
  }
  st.home.t = g.tick; // give that a chance before calling it stuck again
  if (!path || !path.length) return false;
  m.path = path; st.fails = 0; st.swaps = 0; st.tried = []; st.minX = st.maxX = path[path.length - 1].x;
  return true;
}
function nextRow(y, band) {
  let ny = y + 5;
  if (ny > band[1]) ny = band[0] + ((ny - band[0]) % 5);
  return ny;
}
function huntJob(g) {
  const m = g.m;
  return {
    name: 'hunt', label: 'Hunting pudgeons',
    run(g) {
      let best = null, bd = INF;
      for (const c of g.critters) { const d = Math.abs(c.x - m.x) + Math.abs(c.y - m.y) * 2; if (d < bd) { bd = d; best = c; } }
      if (!best || bd > 120) { const s = surfaceFirst(g, 'to hunt pudgeons'); if (s) { m.job = s; return 'run'; } return exploreSurface(g, 'pudgeons'); }
      if (Math.abs(best.x - m.x) <= 1 && Math.abs(best.y - m.y) <= 1) {
        m.facing = Math.sign(best.x - m.x) || m.facing;
        m.act = {type: 'swing', t: 0, target: best, critter: true};
        return cnt(m, 'raw_meat') >= 3 ? 'done' : 'run';
      }
      const tx = best.x, ty = best.y;
      const path = findPath(g, {goal: (x, y) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1, h: (x, y) => Math.abs(x - tx) * 5 + Math.abs(y - ty) * 5, maxNodes: 6000, range: 100});
      if (!path) return 'fail';
      m.path = path.slice(0, 6);
      if (m.thought.startsWith('Looking around')) m.thought = describe(g);
      return 'run';
    }
  };
}
function stationNear(g, type, r) {
  const m = g.m, tiles = STATION_TILES[type];
  m.stations = m.stations.filter(s => get(g, s.x, s.y) === s.t);
  let best = null, bd = INF;
  for (const s of m.stations) if (tiles.includes(s.t)) {
    const d = Math.abs(s.x - m.x) + Math.abs(s.y - m.y);
    if (d < bd && (r > 4 || canUse(g, s))) { bd = d; best = s; }
  }
  return best && bd <= r ? best : null;
}
// close enough to work at means nothing solid between the miner (feet or head) and the station
function canUse(g, s) { const m = g.m; return clearLine(g, m.x, m.y, s.x, s.y) || clearLine(g, m.x, m.y - 1, s.x, s.y); }
function placeSpot(g) {
  const m = g.m;
  for (const dx of [1, -1, 2, -2]) {
    const x = m.x + dx * m.facing, y = m.y;
    const t = get(g, x, y);
    if (Math.abs(dx) === 2 && solidAt(g, m.x + Math.sign(dx) * m.facing, y)) continue; // not into a pocket behind a wall
    if ((t === T.AIR || DECOR.has(t)) && solidAt(g, x, y + 1)) return {x, y};
  }
  return null;
}
const WALL_ROCK = new Set([T.DIRT, T.STONE, T.DEEP, T.SANDSTONE, T.COBBLE, T.ASHROCK, T.SHARDROCK]);
// no bit of open floor to be had (a lava cave, a flooded one): set it into the plain rock beside the miner instead
function wallSpot(g) {
  const m = g.m;
  for (const y of [m.y, m.y - 1]) for (const dx of [m.facing, -m.facing]) if (WALL_ROCK.has(get(g, m.x + dx, y)) && !(g.protect && g.protect.has(y * W + m.x + dx))) return {x: m.x + dx, y};
  return null;
}
function placeStationJob(g, type) {
  const m = g.m;
  return {
    name: 'place', label: 'Setting down a ' + ITEMS[type].toLowerCase(),
    run(g) {
      if (cnt(m, type) <= 0) return 'done';
      const s = placeSpot(g);
      if (!s) {
        const p = findPath(g, {goal: (x, y) => x !== m.x && solidAt(g, x + 1, y + 1) && get(g, x + 1, y) === T.AIR, h: () => 0, maxNodes: 400, noDig: true});
        if (p && p.length) { m.path = p; return 'run'; }
      }
      const spot = s || wallSpot(g);
      if (!spot) return 'fail';
      const tile = type === 'bench' ? T.BENCH : T.FURNACE;
      m.act = {type: 'place', t: 0, fn: () => {
        if (cnt(m, type) <= 0) return;
        take(m, type, 1); setTile(g, spot.x, spot.y, tile); m.stations.push({x: spot.x, y: spot.y, t: tile});
        milestone(g, 'place_' + type, type === 'bench' ? 'Set up a workbench' : 'Built a furnace');
      }};
      return 'done';
    }
  };
}
// long trips: path toward the target, accepting a partial path that makes real progress
function travel(g, tx, ty, near) {
  const m = g.m;
  const d0 = Math.abs(m.x - tx) + Math.abs(m.y - ty);
  const p = findPath(g, {goal: (x, y) => Math.abs(x - tx) <= near && Math.abs(y - ty) <= near, h: (x, y) => Math.abs(x - tx) * 5 + Math.abs(y - ty) * 5, maxNodes: 14000, range: 70, partial: true});
  if (!p || !p.length) return null;
  const e = p[p.length - 1];
  if (Math.abs(e.x - tx) + Math.abs(e.y - ty) >= d0 - 2 && !(Math.abs(e.x - tx) <= near && Math.abs(e.y - ty) <= near)) return null;
  return p;
}
function gotoJob(g, label, tx, ty, near) {
  const m = g.m;
  return {
    name: 'goto', label, to: {x: tx, y: ty},
    run(g) {
      if (Math.abs(m.x - tx) <= near && Math.abs(m.y - ty) <= near) return 'done';
      const path = travel(g, tx, ty, near) || riskyTravel(g, tx, ty, near);
      if (!path) return 'fail';
      m.path = path; return 'run';
    }
  };
}
// a pocket it fell into can have no way out that doesn't touch lava: risk that rather than pace about down there for good
function riskyTravel(g, tx, ty, near) {
  pathLavaRisk = true;
  let p = null;
  try { p = travel(g, tx, ty, near); } finally { pathLavaRisk = false; }
  if (p) for (const n of p) n.risk = true; // the step checks need to know this path accepted the risk
  return p;
}
function craftJob(g, item, times) {
  const m = g.m;
  let done = 0;
  return {
    name: 'craft', label: 'Crafting ' + ITEMS[item].toLowerCase(),
    run(g) {
      if (done >= times) return 'done';
      const R = RECIPES[item];
      for (const k in R.in) if (cnt(m, k) < R.in[k]) return 'done';
      if (R.st && !stationNear(g, R.st, 4)) return 'done';
      m.act = {type: 'craft', t: 0, item, fast: R.st === 'furnace' && !!stationNear(g, 'fastSmelt', 4)};
      done++;
      return 'run';
    }
  };
}

// planner: returns a job that makes progress towards having n of item
function need(g, item, n, chain) {
  const m = g.m;
  if (cnt(m, item) >= n) return null;
  chain.push((n - cnt(m, item)) + ' × ' + ITEMS[item]);
  const R = RECIPES[item];
  if (!R) {
    const ore = RAW_SOURCE[item];
    if (ore !== undefined && tier(m) < P[ore].tier) return needTool(g, P[ore].tier, chain);
    return gatherJob(g, item, n);
  }
  const crafts = Math.ceil((n - cnt(m, item)) / R.out);
  for (const k in R.in) {
    const j = need(g, k, R.in[k] * crafts, chain);
    if (j) return j;
  }
  if (R.st) {
    const s = stationNear(g, R.st, 4);
    if (!s) {
      const far = stationNear(g, R.st, 30);
      if (far) return gotoJob(g, 'Walking to the ' + ITEMS[R.st].toLowerCase(), far.x, far.y, canUse(g, far) ? 2 : 1);
      if (cnt(m, R.st) > 0) return placeStationJob(g, R.st);
      return need(g, R.st, 1, chain);
    }
  }
  return craftJob(g, item, crafts);
}
function needTool(g, tr, chain) {
  for (let t = tr; t <= 4; t++) if (tier(g.m) >= t) return null;
  return need(g, PICK_FOR_TIER[tr], 1, chain);
}

// ----- progression -----
