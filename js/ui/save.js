// Burrow UI · save.js — Setup, settings in localStorage, and saving/loading a world.
'use strict';

const R = BurrowRender;
const SAVE = 'burrow.save.v1', REC = 'burrow.records.v1', PREF = 'burrow.prefs.v1';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) {
    const text = JSON.stringify(v);
    for (let tries = 0; tries < 8; tries++) {
      try { localStorage.setItem(k, text); return true; } catch (e) {
        // the world always matters more than the scrapbook's pictures
        if (k.startsWith('burrow.book') || typeof Book === 'undefined' || !Book.free()) return false;
      }
    }
    return false;
  }
};
R.buildTiles(); R.buildSprites();
const cv = document.getElementById('game');
const rd = new R.Renderer(cv);
const prefs = Object.assign({speed: 1, zoom: 32, tab: 'plan', collapsed: true, follow: true, sound: false}, store.get(PREF) || {});
let g, speed = prefs.speed, paused = false, follow = prefs.follow !== false, worldView = false;
rd.zoom = prefs.zoom;
let records = store.get(REC) || {};

// ---------- save / load ----------
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function unb64(s, n) { const bin = atob(s), u = new Uint8Array(n || bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
// worlds are long runs of the same block, so a save keeps [value, run length] pairs. Saves from before this have no `rle` mark
function rleBytes(u8) {
  const out = new Uint8Array(u8.length * 2);
  let n = 0;
  for (let i = 0; i < u8.length;) { let run = 1; while (run < 255 && u8[i + run] === u8[i] && i + run < u8.length) run++; out[n++] = u8[i]; out[n++] = run; i += run; }
  return out.subarray(0, n);
}
function unrleBytes(p, size) {
  const out = new Uint8Array(size);
  for (let i = 0, at = 0; i < p.length; i += 2) { out.fill(p[i], at, at + p[i + 1]); at += p[i + 1]; }
  return out;
}
const packField = u8 => b64(rleBytes(u8));
const readField = (o, s, size) => o.rle ? unrleBytes(unb64(s), size) : unb64(s, size);
// an older save squeezed down in place
function compactSave(o) {
  if (!o || o.rle) return o;
  const WH = B.W * B.H, bits = Math.ceil(WH / 8);
  o.t = packField(unb64(o.t, WH)); if (o.lv) o.lv = packField(unb64(o.lv, WH)); o.seen = packField(unb64(o.seen, bits));
  if (o.under) { const u = o.under; u.t = packField(unb64(u.t, WH)); u.lv = packField(unb64(u.lv, WH)); u.seen = packField(unb64(u.seen, bits)); }
  o.rle = 1;
  return o;
}
function packBits(a) { const o = new Uint8Array(Math.ceil(a.length / 8)); for (let i = 0; i < a.length; i++) if (a[i]) o[i >> 3] |= 1 << (i & 7); return o; }
function unpackBits(p, n) { const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = (p[i >> 3] >> (i & 7)) & 1; return a; }
const MKEYS = ['obsidian', 'grit', 'gritLv', 'underCamp', 'underDay', 'x', 'y', 'hp', 'hunger', 'inv', 'dur', 'built', 'buildWork', 'decorCells', 'finishCells', 'storeCells', 'gateCells', 'campCells', 'growCells', 'gateTries', 'gateRetry', 'quest', 'ruinsSeen', 'homeStart', 'latched', 'gate', 'underWant', 'tripNeed', 'gateHold', 'pet', 'tradedDay', 'farm', 'farmDone', 'farmNext', 'seedNext', 'wildPotatoes', 'potatoNext', 'tripStart', 'leaveStart', 'stash', 'stashNext', 'fishDay', 'facing', 'home', 'bed', 'stations', 'journey', 'stripDir', 'sleptDay', 'hidDay', 'hut', 'hutWork', 'strip', 'thought', 'regenT', 'hungerT'];
function saveSnapshot() {
  const m = {};
  for (const k of MKEYS) m[k] = g.m[k];
  const deep = g.realm === 'under', over = deep ? g.other : g, under = deep ? g : g.other; // the top level is always the overworld
  m.stations = deep ? g.other.stations : g.m.stations;
  const o = {v: 1, rle: 1, gen: g.gen, seed: g.seed, tick: g.tick, time: g.time, day: g.day, t: packField(over.w.t), seen: packField(packBits(over.seen)), known: [...over.known],
    lv: packField(over.w.lv), springs: over.w.springs,
    chests: over.w.chests, graves: over.w.graves, regrow: over.w.regrow || [], torches: over.torches, stats: g.stats, log: g.log,
    protect: over.protect ? [...over.protect] : null, critters: over.critters.map(c => [c.x, c.y]), crops: over.w.crops || {}, m, realm: g.realm || 'over'};
  if (under) o.under = {ver: under.w.ver, era: under.w.era, t: packField(under.w.t), lv: packField(under.w.lv), seen: packField(packBits(under.seen)), known: [...under.known], chests: under.w.chests, graves: under.w.graves,
    regrow: under.w.regrow || [], torches: under.torches, protect: under.protect ? [...under.protect] : null, spawners: under.w.spawners, stations: deep ? g.m.stations : under.stations};
  if (g.m.journey) o.land = {surf: [...over.w.surf], biome: [...over.w.biome], spawn: over.w.spawn, spawners: over.w.spawners || [], villages: (over.w.villages || []).map(v => Object.assign({}, v, {folk: undefined}))}; // the slid world no longer matches its seed
  return o;
}
let autosaveWarned = false;
function saveGame() {
  if (!g) return;
  const ok = store.set(SAVE, saveSnapshot());
  if (ok) autosaveWarned = false;
  else if (!autosaveWarned) { autosaveWarned = true; toast('This browser is out of room, so the game can’t save itself. Delete a save, or use Download'); }
}
function loadGame() { return readSave(store.get(SAVE)); }
function readSave(o) {
  if (!o || o.v !== 1) return null;
  try {
    const gg = B.newGame(o.seed, o.gen || 1); // a save from before there was a gen is a gen 1 world
    const WH = B.W * B.H, BITS = Math.ceil(WH / 8);
    gg.w.t.set(readField(o, o.t, WH));
    if (o.lv) gg.w.lv.set(readField(o, o.lv, WH));
    else for (let k = 0; k < B.W * B.H; k++) gg.w.lv[k] = (gg.w.t[k] === B.T.WATER || gg.w.t[k] === B.T.LAVA) ? 8 : 0; // older saves
    if (o.springs) gg.w.springs = o.springs;
    if (o.land) { gg.w.surf.set(o.land.surf); gg.w.biome.set(o.land.biome); gg.w.spawn = o.land.spawn; gg.w.spawners = o.land.spawners; gg.w.villages = o.land.villages || []; }
    for (let x = 0; x < B.W; x++) { let y = 0; while (y < B.H && !B.isSolid(gg.w.t[y * B.W + x]) && gg.w.t[y * B.W + x] !== B.T.WATER) y++; gg.w.top[x] = y; }
    gg.seen = unpackBits(readField(o, o.seen, BITS), WH);
    gg.known = new Set(o.known); gg.w.chests = o.chests; gg.w.graves = o.graves; gg.w.regrow = o.regrow; gg.w.crops = o.crops || {};
    gg.torches = o.torches; gg.stats = o.stats; gg.log = o.log; gg.tick = o.tick; gg.time = o.time; gg.day = o.day;
    gg.protect = o.protect ? new Set(o.protect) : null;
    gg.critters = o.critters.map(([x, y]) => ({x, y, px: x, py: y, hp: 4, moveT: 0, cd: 0, facing: 1}));
    gg.monsters = [];
    Object.assign(gg.m, o.m); gg.m.px = gg.m.x; gg.m.py = gg.m.y; gg.m.job = null; gg.m.path = []; gg.m.act = null; gg.m.sleeping = false; gg.m.hiding = false;
    gg.rng = B.mulberry((o.seed ^ o.tick) >>> 0);
    if (o.under) {
      const s = o.under, u = B.makeUnderState(gg, s.era);
      u.w.t.set(readField(o, s.t, WH)); u.w.lv.set(readField(o, s.lv, WH));
      for (let x = 0; x < B.W; x++) { let y = 0; while (y < B.H && !B.isSolid(u.w.t[y * B.W + x]) && u.w.t[y * B.W + x] !== B.T.WATER) y++; u.w.top[x] = y; }
      u.seen = unpackBits(readField(o, s.seen, BITS), WH); u.known = new Set(s.known); u.w.chests = s.chests; u.w.graves = s.graves; u.w.regrow = s.regrow;
      u.torches = s.torches; u.protect = s.protect ? new Set(s.protect) : null; u.w.spawners = s.spawners; u.stations = s.stations || [];
      u.w.ver = s.ver; gg.other = u;
      if (o.realm === 'under') B.switchRealm(gg, 'under', gg.m.x, gg.m.y);
    }
    return gg;
  } catch (e) { return null; }
}
function start(gg) {
  g = gg;
  rd.wild = new Map(); // the animals out and about belonged to the last world
  rd.rebuildMini(g);
  rd.cam.x = g.m.x + 0.5; rd.cam.y = g.m.y - 1;
  lastMs = g.stats.milestones.length;
  if (typeof Book !== 'undefined') Book.open(g);
  document.getElementById('seed').textContent = 'World ' + g.seed;
  renderPanel(true);
}
let lastMs = 0;
