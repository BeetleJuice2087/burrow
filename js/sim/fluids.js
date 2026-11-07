// Burrow sim · fluids.js — falling sand, flowing water and lava with levels, springs, and obsidian.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// Each water/lava tile holds a level 1..8 in w.lv (8 = full). Volume is conserved, so a pond that
// drains into a cave spreads thinner rather than flooding forever. Only "awake" cells are updated.
const isLiquid = t => t === T.WATER || t === T.LAVA;
const FLOW_INTO = t => t === T.AIR || DECOR.has(t) || t === T.TORCH;

function initFluids(w) {
  w.lv = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) if (isLiquid(w.t[k])) w.lv[k] = 8;
}
function wake(g, x, y) {
  if (!g.fluid) return;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
    const k = yy * W + xx, t = g.w.t[k];
    if (isLiquid(t)) (t === T.WATER ? g.fluid.water : g.fluid.lava).add(k);
    else if (t === T.SAND) g.fluid.sand.add(k);
  }
}
function setLiquid(g, k, t, lv) {
  const x = k % W, y = (k / W) | 0;
  if (lv <= 0) { setTile(g, x, y, T.AIR); return; }
  if (g.w.t[k] !== t) setTile(g, x, y, t);
  g.w.lv[k] = lv; g.dirty.push(k); wake(g, x, y);
}
function minerBody(g, x, y) {
  const m = g.m; if (m.dead) return false;
  if (x === m.x && (y === m.y || y === m.y - 1)) return true;
  const a = m.act; // also keep clear the cells it is stepping into
  if (a && a.type === 'step') { const n = a.n; if (x === n.x && y <= n.y && y >= n.y - 2) return true; if (n.m === 'u' && x === m.x && y === m.y - 2) return true; }
  return false;
}

function flowCell(g, k, t) {
  const w = g.w;
  if (w.t[k] !== t) return;
  let lv = w.lv[k] || 8;
  const x = k % W, y = (k / W) | 0;
  const other = t === T.WATER ? T.LAVA : T.WATER;
  // water meeting lava: the lava hardens
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy, nk = ny * W + nx;
    if (nx < 0 || nx >= W || ny < 0 || ny >= H || w.t[nk] !== other) continue;
    const lavaK = t === T.LAVA ? k : nk, lavaLv = w.lv[lavaK] || 8;
    if (minerBody(g, lavaK % W, (lavaK / W) | 0)) continue; // never hardens round the miner's feet: it waits for it to get out
    setTile(g, lavaK % W, (lavaK / W) | 0, lavaLv >= 6 ? T.OBSIDIAN : T.STONE);
    sfx(g, 'sizzle', lavaK % W, (lavaK / W) | 0);
    g.fx.push({type: 'steam', x: lavaK % W, y: (lavaK / W) | 0, life: 30});
    if (lavaK === k) return;
  }
  // fall
  if (y + 1 < H - 1) {
    const bk = k + W, bt = w.t[bk];
    if (FLOW_INTO(bt)) { setLiquid(g, bk, t, lv); setTile(g, x, y, T.AIR); return; }
    if (bt === t && w.lv[bk] < 8) {
      const m = Math.min(lv, 8 - w.lv[bk]);
      setLiquid(g, bk, t, w.lv[bk] + m); lv -= m; setLiquid(g, k, t, lv);
      if (lv <= 0) return;
    }
  }
  // spread sideways (lava is thick and stops sooner)
  const need = t === T.LAVA ? 3 : 2;
  const dirs = g.rng() < 0.5 ? [-1, 1] : [1, -1];
  for (const d of dirs) {
    const nx = x + d; if (nx < 1 || nx >= W - 1) continue;
    const nk = k + d, nt = w.t[nk];
    const nlv = nt === t ? w.lv[nk] : FLOW_INTO(nt) ? 0 : -1;
    if (nlv < 0 || lv - nlv < need) continue;
    setLiquid(g, nk, t, nlv + 1); lv -= 1; setLiquid(g, k, t, lv);
    if (lv <= 0) return;
  }
}
function fallSand(g, k) {
  const w = g.w;
  if (w.t[k] !== T.SAND) return;
  const x = k % W, y = (k / W) | 0;
  if (y + 1 >= H - 1) return;
  const bk = k + W, bt = w.t[bk];
  if (minerBody(g, x, y + 1)) { g.fluid.sand.add(k); return; } // wait; never bury the miner
  if (FLOW_INTO(bt)) { setTile(g, x, y + 1, T.SAND); setTile(g, x, y, T.AIR); }
  else if (isLiquid(bt)) { const lv = w.lv[bk]; setTile(g, x, y + 1, T.SAND); setLiquid(g, k, bt, lv); }
}
function updateFluids(g) {
  const f = g.fluid;
  if (g.tick % 3 === 0 && f.sand.size) { const list = [...f.sand]; f.sand.clear(); list.sort((a, b) => b - a); for (const k of list) fallSand(g, k); }
  if (g.tick % 3 === 1 && f.water.size) { const list = [...f.water].slice(0, 3000); for (const k of list) f.water.delete(k); list.sort((a, b) => b - a); for (const k of list) flowCell(g, k, T.WATER); }
  if (g.tick % 12 === 2 && f.lava.size) { const list = [...f.lava].slice(0, 2000); for (const k of list) f.lava.delete(k); list.sort((a, b) => b - a); for (const k of list) flowCell(g, k, T.LAVA); }
  // springs: a ceiling leak pours a limited amount, making a waterfall or lava fall
  for (const s of g.w.springs) {
    if (s.left <= 0 || g.tick % s.every !== 0) continue;
    if (!isSolid(get(g, s.x, s.y))) { s.left = 0; continue; }
    const bk = (s.y + 1) * W + s.x, bt = g.w.t[bk];
    if (FLOW_INTO(bt)) { setLiquid(g, bk, s.t, 2); s.left -= 2; }
    else if (bt === s.t && g.w.lv[bk] < 8) { setLiquid(g, bk, s.t, Math.min(8, g.w.lv[bk] + 2)); s.left -= 2; }
  }
}
function makeSprings(w, r) {
  w.springs = [];
  const tryAdd = (t, lo, hi, n, budget, every) => {
    let made = 0;
    for (let tries = 0; tries < 4000 && made < n; tries++) {
      const x = 20 + Math.floor(r() * (W - 40)), y = lo + Math.floor(r() * (hi - lo));
      const k = y * W + x;
      if (!isSolid(w.t[k]) || w.t[k] === T.BEDROCK || w.t[k + W] !== T.AIR) continue;
      let drop = 0; while (drop < 20 && w.t[k + W * (drop + 1)] === T.AIR) drop++;
      if (drop < 4) continue;
      if (Math.abs(x - w.spawn.x) < 25) continue;
      w.springs.push({x, y, t, left: budget, every}); made++;
    }
  };
  tryAdd(T.WATER, 62, 100, 10, 160, 6);
  tryAdd(T.LAVA, 96, 114, 6, 70, 20);
}
function settleSand(w) {
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let y = H - 3; y >= 0; y--) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (w.t[k] === T.SAND && (w.t[k + W] === T.AIR || DECOR.has(w.t[k + W]))) { w.t[k + W] = T.SAND; w.t[k] = T.AIR; moved = true; }
    }
    if (!moved) break;
  }
}
