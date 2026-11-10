// Burrow sim · pathfind.js — A* over the grid where digging, falling, bridging and pillaring are moves with costs.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// ---------- pathfinding ----------
const NODES = W * H;
const gS = new Float32Array(NODES), stampA = new Uint32Array(NODES), closedA = new Uint32Array(NODES), parentA = new Int32Array(NODES), moveA = new Uint8Array(NODES);
let stamp = 1;
const MOVES = ['w', 'f', 'j', 'u', 'd', 'D', 'p', 'b', 'g'];
function makeHeap() { return {k: [], f: []}; }
function hpush(h, key, f) { const K = h.k, F = h.f; let i = K.length; K.push(key); F.push(f);
  while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= f) break; K[i] = K[p]; F[i] = F[p]; i = p; } K[i] = key; F[i] = f; }
function hpop(h) { const K = h.k, F = h.f; const top = K[0]; const lk = K.pop(), lf = F.pop(); const n = K.length;
  if (n > 0) { let i = 0; while (true) { let l = 2 * i + 1, r = l + 1, s = i, sf = lf;
      if (l < n && F[l] < sf) { s = l; sf = F[l]; } if (r < n && F[r] < sf) { s = r; sf = F[r]; }
      if (s === i) break; K[i] = K[s]; F[i] = F[s]; i = s; } K[i] = lk; F[i] = lf; }
  return top; }

let pathLavaRisk = false; // last resort when boxed in: allow digging next to lava, at a heavy cost
function cellCost(g, x, y, tr, noDig) {
  if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) return INF;
  const t = g.w.t[y * W + x];
  if (passable(t)) return t === T.WATER ? 3 : 0;
  if (t === T.LAVA && pathLavaRisk && blocksAvail(g.m) > 0) return noDig ? INF : 500; // boxed in: a block goes in first, then it is dug like any other (see sealLava)
  if (!P[t].solid || noDig) return INF;
  const d = digTicks(t, tr);
  if (d === INF || (t === T.OBSIDIAN && inGateFrame(g, x, y)) || inHouse(g, x, y)) return INF;
  if (g.protect && g.protect.has(y * W + x)) return d + 120; // don't tunnel through the hut
  // never open a wall next to lava or water
  let wet = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = get(g, x + dx, y + dy); if (n === T.LAVA) { if (!pathLavaRisk) return INF; wet = 400; } else if (n === T.WATER) wet = Math.max(wet, 30); }
  if (g.w.t[(y - 1) * W + x] === T.SAND) wet += 12; // sand above will cave in
  return d + wet;
}
const solidAt = (g, x, y) => isSolid(get(g, x, y));
// rock over the miner's head it can't dig: it ducks out under it, the way it came in. Stepping down diagonally needs no more room than this, so what goes down always comes back up
const fixedRoof = (g, x, y, tr) => { const t = get(g, x, y); return isSolid(t) && digTicks(t, tr) === INF; };
// a short plank over a dip is cheap, walking out across a big drop isn't: go down and around instead (lava and ponds still get bridged)
function bridgeCost(g, x, y) {
  let gap = 1; while (gap < 8 && get(g, x, y + gap + 1) === T.AIR) gap++;
  const under = get(g, x, y + gap + 1);
  return under === T.LAVA || under === T.WATER ? 16 : 16 + Math.max(0, gap - 2) * 8;
}

// opts: goal(x,y), h(x,y), maxNodes, range, noDig, noPillar
function findPath(g, opts) {
  const m = g.m, tr = tier(m);
  const sx = m.x, sy = m.y;
  const canPillar = !opts.noPillar && !opts.noDig && blocksAvail(m) >= 3;
  const canBridge = canPillar && blocksAvail(m) - cnt(m, 'sand') >= 3; // sand can't bridge: it falls
  const hook = !opts.noPillar && cnt(m, 'grapple') > 0;
  const maxN = opts.maxNodes || 6000, range = opts.range || 70;
  const minX = Math.max(1, sx - range), maxX = Math.min(W - 2, sx + range);
  stamp++;
  const heap = makeHeap();
  const sk = sy * W + sx;
  gS[sk] = 0; stampA[sk] = stamp; parentA[sk] = -1;
  hpush(heap, sk, opts.h(sx, sy));
  let expanded = 0, best = -1, bestH = INF, ground = -1, groundH = INF;
  const noDig = !!opts.noDig;
  const maxFall = opts.maxFall || (m.hp >= 16 ? 6 : 3);
  while (heap.k.length) {
    const k = hpop(heap);
    if (closedA[k] === stamp) continue;
    closedA[k] = stamp;
    const x = k % W, y = (k / W) | 0;
    if (opts.goal(x, y)) return buildPath(k, sk);
    if (++expanded > maxN) break;
    const hv = opts.h(x, y); if (hv < bestH) { bestH = hv; best = k; }
    if (hv < groundH && solidAt(g, x, y + 1)) { groundH = hv; ground = k; } // somewhere to actually stand
    const g0 = gS[k];
    const relax = (nx, ny, c, mv) => {
      if (nx < minX || nx > maxX || ny < 2 || ny > H - 2 || c === INF) return;
      if (tr === 0 && ny > g.w.surf[nx] + 3 && ny >= sy) return; // no pickaxe yet: stay out of caves (climbing out is fine)
      const nk = ny * W + nx;
      if (closedA[nk] === stamp) return;
      const ng = g0 + c;
      if (stampA[nk] === stamp && gS[nk] <= ng) return;
      stampA[nk] = stamp; gS[nk] = ng; parentA[nk] = k; moveA[nk] = mv;
      hpush(heap, nk, ng + opts.h(nx, ny) * 1.25);
    };
    for (const d of [-1, 1]) {
      const nx = x + d;
      // walk (maybe fall)
      const cw = (kitWading(g, nx, y) ? 4 : cellCost(g, nx, y, tr, noDig)) + cellCost(g, nx, y - 1, tr, noDig); // ember treads: thin lava is walked through
      if (cw < INF) {
        if (solidAt(g, nx, y + 1)) relax(nx, y, 5 + cw, 0);
        else {
          let k2 = 1;
          while (k2 <= maxFall + 1 && passable(get(g, nx, y + k2)) && !solidAt(g, nx, y + k2 + 1)) k2++;
          if (k2 <= maxFall && passable(get(g, nx, y + k2)) && solidAt(g, nx, y + k2 + 1)) relax(nx, y + k2, 6 + cw + 2 * k2 + Math.max(0, k2 - 3) * 14, 1);
          // bridge: place a block to walk across
          if (canBridge && (get(g, nx, y + 1) === T.AIR || get(g, nx, y + 1) === T.TORCH || (pathLavaRisk && get(g, nx, y + 1) === T.LAVA))) relax(nx, y, bridgeCost(g, nx, y) + cw, 7);
          // gap jump
          if (cw === 0) {
            const jx = x + 2 * d;
            if (cellCost(g, jx, y, tr, true) === 0 && cellCost(g, jx, y - 1, tr, true) === 0 && solidAt(g, jx, y + 1)) relax(jx, y, 11, 2);
          }
        }
      }
      // step up
      if (solidAt(g, nx, y)) {
        const cu = (fixedRoof(g, x, y - 2, tr) ? 0 : cellCost(g, x, y - 2, tr, noDig)) + cellCost(g, nx, y - 1, tr, noDig) + cellCost(g, nx, y - 2, tr, noDig);
        if (cu < INF) relax(nx, y - 1, 7 + cu, 3);
      }
      // step down (dig into the floor diagonally)
      if (solidAt(g, nx, y + 1) && solidAt(g, nx, y + 2)) {
        const cd = cellCost(g, nx, y, tr, noDig) + cellCost(g, nx, y + 1, tr, noDig);
        if (cd < INF) relax(nx, y + 1, 7 + cd, 4);
      }
    }
    // dig straight down
    if (!noDig && solidAt(g, x, y + 1) && solidAt(g, x, y + 2)) {
      const c = cellCost(g, x, y + 1, tr, false);
      if (c < INF) relax(x, y + 1, 6 + c * 1.8, 5);
    }
    // pillar up
    if (canPillar) {
      const here = get(g, x, y);
      if (here === T.AIR || here === T.WATER || here === T.TORCH || DECOR.has(here)) { // in water too, or a flooded pit is a trap; a torch just comes down
        const c = cellCost(g, x, y - 2, tr, false);
        const open = !solidAt(g, x - 1, y) && !solidAt(g, x + 1, y) && !solidAt(g, x - 1, y - 1) && !solidAt(g, x + 1, y - 1); // no wall to climb beside
        let drop = 0; if (open) while (drop < 16 && !solidAt(g, x, y + drop + 1)) drop++; // each block higher above the ground costs more: a last resort, not a staircase
        if (c < INF) relax(x, y - 1, (open ? 38 + Math.max(0, drop - 2) * 30 : 14) + c, 6);
      }
    }
    // the grapple line: up its own open column to the first ledge beside it, two to six blocks up
    if (hook && solidAt(g, x, y + 1) && passable(get(g, x, y - 2))) for (const d of [-1, 1]) {
      for (let k = 2; k <= GRAPPLE_UP; k++) {
        if (!passable(get(g, x, y - k - 1))) break;
        const nx = x + d;
        if (solidAt(g, nx, y - k + 1) && passable(get(g, nx, y - k)) && passable(get(g, nx, y - k - 1))) { relax(nx, y - k, 12 + 3 * k, 8); break; }
      }
    }
  }
  // out of range of the goal: settle for the closest place to stand. The closest cell of all can be a point in mid-air, level
  // with a far-off goal, and that's a tower up to it. Only out over water, with no ground ahead, does a mid-air end make sense
  const startH = opts.h(sx, sy);
  if (opts.partial && ground >= 0 && ground !== sk && groundH < startH) return buildPath(ground, sk);
  if (opts.partial && best >= 0 && best !== sk) return buildPath(best, sk);
  return null;
}
function buildPath(k, sk) {
  const out = [];
  while (k !== sk && k >= 0) { out.push({x: k % W, y: (k / W) | 0, m: MOVES[moveA[k]]}); k = parentA[k]; }
  return out.reverse();
}
