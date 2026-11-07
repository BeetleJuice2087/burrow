// Burrow UI · hud.js — Top-left card: clock, hearts, hunger, depth.
'use strict';

function journeyGoal(j) {
  if (j.hold) return 'Staying at camp ' + j.camps;
  return j.stage === 'pack' ? 'Pack for the journey' : j.stage === 'camp' ? 'Living at camp ' + j.camps : j.stage === 'leave' ? 'Break camp' : 'Walk east';
}

// ---------- HUD ----------
const icons = {}; for (const k in R.UI_ICONS) icons[k] = R.UI_ICONS[k]();
const heartsEl = document.getElementById('hearts'), foodEl = document.getElementById('food');
const heartImgs = [], foodImgs = [];
for (let i = 0; i < 15; i++) { const h = new Image(); h.alt = ''; heartsEl.appendChild(h); heartImgs.push(h); if (i >= 10) continue; const f = new Image(); f.alt = ''; foodEl.appendChild(f); foodImgs.push(f); }
const gritLevelEl = document.getElementById('gritLevel'), gritFillEl = document.getElementById('gritFill');
function setBar(imgs, v, full, half, empty) {
  for (let i = 0; i < imgs.length; i++) { const s = v >= (i + 1) * 2 ? full : v === i * 2 + 1 && half ? half : empty; if (imgs[i].src !== s) imgs[i].src = s; }
}
function clockText() {
  const f = B.dayFrac(g); const mins = Math.floor(((f * 24 + 6) % 24) * 60);
  return 'Day ' + g.day + ' · ' + String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}
function runTime(tick) { const s = Math.floor(tick / B.TPS); const h = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60; return (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); }
function updateHud() {
  const m = g.m;
  document.getElementById('clock').textContent = clockText();
  document.getElementById('sunIcon').className = B.isNight(g) ? 'moon' : '';
  const most = B.maxHp(m) / 2;
  for (let i = 10; i < heartImgs.length; i++) heartImgs[i].hidden = i >= most;
  setBar(heartImgs, Math.max(0, m.hp), icons.heart, icons.heartH, icons.heartE);
  gritLevelEl.textContent = B.gritLevel(m);
  gritFillEl.style.width = (B.gritProgress(m) * 100).toFixed(1) + '%';
  setBar(foodImgs, m.hunger, icons.food, icons.food, icons.foodE);
  const depth = Math.max(0, m.y - g.w.surf[m.x]);
  document.getElementById('depth').textContent = depth + ' m';
  document.getElementById('biome').textContent = B.inUnder(g) ? B.UNDER_BIOMES[g.w.biome[m.x]] : depth > 2 ? (m.y >= 96 ? 'Deep rock' : 'Underground') : B.BIOMES[g.w.biome[m.x]] + weatherLabel(g);
  document.getElementById('runtime').textContent = 'Run time ' + runTime(g.tick);
  const goalIdx = B.GOALS.findIndex(G => !G.done(g, m));
  document.getElementById('goal').textContent = m.journey ? journeyGoal(m.journey) : goalIdx >= 0 ? B.GOALS[goalIdx].label : 'Retired rich';
}
