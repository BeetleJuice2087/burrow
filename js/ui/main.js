// Burrow UI · main.js — The frame loop: runs sim ticks, moves the camera, draws, saves.
'use strict';

// ---------- main loop ----------
const bubble = document.getElementById('bubble');
let last = performance.now(), acc = 0, uiT = 0, saveT = 0;
function resize() { const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }
addEventListener('resize', resize); resize();
// frames a second, counted over half a second
const fpsBox = document.getElementById('fps');
let fpsN = 0, fpsT = 0;
function countFps(dt) {
  if (fpsBox.hidden) return;
  fpsN++; fpsT += dt;
  if (fpsT < 0.5) return;
  const f = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0;
  fpsBox.textContent = f + ' FPS'; fpsBox.classList.toggle('mid', f < 50 && f >= 30); fpsBox.classList.toggle('low', f < 30);
}
setFps(!!prefs.fps);
function frame(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.25, raw); last = now;
  countFps(raw);
  const simStart = performance.now(); let n = 0;
  if (!paused && !endOpen && !document.hidden) {
    acc += dt * B.TPS * speed;
    // at most about 30 ms of ticks a frame: a slow stretch slows the game a touch instead of snowballing
    // (a slow frame means more ticks next frame, which makes that frame slower still)
    const t0 = performance.now(); n = 0;
    while (acc >= 1 && n < 400) { B.step(g); acc--; n++; if (performance.now() - t0 > 30) { acc = Math.min(acc, 1); break; } }
    if (n >= 400) acc = 0;
  }
  const simMs = performance.now() - simStart;
  // new milestones
  while (lastMs < g.stats.milestones.length) {
    const ms = g.stats.milestones[lastMs++];
    if (ms.id === 'q_home') endPrevBest = records.q_home;
    if (records[ms.id] === undefined || ms.tick < records[ms.id]) { records[ms.id] = ms.tick; store.set(REC, records); }
    toast(ms.label);
  }
  if (g.stats.retired && !g.stats.endSeen && !endOpen) showEnding();
  Book.update(now);
  if (g.shifted) { rd.cam.x -= g.shifted; rd.bolt = []; rd.slideWild(g.shifted); g.shifted = 0; rd.rebuildMini(g); } // the world slid along: keep looking at the same spot
  // camera
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const m = g.m;
  const viewW = innerWidth / rd.zoom, viewH = innerHeight / rd.zoom;
  if (follow) {
    const narrow = innerWidth <= 860;
    const offX = narrow || panelFolded() ? 0 : 160 / rd.zoom; // keep the miner clear of the side panel
    const offY = narrow && !panel.classList.contains('collapsed') ? innerHeight * 0.25 / rd.zoom : 0;
    const who = watchPal && m.pal ? m.pal : m;
    const tx = who.px + 0.5 + offX, ty = who.py - 1 + offY;
    const k = Math.min(1, dt * 5);
    rd.cam.x += (tx - rd.cam.x) * k; rd.cam.y += (ty - rd.cam.y) * k;
    if (Math.abs(tx - rd.cam.x) > 40 || Math.abs(ty - rd.cam.y) > 40) { rd.cam.x = tx; rd.cam.y = ty; }
  }
  rd.cam.x = Math.max(viewW / 2 - 2, Math.min(B.W - viewW / 2 + 2, rd.cam.x));
  rd.cam.y = Math.max(viewH / 2 - 14, Math.min(B.H - viewH / 2 + 1, rd.cam.y));
  const drawStart = performance.now();
  rd.draw(g, now, {dpr, world: worldView, still: paused, rightPad: innerWidth > 860 && !panelFolded() ? 344 : 0});
  PostFx.frame(rd, cv, now, !worldView);
  Monitor.frame(raw * 1000, simMs, performance.now() - drawStart, n, now);
  updateMoveOn();
  if (rd.boom) { rd.boom = false; if (!paused) Sound.thunder(rd.boomFar); }
  if (Sound.on) Sound.update(g, {x: g.m.px + 0.5, y: g.m.py - 1}, {paused: paused || document.hidden, speed, world: worldView}); else g.sfx.length = 0;
  // bubble
  const pw = watchPal && m.pal && rd.palScreen && !worldView ? m.pal : null;
  const ms = pw ? {x: rd.palScreen.x / dpr, y: rd.palScreen.y / dpr, ts: rd.palScreen.ts / dpr} : rd.minerScreen;
  if (ms && !(pw || m).dead) {
    bubble.style.left = ms.x + 'px'; bubble.style.top = (ms.y - (worldView ? 6 : ms.ts * 0.4)) + 'px';
    const txt = pw ? pw.name + ': ' + (pw.mode === 'camp' ? pw.thought || 'Looking around' : 'Keeping up with the miner') : m.sleeping ? 'Sleeping…' : m.hiding ? 'Waiting out the night' : m.thought;
    if (bubble.textContent !== txt) bubble.textContent = txt;
    bubble.classList.toggle('hide', ms.x < 0 || ms.x > innerWidth || ms.y < 0 || ms.y > innerHeight);
  } else bubble.classList.add('hide');
  uiT += dt;
  if (uiT > 0.2) { uiT = 0; updateHud(); renderPanel(); }
  saveT += dt;
  if (saveT > 15) { saveT = 0; saveGame(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); last = performance.now(); });
addEventListener('pagehide', saveGame);
start(loadGame() || B.newGame(Math.floor(Math.random() * 1e9)));
Book.lastTime();
updateHud();
requestAnimationFrame(frame);
window.__burrow = () => g;
