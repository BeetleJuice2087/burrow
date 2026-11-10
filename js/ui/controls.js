// Burrow UI · controls.js — Speed, zoom, follow, world view, new world, keyboard, drag and toasts.
'use strict';

// ---------- controls ----------
function savePrefs() { prefs.speed = speed; prefs.zoom = rd.zoom; store.set(PREF, prefs); }
const speedBtns = document.querySelectorAll('[data-speed]'), pauseBtn = document.getElementById('pause');
function setSpeed(s) { speed = s; paused = false; speedBtns.forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === s)); pauseBtn.setAttribute('aria-pressed', 'false'); savePrefs(); }
function togglePause() { paused = !paused; pauseBtn.setAttribute('aria-pressed', paused); speedBtns.forEach(b => b.setAttribute('aria-pressed', !paused && +b.dataset.speed === speed)); }
speedBtns.forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
pauseBtn.addEventListener('click', togglePause);
setSpeed(speed);
const ZOOMS = [16, 24, 32, 48];
function zoomBy(d) { if (worldView) { setWorld(false); return; } const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(rd.zoom) + d)); rd.zoom = ZOOMS[i < 0 ? 2 : i]; savePrefs(); }
if (!ZOOMS.includes(rd.zoom)) rd.zoom = 32;
document.getElementById('zoomIn').addEventListener('click', () => zoomBy(1));
document.getElementById('zoomOut').addEventListener('click', () => { if (!worldView && rd.zoom === ZOOMS[0]) setWorld(true); else zoomBy(-1); });
const followBtn = document.getElementById('follow'), worldBtn = document.getElementById('world');
function setFollow(f) { follow = f; followBtn.setAttribute('aria-pressed', f); prefs.follow = f; savePrefs(); }
function setWorld(w) { worldView = w; worldBtn.setAttribute('aria-pressed', w); if (w) rd.updateMini(g); }
followBtn.addEventListener('click', () => { if (watchPal) { setWatchPal(false); setFollow(true); } else if (worldView) { setWorld(false); setFollow(true); } else setFollow(!follow); });
setFollow(follow);
worldBtn.addEventListener('click', () => setWorld(!worldView));
// the route overlay: where the miner is going, and what it will dig and build to get there
const routeBtn = document.getElementById('route'), routeKey = document.getElementById('routeKey');
function setRoute(on) { rd.route = on; routeBtn.setAttribute('aria-pressed', on); routeKey.hidden = !on; prefs.route = on; savePrefs(); }
routeBtn.addEventListener('click', () => setRoute(!rd.route));
setRoute(!!prefs.route);
const confirmEl = document.getElementById('confirm');
const seedInput = document.getElementById('seedInput');
// empty is a random world; a number is used as it is, and any other text always turns into the same number
function chosenSeed() {
  const s = seedInput.value.trim();
  if (!s) return Math.floor(Math.random() * 1e9);
  if (/^\d+$/.test(s)) return Number(s) % 4294967296 || 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
document.getElementById('newWorld').addEventListener('click', () => { seedInput.value = ''; confirmEl.classList.add('show'); seedInput.focus(); });
document.getElementById('no').addEventListener('click', () => confirmEl.classList.remove('show'));
document.getElementById('yes').addEventListener('click', () => { confirmEl.classList.remove('show'); start(B.newGame(chosenSeed())); saveGame(); setFollow(true); setWorld(false); toast('A new world'); });
// fullscreen: Safari only knows the webkit names. Phones without it don't get the button
const fullBtn = document.getElementById('fullscreen'), pageEl = document.documentElement;
const fullNow = () => document.fullscreenElement || document.webkitFullscreenElement;
const fullCan = pageEl.requestFullscreen || pageEl.webkitRequestFullscreen;
fullBtn.hidden = !fullCan;
function toggleFull() {
  if (!fullCan) return;
  if (fullNow()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else fullCan.call(pageEl);
}
fullBtn.addEventListener('click', toggleFull);
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { fullBtn.setAttribute('aria-pressed', !!fullNow()); fullBtn.setAttribute('aria-label', fullNow() ? 'Leave fullscreen' : 'Fullscreen'); });
// sound: browsers only allow audio after a tap or key press
const soundBtn = document.getElementById('sound');
const SPK_ON = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5h3l3-3v10L5 9H2z" fill="currentColor"/><path d="M10 4.5c1.2 1.2 1.2 3.8 0 5M11.8 3c2 2 2 6 0 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const SPK_OFF = soundBtn.innerHTML;
function setSound(onNow) {
  if (onNow && !Sound.enable()) onNow = false;
  if (!onNow) Sound.disable();
  soundBtn.setAttribute('aria-pressed', onNow); soundBtn.innerHTML = onNow ? SPK_ON : SPK_OFF;
  soundBtn.setAttribute('aria-label', onNow ? 'Sound on' : 'Sound off');
  prefs.sound = onNow; savePrefs();
}
soundBtn.addEventListener('click', () => setSound(!Sound.on));
// lighting effects (shaders): on by default on computers, off on phones to spare the battery
const fxBtn = document.getElementById('fxBtn');
function setFx(on, say) {
  PostFx.on = !!on; prefs.fx = PostFx.on; savePrefs();
  if (PostFx.on && !PostFx.init()) { PostFx.on = false; fxBtn.disabled = true; fxBtn.title = 'Lighting effects aren’t available here'; if (say) toast('Lighting effects aren’t available on this device'); }
  fxBtn.setAttribute('aria-pressed', PostFx.on); fxBtn.setAttribute('aria-label', PostFx.on ? 'Lighting effects on' : 'Lighting effects off');
  if (say) toast(PostFx.on ? 'Lighting effects on' : 'Lighting effects off');
}
fxBtn.addEventListener('click', () => setFx(!PostFx.on, true));
// the frame rate, for fun
const fpsBtn = document.getElementById('fpsBtn');
function setFps(on) { fpsBox.hidden = !on; fpsBtn.setAttribute('aria-pressed', !!on); prefs.fps = !!on; savePrefs(); if (on) fpsBox.textContent = '… FPS'; }
fpsBtn.addEventListener('click', () => setFps(fpsBox.hidden));
setFx(prefs.fx !== undefined ? prefs.fx : matchMedia('(pointer: fine)').matches);
if (prefs.sound) { // remembered as on: start at the first tap or key press
  const wake = () => { if (prefs.sound && !Sound.on) setSound(true); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);
}
seedInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('yes').click();
  else if (e.key === 'Escape') document.getElementById('no').click();
});
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.key === 's' || e.key === 'S') setSound(!Sound.on);
  else if (e.key === 'p' || e.key === 'P') foldPanel(!panel.classList.contains('folded'));
  else if (e.key >= '1' && e.key <= '4') setSpeed([1, 2, 4, 8][+e.key - 1]);
  else if (e.key === '+' || e.key === '=') zoomBy(1);
  else if (e.key === '-') zoomBy(-1);
  else if (e.key === 'm' || e.key === 'M') setWorld(!worldView);
  else if (e.key === 'r' || e.key === 'R') setRoute(!rd.route);
  else if ((e.key === 't' || e.key === 'T') && replayFits()) Replay.show();
  else if (e.key === 'g' || e.key === 'G') toggleFull();
  else if ((e.key === 'c' || e.key === 'C') && !palWatch.hidden) setWatchPal(!watchPal);
  else if (e.key === 'e' || e.key === 'E') setFx(!PostFx.on, true);
  else if (e.key === 'i' || e.key === 'I') setFps(fpsBox.hidden);
  else if (e.key === 'f' || e.key === 'F') { if (watchPal) { setWatchPal(false); setFollow(true); } else if (worldView) { setWorld(false); setFollow(true); } else setFollow(!follow); }
});
// drag to look around, wheel to zoom
let drag = null;
cv.addEventListener('pointerdown', e => { drag = {x: e.clientX, y: e.clientY, cx: rd.cam.x, cy: rd.cam.y, moved: false}; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag || worldView) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; cv.classList.add('dragging'); setFollow(false); }
  rd.cam.x = drag.cx - dx / rd.zoom; rd.cam.y = drag.cy - dy / rd.zoom;
});
cv.addEventListener('pointerup', e => {
  cv.classList.remove('dragging');
  if (drag && !drag.moved && worldView && rd.worldBox) {
    const wb = rd.worldBox, tx = (e.clientX - wb.ox) / wb.scale, ty = (e.clientY - wb.oy) / wb.scale;
    if (tx >= 0 && tx < B.W && ty >= 0 && ty < B.H) { rd.cam.x = tx; rd.cam.y = ty; setFollow(false); setWorld(false); }
  }
  drag = null;
});
cv.addEventListener('wheel', e => { e.preventDefault(); if (e.deltaY < 0) zoomBy(1); else if (!worldView && rd.zoom === ZOOMS[0]) setWorld(true); else zoomBy(-1); }, {passive: false});

// ---------- toast ----------
const toastEl = document.getElementById('toast');
let toastT = 0;
function toast(text) { toastEl.innerHTML = '<b>★</b> ' + esc(text); toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3200); }
