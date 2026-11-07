// Burrow sim · worldgen.js — Builds a seeded world: biomes, caves, ores, lava, ponds, trees, dungeons.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
'use strict';

// ---------- world gen ----------
const BIOMES = ['Snowpeaks', 'Forest', 'Meadow', 'Dunes', 'Mire', 'Redlands', 'Amberwood', 'Savanna'];
const GEN_NOW = 2; // gen 1 worlds have the first four biomes. A saved world rebuilds from its seed, so it keeps the gen it was made with
const B_SNOW = 0, B_FOREST = 1, B_MEADOW = 2, B_DUNES = 3, B_MIRE = 4, B_RED = 5, B_AMBER = 6, B_SAVANNA = 7;
const lushBiome = b => b === B_FOREST || b === B_MEADOW || b === B_MIRE || b === B_AMBER || b === B_SAVANNA; // green enough for pudgeons, wild potatoes and the like
function generate(seed, join, gen = GEN_NOW) { // join: {surf, biome, at, noise} of the land this stretch carries on from
  const r = mulberry(seed * 7919 + 13);
  const t = new Uint8Array(W * H);
  const w = {seed, t, biome: new Uint8Array(W), surf: new Int16Array(W), top: new Int16Array(W), chests: {}, graves: {}};
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) t[y * W + x] = v; };
  const get = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? T.BEDROCK : t[y * W + x];
  // new land on the journey runs right to its edges, and its rock layers and big caves follow one pattern that carries on across every join
  const open = join && join.noise !== undefined, xAt = open ? join.at : 0, rock = open ? join.noise : seed, x0Edge = open ? 0 : 1, x1Edge = open ? W : W - 1;

  // biome segments
  let x = 0, prev = join ? join.biome : -1;
  const segs = [];
  while (x < W) {
    let len = 70 + Math.floor(r() * 80);
    let b; do { b = Math.floor(r() * (gen >= 2 ? BIOMES.length : 4)); } while (b === prev);
    segs.push({x0: x, x1: Math.min(W, x + len), b}); prev = b; x += len;
  }
  // force spawn area (center) to forest or meadow
  for (const s of segs) if (s.x0 <= 300 && s.x1 > 300 && !lushBiome(s.b)) s.b = 1;
  for (const s of segs) for (let i = s.x0; i < s.x1; i++) w.biome[i] = s.b;
  const OFF = [-22, 0, 2, 3, 5, -8, -2, 1], AMP = [13, 6, 3, 2, 1, 12, 5, 2];
  const off = new Float32Array(W), amp = new Float32Array(W), mesa = new Float32Array(W);
  for (let i = 0; i < W; i++) {
    let so = 0, sa = 0, n = 0, red = 0;
    for (let k = -16; k <= 16; k++) { const j = clamp(i + k, 0, W - 1); so += OFF[w.biome[j]]; sa += AMP[w.biome[j]]; if (w.biome[j] === B_RED) red++; n++; }
    off[i] = so / n; amp[i] = sa / n; mesa[i] = red / n;
  }
  for (let i = 0; i < W; i++) {
    let h = 56 + off[i] + (vn1(i / 28, seed + 3) - 0.5) * 2 * amp[i] + (vn1(i / 8, seed + 4) - 0.5) * 0.6 * amp[i];
    if (mesa[i] > 0.85) h = Math.round(h / 3) * 3; // the Redlands rise in flat-topped steps
    if (join && i < 48) h = join.surf + (h - join.surf) * i / 48;
    w.surf[i] = Math.round(clamp(h, 14, 70));
  }
  // columns
  for (let i = 0; i < W; i++) {
    const h = w.surf[i], b = w.biome[i];
    const dd = 3 + (hash2(i, 1, seed) < 0.5 ? 0 : 1);
    const deepLine = 95 + Math.round((vn1((i + xAt) / 20, rock + 5) - 0.5) * 6);
    const redDeep = gen >= 2 ? Math.round(18 * clamp((mesa[i] - 0.5) * 2.2, 0, 1) + 2 + vn1(i / 5, seed + 11) * 4) : 18; // thins out towards the edge of the Redlands, so the red rock doesn't end in a straight wall
    for (let y = 0; y < H; y++) {
      let v;
      if (y < h) v = T.AIR;
      else if (y === h) v = b === 0 ? T.SNOW : b === 3 ? T.SAND : b === B_RED ? T.DIRT : T.GRASS;
      else if (y <= h + dd) v = b === 3 ? T.SAND : T.DIRT;
      else if (b === 3 && y <= h + dd + 4) v = T.SANDSTONE;
      else if (b === B_RED && y <= h + redDeep) v = T.SANDSTONE; // the banded red rock
      else v = y >= deepLine ? T.DEEP : T.STONE;
      if (y === H - 1 || (y >= H - 4 && hash2(i, y, seed + 9) < (y - (H - 5)) / 4)) v = T.BEDROCK;
      t[y * W + i] = v;
    }
  }
  // worm caves
  const worms = Math.floor(W / 8);
  for (let k = 0; k < worms; k++) {
    let cx = r() * W, entrance = r() < 0.12;
    let cy = entrance ? w.surf[Math.floor(cx)] + 1 : w.surf[Math.floor(cx)] + 10 + r() * (H - 16 - w.surf[Math.floor(cx)] - 10);
    let a = entrance ? Math.PI / 2 + (r() - 0.5) * 0.8 : r() * Math.PI * 2;
    const len = 40 + r() * 120, base = 1.0 + r() * 1.3;
    for (let s = 0; s < len; s++) {
      a += (r() - 0.5) * 0.55;
      if (entrance && s < 14) a = a * 0.85 + (Math.PI / 2) * 0.15;
      cx += Math.cos(a); cy += Math.sin(a) * 0.55;
      if (cy > H - 6) { cy = H - 6; a = -a; }
      const rad = base + Math.sin(s * 0.3) * 0.4;
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
        if (dx * dx + dy * dy * 1.4 > rad * rad) continue;
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        if (px < x0Edge || px >= x1Edge || py >= H - 2) continue;
        if (!entrance && py < w.surf[px] + 5) continue;
        if (py < w.surf[px]) continue;
        if (get(px, py) !== T.BEDROCK) set(px, py, T.AIR);
      }
    }
  }
  // cheese caves
  for (let i = x0Edge; i < x1Edge; i++) for (let y = w.surf[i] + 14; y < H - 3; y++) {
    if (vn2((i + xAt) / 15, y / 8, rock + 7) > 0.79 && get(i, y) !== T.BEDROCK) set(i, y, T.AIR);
  }
  // ores
  const ORES = [[T.COAL, 48, 118, 270, 4, 8], [T.COPPER, 62, 108, 110, 3, 6], [T.IRON, 74, 122, 130, 3, 6], [T.GOLD, 96, 124, 95, 2, 5], [T.GEM, 104, 125, 120, 2, 5]];
  for (const [ore, lo, hi, cnt, mn, mx] of ORES) {
    for (let k = 0; k < cnt; k++) {
      let ox = Math.floor(r() * W), oy = Math.floor(lo + r() * (hi - lo));
      if (oy <= w.surf[ox] + 3) continue;
      const size = mn + Math.floor(r() * (mx - mn + 1));
      for (let s = 0; s < size; s++) {
        const c = get(ox, oy);
        if (c === T.STONE || c === T.DEEP) set(ox, oy, ore);
        const d = Math.floor(r() * 4);
        ox += d === 0 ? 1 : d === 1 ? -1 : 0; oy += d === 2 ? 1 : d === 3 ? -1 : 0;
      }
    }
  }
  // lava lakes at cave bottoms
  for (let i = x0Edge; i < x1Edge; i++) for (let y = 117; y < H - 1; y++) if (get(i, y) === T.AIR) set(i, y, T.LAVA);
  for (let k = 0; k < 9; k++) {
    const lx = Math.floor(10 + r() * (W - 20)), ly = Math.floor(108 + r() * 12);
    for (let dx = -4; dx <= 4; dx++) for (let dy = -2; dy <= 1; dy++) {
      if ((dx * dx) / 16 + (dy * dy) / 3 > 1) continue;
      if (get(lx + dx, ly + dy) === T.BEDROCK) continue;
      set(lx + dx, ly + dy, dy >= 0 ? T.LAVA : T.AIR);
    }
  }
  // settle lava so it never hangs over air
  for (let pass = 0; pass < 6; pass++) for (let y = H - 2; y >= 0; y--) for (let i = 0; i < W; i++) {
    if (get(i, y) === T.LAVA && get(i, y + 1) === T.AIR) { set(i, y + 1, T.LAVA); set(i, y, T.AIR); }
  }
  // dungeons (dressed with their own random numbers, so the rest of a seed's world stays as it was)
  const dr = mulberry((seed * 4801 + 77) >>> 0);
  w.spawners = [];
  const dressDungeon = (x0, y0) => {
    set(x0 + 3, y0 + 3, T.SPAWNER); w.spawners.push({x: x0 + 3, y: y0 + 3});
    set(x0 + 1, y0 + 3, T.CHEST);
    const loot = {iron_ingot: 1 + Math.floor(dr() * 3), raw_gold: 1 + Math.floor(dr() * 3), bread: 2};
    if (dr() < 0.25) loot.gem = 1;
    w.chests[(y0 + 3) * W + x0 + 1] = loot;
  };
  for (let k = 0; k < 3; k++) {
    const x0 = Math.floor(40 + r() * (W - 80)), y0 = Math.floor(80 + r() * 24);
    for (let dx = -1; dx <= 7; dx++) for (let dy = -1; dy <= 4; dy++) {
      const wall = dx === -1 || dx === 7 || dy === -1 || dy === 4;
      set(x0 + dx, y0 + dy, wall ? (r() < 0.5 ? T.MOSSY : T.COBBLE) : T.AIR);
    }
    set(x0 + 7, y0 + 2, T.AIR); set(x0 + 7, y0 + 3, T.AIR); set(x0 - 1, y0 + 2, T.AIR); set(x0 - 1, y0 + 3, T.AIR);
    set(x0 + 5, y0 + 3, T.CHEST);
    w.chests[(y0 + 3) * W + x0 + 5] = {raw_iron: 3 + Math.floor(r() * 4), coal: 4 + Math.floor(r() * 5), bread: 2 + Math.floor(r() * 2), raw_gold: Math.floor(r() * 3), gem: r() < 0.5 ? 1 : 0, torch: 4};
    for (const k in w.chests[(y0 + 3) * W + x0 + 5]) if (!w.chests[(y0 + 3) * W + x0 + 5][k]) delete w.chests[(y0 + 3) * W + x0 + 5][k];
    dressDungeon(x0, y0);
  }
  // mineshafts
  for (let k = 0; k < 2; k++) {
    const sx = Math.floor(40 + r() * (W - 140)), sy = Math.floor(70 + r() * 18), len = 40 + Math.floor(r() * 40);
    for (let i = 0; i < len; i++) {
      const px = sx + i;
      for (let dy = -2; dy <= 0; dy++) if (get(px, sy + dy) !== T.BEDROCK) set(px, sy + dy, T.AIR);
      if (!isSolid(get(px, sy + 1))) set(px, sy + 1, T.PLANKS);
      if (i % 5 === 0) { set(px, sy, T.LOG); set(px, sy - 1, T.LOG); set(px, sy - 2, T.PLANKS); }
    }
    const cx = sx + Math.floor(len / 2) + 2;
    set(cx, sy, T.CHEST);
    w.chests[sy * W + cx] = {coal: 5 + Math.floor(r() * 6), raw_copper: 3 + Math.floor(r() * 4), torch: 6, bread: 1};
  }
  // water ponds
  for (let k = 0; k < 8; k++) {
    const px = Math.floor(10 + r() * (W - 20));
    if (w.biome[px] !== 1 && w.biome[px] !== 2) continue;
    if (Math.abs(px - 300) < 25) continue;
    const h = w.surf[px]; let flat = true;
    for (let dx = -4; dx <= 4; dx++) if (Math.abs(w.surf[px + dx] - h) > 1) flat = false;
    if (!flat) continue;
    for (let dx = -3; dx <= 3; dx++) {
      const depth = 2 - Math.floor(Math.abs(dx) / 2);
      for (let dy = 0; dy < depth; dy++) set(px + dx, h + dy, T.WATER);
      for (let dy = h - 3; dy < h; dy++) set(px + dx, dy, T.AIR);
      set(px + dx, h + depth, T.DIRT);
    }
  }
  // the Mire's pools, with room for a camp between them
  for (let px = 12; px < W - 12; px += 26 + Math.floor(hash2(px, 7, seed) * 10)) {
    if (w.biome[px] !== B_MIRE || w.biome[px - 5] !== B_MIRE || w.biome[px + 5] !== B_MIRE || Math.abs(px - 300) < 25) continue;
    const h = w.surf[px]; let flat = true;
    for (let dx = -4; dx <= 4; dx++) if (Math.abs(w.surf[px + dx] - h) > 1) flat = false;
    if (!flat) continue;
    for (let dx = -3; dx <= 3; dx++) {
      const depth = 2 - Math.floor(Math.abs(dx) / 2);
      for (let dy = h - 3; dy < h; dy++) set(px + dx, dy, T.AIR);
      for (let dy = 0; dy < depth; dy++) set(px + dx, h + dy, T.WATER);
      set(px + dx, h + depth, T.DIRT);
    }
  }
  // surface: trees, bushes, decorations
  let lastTree = -10;
  for (let i = 3; i < W - 3; i++) {
    const b = w.biome[i], h = w.surf[i];
    const ground = get(i, h);
    if (ground !== T.GRASS && ground !== T.SNOW && ground !== T.SAND && !(b === B_RED && ground === T.DIRT)) continue;
    if (get(i, h - 1) !== T.AIR) continue;
    if (Math.abs(i - 300) <= 5) continue;
    const roll = r();
    if (b === 3) {
      if (roll < 0.04 && i - lastTree > 4) { const ch = 2 + Math.floor(r() * 2); for (let k = 1; k <= ch; k++) set(i, h - k, T.CACTUS); lastTree = i; }
      continue;
    }
    if (b === B_RED) {
      if (roll < 0.025 && i - lastTree > 6) { const ch = 2 + Math.floor(r() * 2); for (let k = 1; k <= ch; k++) set(i, h - k, T.CACTUS); lastTree = i; }
      else if (roll < 0.1) set(i, h - 1, T.BUSHE);
      continue;
    }
    const treeChance = b === 1 ? 0.24 : b === 2 ? 0.07 : b === B_MIRE ? 0.13 : b === B_AMBER ? 0.22 : b === B_SAVANNA ? 0.05 : 0.09;
    if (roll < treeChance && i - lastTree > 3) {
      lastTree = i;
      if (b === 0) {
        const th = 5 + Math.floor(r() * 3);
        for (let k = 1; k <= th; k++) set(i, h - k, T.LOG);
        for (let k = 0; k <= th - 1; k++) {
          const yy = h - th - 1 + k; const hw = Math.min(2, Math.floor(k / 2));
          if (k > th - 3) continue;
          for (let dx = -hw; dx <= hw; dx++) if (get(i + dx, yy) === T.AIR) set(i + dx, yy, T.PINE);
        }
        set(i, h - th - 1, T.PINE);
      } else if (b === B_SAVANNA) { // a wide flat top on a tall bare trunk
        const th = 6 + Math.floor(r() * 2);
        for (let k = 1; k <= th; k++) set(i, h - k, T.LOG);
        for (let dy = 0; dy <= 1; dy++) for (let dx = -4 + dy; dx <= 4 - dy; dx++) if (get(i + dx, h - th - dy) === T.AIR) set(i + dx, h - th - dy, T.LEAVES);
      } else if (b === B_MIRE) { // a low crown with strands hanging off it
        const th = 4 + Math.floor(r() * 2);
        for (let k = 1; k <= th; k++) set(i, h - k, T.LOG);
        for (let dx = -3; dx <= 3; dx++) {
          const dy0 = Math.abs(dx) === 3 ? 0 : -1;
          for (let dy = dy0; dy <= 0; dy++) if (get(i + dx, h - th - 1 + dy) === T.AIR) set(i + dx, h - th - 1 + dy, T.LEAVES);
          if (dx && r() < 0.6) for (let dy = 0; dy <= 1 + (Math.abs(dx) === 3 ? 1 : 0); dy++) if (get(i + dx, h - th + dy) === T.AIR) set(i + dx, h - th + dy, T.LEAVES);
        }
      } else {
        const th = 4 + Math.floor(r() * 3);
        for (let k = 1; k <= th; k++) set(i, h - k, T.LOG);
        const cy = h - th;
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 1; dy++) {
          if (dx * dx + dy * dy > 5 || (dx === 0 && dy >= 0)) continue;
          if (get(i + dx, cy + dy) === T.AIR) set(i + dx, cy + dy, T.LEAVES);
        }
      }
      continue;
    }
    if (b !== 0 && roll < treeChance + 0.05) set(i, h - 1, T.BUSH);
    else if (b === 2 && roll < 0.45) set(i, h - 1, roll < 0.36 ? T.TGRASS : T.FLOWER);
    else if (b === 1 && roll < 0.42) set(i, h - 1, roll < 0.38 ? T.TGRASS : T.FLOWER);
    else if (b === B_MIRE && roll < 0.65) set(i, h - 1, T.TGRASS);
    else if (b === B_AMBER && roll < 0.38) set(i, h - 1, roll < 0.34 ? T.TGRASS : T.FLOWER);
    else if (b === B_SAVANNA && roll < 0.7) set(i, h - 1, T.TGRASS);
  }
  // desert hut with a chest
  for (let i = 20; i < W - 20; i++) {
    if (w.biome[i] !== 3) continue;
    const h = w.surf[i]; let flat = true;
    for (let dx = -4; dx <= 4; dx++) if (Math.abs(w.surf[i + dx] - h) > 0 || w.biome[i + dx] !== 3) flat = false;
    if (!flat || r() < 0.6) continue;
    for (let dx = -3; dx <= 3; dx++) for (let dy = 1; dy <= 5; dy++) {
      const edge = dx === -3 || dx === 3 || dy === 5;
      set(i + dx, h - dy, edge ? T.SANDSTONE : T.AIR);
    }
    set(i + 3, h - 1, T.AIR); set(i + 3, h - 2, T.AIR);
    set(i - 2, h - 1, T.CHEST);
    w.chests[(h - 1) * W + i - 2] = {bread: 3, coal: 6, raw_iron: 2, torch: 5};
    break;
  }
  // spawn
  let sp = -1;
  for (let pass = 0; pass < 2 && sp < 0; pass++) for (let d = 0; d < 120; d++) {
    for (const c of [300 + d, 300 - d]) {
      let ok = pass === 1 || w.biome[c] === 1;
      for (let k = -4; k <= 4; k++) { const j = c + k; if (Math.abs(w.surf[j] - w.surf[c]) > 1 || get(j, w.surf[j]) === T.WATER) ok = false; if (Math.abs(k) <= 1) for (let dy = 0; dy <= 3; dy++) if (!isSolid(get(j, w.surf[j] + dy))) ok = false; }
      if (ok) { sp = c; d = 999; break; }
    }
  }
  if (sp < 0) sp = 300;
  w.spawn = {x: sp, y: w.surf[sp] - 1};
  // clear spawn area of trees
  for (let dx = -4; dx <= 4; dx++) for (let dy = 1; dy <= 9; dy++) {
    const c = get(sp + dx, w.surf[sp + dx] - dy);
    if (c === T.LOG || c === T.LEAVES || c === T.PINE || c === T.BUSH) set(sp + dx, w.surf[sp + dx] - dy, T.AIR);
  }
  // make sure there is some wood within reach of the start
  let trunks = 0;
  for (let x = sp - 40; x <= sp + 40; x++) if (get(x, w.surf[x] - 1) === T.LOG) trunks++;
  for (let tries = 0; trunks < 4 && tries < 200; tries++) {
    const x = sp + (r() < 0.5 ? -1 : 1) * (7 + Math.floor(r() * 30)), h = w.surf[x];
    const gt = get(x, h);
    if ((gt !== T.GRASS && gt !== T.SNOW) || get(x, h - 1) !== T.AIR || get(x - 2, w.surf[x - 2] - 1) === T.LOG || get(x + 2, w.surf[x + 2] - 1) === T.LOG) continue;
    let ok = true; for (let k = 1; k <= 7; k++) if (get(x, h - k) !== T.AIR) ok = false;
    if (!ok) continue;
    const th = 4 + Math.floor(r() * 2);
    for (let k = 1; k <= th; k++) set(x, h - k, T.LOG);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 1; dy++) {
      if (dx * dx + dy * dy > 5 || (dx === 0 && dy >= 0)) continue;
      if (get(x + dx, h - th + dy) === T.AIR) set(x + dx, h - th + dy, gt === T.SNOW ? T.PINE : T.LEAVES);
    }
    trunks++;
  }
  // two more dungeons, well away from the others
  for (let k = 0, tries = 0; k < 2 && tries < 40; tries++) {
    const x0 = Math.floor(40 + dr() * (W - 80)), y0 = Math.floor(80 + dr() * 24);
    if (w.spawners.some(s => Math.abs(s.x - x0) < 30)) continue;
    for (let dx = -1; dx <= 7; dx++) for (let dy = -1; dy <= 4; dy++) {
      const wall = dx === -1 || dx === 7 || dy === -1 || dy === 4;
      set(x0 + dx, y0 + dy, wall ? (dr() < 0.5 ? T.MOSSY : T.COBBLE) : T.AIR);
    }
    set(x0 + 7, y0 + 2, T.AIR); set(x0 + 7, y0 + 3, T.AIR); set(x0 - 1, y0 + 2, T.AIR); set(x0 - 1, y0 + 3, T.AIR);
    set(x0 + 5, y0 + 3, T.CHEST);
    w.chests[(y0 + 3) * W + x0 + 5] = {raw_iron: 2 + Math.floor(dr() * 4), coal: 4 + Math.floor(dr() * 5), bread: 2, torch: 4};
    dressDungeon(x0, y0);
    k++;
  }
  settleSand(w);
  for (let i = 0; i < W; i++) recomputeTop(w, i);
  initFluids(w);
  makeSprings(w, r);
  return w;
}
function recomputeTop(w, x) {
  let y = 0; while (y < H && !isSolid(w.t[y * W + x]) && w.t[y * W + x] !== T.WATER) y++;
  w.top[x] = y;
}
