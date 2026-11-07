// Burrow UI · replay.js — The replay, on computers: the miner's trail on the world map, with a timeline of big moments you can play, rewind and drag along.
// Reads stats.trail (see js/sim/trail.js). The map shows the land as it is now, and land the world has slid past is a plain strip of biome colours.
'use strict';

const REPLAY_RATE = 5, REPLAY_GAP = 60, REPLAY_TINTS = 48, REPLAY_MOST_ZOOM = 14;
const replayBox = document.getElementById('replayBox'), replayMap = document.getElementById('replayMap'), replayTrack = document.getElementById('replayTrack'), replayCard = document.getElementById('replayCard'), replayOpenBtn = document.getElementById('replayOpen');
const replayCtx = replayMap.getContext('2d');
const replayEl = id => document.getElementById(id);
const replayFits = () => matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth > 860;
const Replay = {
  open: false, p: null, n: 0, i: 0, dir: 1, rate: 1, playing: false, follow: true, s: 1, cx: 300, cy: 64, marks: [], last: 0, alt: null, altFor: null, drag: null, capT: 0, capI: -1,
  landAt: () => (g.m.journey ? g.m.journey.off : 0),
  dpr: () => Math.min(2, devicePixelRatio || 1),
  point(k) { const p = this.p, o = k * 4; return {t: p[o], at: p[o + 1], y: p[o + 2], r: p[o + 3]}; },
  indexAt(t) {
    let lo = 0, hi = this.n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.p[mid * 4] < t) lo = mid + 1; else hi = mid; }
    return lo;
  },
  day: t => Math.floor(t * 20 / B.DAY) + 1,
  buildMarks() {
    const s = g.stats, first = this.p[0], out = [];
    const add = (t, kind, title, page) => { if (t >= first) out.push({i: this.indexAt(t), t, kind, title, page}); };
    for (const p of s.book || []) add(p.t !== undefined ? p.t : (p.day - 1) * B.DAY / 20, p.kind, p.title, p.id);
    for (const r of s.road || []) if (r.kind === 'camp' && r.t !== undefined) add(r.t, 'camp', r.name);
    for (const t of s.koAt || []) add(t, 'ko', 'Knocked out');
    this.marks = out.sort((a, b) => a.i - b.i);
    replayTrack.querySelectorAll('.replay-mark').forEach(e => e.remove());
    this.marks.forEach((m, k) => {
      const b = document.createElement('button');
      b.className = 'replay-mark mark-' + m.kind; b.dataset.mark = k;
      b.style.left = (m.i / Math.max(1, this.n - 1) * 100) + '%';
      b.title = 'Day ' + this.day(m.t) + ': ' + m.title; b.setAttribute('aria-label', b.title);
      replayTrack.append(b);
    });
  },
  // the other side of the gate needs a map too
  otherMini() {
    if (!g.other) return null;
    const key = (g.realm || 'over') + g.seed;
    if (this.altFor !== key) {
      if (!this.alt) { const c = document.createElement('canvas'); c.width = c.height = 1; this.alt = new R.Renderer(c); }
      this.alt.rebuildMini(Object.assign({}, g, g.other, {realm: B.inUnder(g) ? 'over' : 'under', dirty: []}));
      this.altFor = key;
    }
    return this.alt.mini;
  },
  // the map for a realm, and whether it's still the one the trail walked on
  mapFor(r) {
    const deep = B.inUnder(g);
    if (!r) return deep ? this.otherMini() : (rd.updateMini(g), rd.mini);
    const w = deep ? g.w : g.other && g.other.w;
    if (!w || (w.era || 0) + 1 !== r) return null;
    if (deep) { rd.updateMini(g); return rd.mini; }
    return this.otherMini();
  },
  show() {
    const t = g.stats.trail || [];
    if (t.length < 80) { toast('The trail starts now. Give the miner a few minutes'); return; }
    this.p = Int32Array.from(t); this.n = t.length >> 2; this.i = this.n - 1;
    this.playing = false; this.dir = 1; this.rate = 1; this.follow = true; this.altFor = null;
    this.open = true; replayBox.hidden = false; this.card(null);
    this.resize(); this.fit(); this.buildMarks(); this.buttons();
    const a = this.point(this.n - 1); this.cx = a.at; this.cy = a.y;
    this.last = performance.now();
    requestAnimationFrame(n => this.frame(n));
  },
  close() { this.open = false; replayBox.hidden = true; },
  resize() {
    const dpr = this.dpr(), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (replayMap.width !== w || replayMap.height !== h) { replayMap.width = w; replayMap.height = h; }
  },
  fit() { this.s = Math.min(replayMap.width / B.W, (replayMap.height * 0.7) / B.H); },
  everything() {
    const r = this.p[Math.floor(this.i) * 4 + 3]; // the Underworld's blocks are counted separately, so one side of the gate at a time
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < this.n; k++) if (this.p[k * 4 + 3] === r) { const at = this.p[k * 4 + 1]; if (at < lo) lo = at; if (at > hi) hi = at; }
    if (!r) hi = Math.max(hi, this.landAt() + B.W);
    this.follow = false; this.cx = (lo + hi) / 2; this.cy = B.H / 2;
    this.s = Math.max(replayMap.width / (hi - lo + 40), 0.02);
    this.buttons();
  },
  zoom(by, x, y) {
    const lo = replayMap.width / 40000, hi = REPLAY_MOST_ZOOM * this.dpr(), old = this.s, s = Math.max(lo, Math.min(hi, old * by));
    if (x !== undefined && !this.follow) { this.cx += (x - replayMap.width / 2) * (1 / old - 1 / s); this.cy += (y - replayMap.height / 2) * (1 / old - 1 / s); }
    this.s = s;
  },
  play(dir) {
    if (this.playing && this.dir === dir) { this.playing = false; this.buttons(); return; }
    if (dir > 0 && this.i >= this.n - 1) this.i = 0;
    if (dir < 0 && this.i <= 0) this.i = this.n - 1;
    this.dir = dir; this.playing = true; this.capI = -1; this.buttons();
  },
  seek(i) { this.i = Math.max(0, Math.min(this.n - 1, i)); this.follow = true; this.buttons(); },
  buttons() {
    replayEl('replayPlay').textContent = this.playing && this.dir > 0 ? 'Pause' : 'Play';
    replayEl('replayBack').textContent = this.playing && this.dir < 0 ? 'Pause' : 'Rewind';
    for (const b of replayBox.querySelectorAll('[data-rate]')) b.setAttribute('aria-pressed', +b.dataset.rate === this.rate);
    replayEl('replayFollow').setAttribute('aria-pressed', this.follow);
  },
  card(m) {
    replayCard.hidden = !m;
    if (!m) return;
    const page = m.page && (g.stats.book || []).find(p => p.id === m.page), pic = page && Book.pics[page.id];
    replayCard.innerHTML = `${pic ? `<img src="${pic}" alt="">` : ''}<b>${esc(m.title)}</b><span>Day ${this.day(m.t)}</span>${page && page.text ? `<p>${esc(page.text)}</p>` : ''}
      <div>${page ? `<button data-open="${page.id}">Open in scrapbook</button>` : ''}<button data-shut="1">Close</button></div>`;
  },
  drawOldLand(ctx, X, Y, s) {
    const road = g.stats.road || [], land = this.landAt(), top = Y(0), bottom = Y(B.H), ground = Y(g.w.surf ? B.inUnder(g) ? 50 : g.w.surf[0] : 50);
    if (!road.length || road[0].at >= land) return;
    ctx.fillStyle = '#26364d'; ctx.fillRect(X(road[0].at), top, X(land) - X(road[0].at), ground - top);
    ctx.fillStyle = '#25252e'; ctx.fillRect(X(road[0].at), ground, X(land) - X(road[0].at), bottom - ground);
    road.forEach((p, k) => {
      if (p.at >= land) return;
      const to = Math.min(land, road[k + 1] ? road[k + 1].at : land);
      ctx.fillStyle = BOOK_BIOME[p.biome] || '#777'; ctx.fillRect(X(p.at), ground, X(to) - X(p.at) + 1, Math.max(2, 3 * s));
    });
  },
  drawTrail(ctx, X, Y, r, idx, dpr) {
    const p = this.p, n = this.n, W0 = replayMap.width, lw = Math.max(1.5, Math.min(3, this.s / 2)) * dpr;
    const each = Math.max(1, Math.ceil(n / REPLAY_TINTS));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const run = (from, to, style, width) => {
      ctx.strokeStyle = style; ctx.lineWidth = width; ctx.beginPath();
      let pen = false;
      for (let k = from; k < to; k++) {
        const a = k * 4, b = a + 4;
        if (p[a + 3] !== r || p[b + 3] !== r || Math.abs(p[b + 1] - p[a + 1]) + Math.abs(p[b + 2] - p[a + 2]) > REPLAY_GAP) { pen = false; continue; }
        const x0 = X(p[a + 1]), x1 = X(p[b + 1]);
        if ((x0 < -20 && x1 < -20) || (x0 > W0 + 20 && x1 > W0 + 20)) { pen = false; continue; }
        if (!pen) { ctx.moveTo(x0, Y(p[a + 2] - 1)); pen = true; }
        ctx.lineTo(x1, Y(p[b + 2] - 1));
      }
      ctx.stroke();
    };
    if (idx < n - 1) run(idx, n - 1, 'rgba(255,255,255,0.16)', lw);
    for (let k = 0; k < idx; k += each) {
      const f = k / Math.max(1, n - 1), hue = 200 - f * 160; // old blue through to the lamp's amber
      run(k, Math.min(idx, k + each), `hsl(${hue} 90% ${58 + f * 8}%)`, lw);
    }
  },
  drawMarks(ctx, X, Y, r, idx, dpr) {
    for (const m of this.marks) {
      if (m.i > idx) break;
      const a = this.point(m.i);
      if (a.r !== r) continue;
      const x = X(a.at), y = Y(a.y - 1), c = {ko: '#ff6a5a', camp: '#ffc24a', keep: '#ffc24a', village: '#7fe0a0', ruin: '#b5a89a'}[m.kind] || '#e8e4f0';
      ctx.fillStyle = '#0d0f17'; ctx.fillRect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr);
      ctx.fillStyle = c; ctx.fillRect(x - 3 * dpr, y - 3 * dpr, 6 * dpr, 6 * dpr);
    }
  },
  caption(idx, now) {
    const pass = this.marks.filter(m => m.i <= idx).pop();
    if (pass && pass.i !== this.capI && this.playing) { this.capI = pass.i; this.capT = now + 2600; replayEl('replayCap').textContent = pass.title; }
    replayEl('replayCap').classList.toggle('on', now < this.capT);
  },
  frame(now) {
    if (!this.open) return;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.playing) {
      this.i += this.dir * this.rate * REPLAY_RATE * dt;
      if (this.i >= this.n - 1 || this.i <= 0) { this.i = Math.max(0, Math.min(this.n - 1, this.i)); this.playing = false; this.buttons(); }
    }
    this.resize();
    const dpr = this.dpr(), idx = Math.floor(this.i), a = this.point(idx), b = this.point(Math.min(this.n - 1, idx + 1)), f = this.i - idx;
    const near = a.r === b.r && Math.abs(a.at - b.at) + Math.abs(a.y - b.y) <= REPLAY_GAP;
    const px = near ? a.at + (b.at - a.at) * f : a.at, py = near ? a.y + (b.y - a.y) * f : a.y;
    if (this.follow) {
      const jump = Math.abs(px - this.cx) > replayMap.width / this.s, ease = jump ? 1 : 1 - Math.pow(0.002, dt);
      this.cx += (px - this.cx) * ease; this.cy += (py - this.cy) * ease;
      if (this.s * B.H <= replayMap.height * 0.8) this.cy = B.H / 2;
    }
    const ctx = replayCtx, VW = replayMap.width, VH = replayMap.height - 120 * dpr, s = this.s;
    const X = at => (at - this.cx) * s + VW / 2, Y = y => (y - this.cy) * s + VH / 2;
    ctx.fillStyle = '#0d0f17'; ctx.fillRect(0, 0, VW, replayMap.height);
    ctx.imageSmoothingEnabled = false;
    if (!a.r) this.drawOldLand(ctx, X, Y, s);
    const mini = this.mapFor(a.r), land = a.r ? 0 : this.landAt();
    if (mini) ctx.drawImage(mini, X(land), Y(0), B.W * s, B.H * s);
    this.drawTrail(ctx, X, Y, a.r, idx, dpr);
    this.drawMarks(ctx, X, Y, a.r, idx, dpr);
    const mx = X(px + 0.5), my = Y(py - 1), pulse = 3 + Math.sin(now / 200) * 1.5;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(mx, my, (6 + pulse) * dpr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(mx - 2 * dpr, my - 2 * dpr, 4 * dpr, 4 * dpr);
    const pct = (this.i / Math.max(1, this.n - 1) * 100) + '%';
    replayEl('replayFill').style.width = pct; replayEl('replayHead').style.left = pct;
    replayEl('replayDay').textContent = 'Day ' + this.day(a.t);
    replayEl('replayWhere').textContent = a.r ? 'The Underworld' : a.at.toLocaleString() + ' blocks along the road';
    this.caption(idx, now);
    requestAnimationFrame(n => this.frame(n));
  }
};
if (replayFits()) replayOpenBtn.hidden = false;
addEventListener('resize', () => { replayOpenBtn.hidden = !replayFits(); if (Replay.open && !replayFits()) Replay.close(); });
replayOpenBtn.addEventListener('click', () => Replay.show());
replayBox.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'replayClose') Replay.close();
  else if (b.id === 'replayPlay') Replay.play(1);
  else if (b.id === 'replayBack') Replay.play(-1);
  else if (b.id === 'replayFollow') { Replay.follow = !Replay.follow; Replay.buttons(); }
  else if (b.id === 'replayIn') Replay.zoom(1.5);
  else if (b.id === 'replayOut') Replay.zoom(1 / 1.5);
  else if (b.id === 'replayAll') Replay.everything();
  else if (b.dataset.rate) { Replay.rate = +b.dataset.rate; Replay.buttons(); }
  else if (b.dataset.mark) { const m = Replay.marks[+b.dataset.mark]; Replay.playing = false; Replay.seek(m.i); Replay.card(m); }
  else if (b.dataset.shut) Replay.card(null);
  else if (b.dataset.open) { Book.page = +b.dataset.open; Book.view = 'album'; Book.show(); Book.page = +b.dataset.open; Book.render(); }
});
const replayTrackAt = e => { const r = replayTrack.getBoundingClientRect(); Replay.seek((e.clientX - r.left) / r.width * (Replay.n - 1)); };
replayTrack.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; Replay.scrub = true; Replay.playing = false; replayTrack.setPointerCapture(e.pointerId); replayTrackAt(e); });
replayTrack.addEventListener('pointermove', e => { if (Replay.scrub) replayTrackAt(e); });
replayTrack.addEventListener('pointerup', () => { Replay.scrub = false; });
replayMap.addEventListener('pointerdown', e => { Replay.drag = {x: e.clientX, y: e.clientY}; replayMap.setPointerCapture(e.pointerId); });
replayMap.addEventListener('pointermove', e => {
  const d = Replay.drag;
  if (!d) return;
  const dpr = Replay.dpr();
  Replay.cx -= (e.clientX - d.x) * dpr / Replay.s; Replay.cy -= (e.clientY - d.y) * dpr / Replay.s;
  d.x = e.clientX; d.y = e.clientY;
  if (Replay.follow) { Replay.follow = false; Replay.buttons(); }
});
replayMap.addEventListener('pointerup', () => { Replay.drag = null; });
replayMap.addEventListener('wheel', e => { e.preventDefault(); const dpr = Replay.dpr(); Replay.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX * dpr, e.clientY * dpr); }, {passive: false});
addEventListener('keydown', e => {
  if (!Replay.open || document.getElementById('bookBox').classList.contains('show')) return;
  e.stopPropagation();
  if (e.key === 'Escape' || e.key === 't' || e.key === 'T') Replay.close();
  else if (e.code === 'Space') { e.preventDefault(); Replay.play(1); }
  else if (e.key === 'ArrowLeft') Replay.seek(Replay.i - Replay.n / 50);
  else if (e.key === 'ArrowRight') Replay.seek(Replay.i + Replay.n / 50);
  else if (e.key === '+' || e.key === '=') Replay.zoom(1.5);
  else if (e.key === '-') Replay.zoom(1 / 1.5);
  else if (e.key >= '1' && e.key <= '4') { Replay.rate = [1, 2, 4, 8][+e.key - 1]; Replay.buttons(); }
}, true);
