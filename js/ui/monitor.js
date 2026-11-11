// Burrow UI · monitor.js — "Under the hood": a panel showing what goes on behind the picture.
// Plain script: shares the global scope. Opens from the FPS badge or the U key (prefs.monitor).
// Frame time split into the game's thinking and the drawing, memory, how much room the saves take,
// and what the world is busy with. main.js hands it each frame's timings (Monitor.frame); nothing here
// touches the sim's state, it only reads it.
'use strict';

const Monitor = (() => {
  const N = 240; // frames kept for the graph (about 4 seconds at 60)
  const simA = new Float32Array(N), drawA = new Float32Array(N), allA = new Float32Array(N);
  let at = 0;
  const memA = []; // one reading every half second, the last two minutes
  const madeA = []; // pictures made, one count every half second
  let box = null, el = {}, open = false, textT = 0, storeT = -1e9, storeInfo = null, lastMade = 0;
  const paths = {n: 0, ms: 0, worst: 0, list: []}; // path searches in the last ten seconds

  // count and time the miner's path searches (the slowest part of its thinking)
  if (typeof findPath === 'function') {
    const real = findPath;
    window.findPath = function (...a) {
      const t = performance.now(), r = real.apply(this, a), d = performance.now() - t;
      paths.list.push(t, d);
      return r;
    };
  }

  const kb = n => n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';
  const ms = n => n < 10 ? n.toFixed(1) : Math.round(n) + '';

  function build() {
    box = document.createElement('div');
    box.className = 'monitor'; box.hidden = true; box.setAttribute('aria-label', 'Under the hood');
    box.innerHTML = `
      <div class="mon-head"><span class="mon-title">Under the hood</span><button class="mon-close" aria-label="Close" title="Close (U)">×</button></div>
      <section><div class="mon-row"><span class="mon-label">Frame</span><span class="mon-big" data-k="fps">–</span></div>
        <canvas data-k="frameCv" width="300" height="64"></canvas>
        <div class="mon-key"><i class="k-sim"></i>Thinking <b data-k="sim">–</b> <i class="k-draw"></i>Drawing <b data-k="draw">–</b> <i class="k-other"></i>Spare <b data-k="other">–</b> ms</div>
        <div class="mon-small" data-k="ticks"></div></section>
      <section><div class="mon-row"><span class="mon-label">Memory</span><span class="mon-big" data-k="mem">–</span></div>
        <canvas data-k="memCv" width="300" height="44"></canvas>
        <div class="mon-small" data-k="memNote"></div>
        <div class="mon-small" data-k="bufs"></div>
        <div class="mon-small" data-k="made"></div></section>
      <section><div class="mon-row"><span class="mon-label">Saved games</span><span class="mon-big" data-k="saveTot">–</span></div>
        <div class="mon-bar" data-k="saveBar"></div>
        <div class="mon-small" data-k="saveList"></div></section>
      <section><div class="mon-row"><span class="mon-label">The world</span></div>
        <div class="mon-grid" data-k="world"></div></section>`;
    document.body.appendChild(box);
    box.querySelectorAll('[data-k]').forEach(n => { el[n.dataset.k] = n; });
    box.querySelector('.mon-close').addEventListener('click', () => toggle(false));
    // drag it about by the title bar; where it was left is remembered
    const head = box.querySelector('.mon-head');
    let grab = null;
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('.mon-close')) return;
      const r = box.getBoundingClientRect();
      grab = {dx: e.clientX - r.left, dy: e.clientY - r.top}; head.setPointerCapture(e.pointerId); head.classList.add('grabbing'); e.preventDefault();
    });
    head.addEventListener('pointermove', e => { if (grab) place(e.clientX - grab.dx, e.clientY - grab.dy); });
    const drop = () => { if (!grab) return; grab = null; head.classList.remove('grabbing'); const r = box.getBoundingClientRect(); prefs.monPos = {x: Math.round(r.left), y: Math.round(r.top)}; savePrefs(); };
    head.addEventListener('pointerup', drop); head.addEventListener('pointercancel', drop);
    addEventListener('resize', () => { if (prefs.monPos) place(prefs.monPos.x, prefs.monPos.y); });
  }
  // kept on the screen: at least the title bar stays where it can be grabbed
  function place(x, y) {
    const w = box.offsetWidth || 332;
    x = Math.max(8, Math.min(innerWidth - w - 8, x)); y = Math.max(8, Math.min(innerHeight - 48, y));
    box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.transform = 'none'; box.style.maxHeight = Math.max(120, innerHeight - y - 12) + 'px'; // scrolls inside rather than running off the bottom
  }

  function toggle(on) {
    if (!box) build();
    open = on === undefined ? !open : !!on;
    box.hidden = !open;
    if (open && prefs.monPos) place(prefs.monPos.x, prefs.monPos.y); // back where it was left
    prefs.monitor = open; savePrefs();
    if (open) { storeT = -1e9; textT = 1; if (!madeA.length) lastMade = canvasMade; } // the start-up art doesn't count
  }

  // how much room each kind of save takes (text characters: a browser lets a site keep about five million)
  function storage() {
    const kinds = {world: 0, book: 0, slots: 0, other: 0}, n = localStorage.length;
    for (let i = 0; i < n; i++) {
      const k = localStorage.key(i); if (!k || !k.startsWith('burrow.')) continue;
      const v = localStorage.getItem(k) || '', len = k.length + v.length;
      if (k === SAVE) kinds.world += len;
      else if (k.startsWith('burrow.book')) kinds.book += len;
      else if (k.startsWith('burrow.slot')) kinds.slots += len;
      else kinds.other += len;
    }
    return kinds;
  }

  // the drawing's own working pictures and buffers: what the renderer holds on to right now
  function bufferBytes() {
    let b = cv.width * cv.height * 4;
    for (const v of Object.values(rd)) {
      if (!v) continue;
      if (v instanceof HTMLCanvasElement) b += v.width * v.height * 4;
      else if (v instanceof ImageData) b += v.data.length;
      else if (ArrayBuffer.isView(v)) b += v.byteLength;
    }
    return b;
  }

  function drawFrameGraph() {
    const c = el.frameCv, x = c.getContext('2d'), w = c.width, h = c.height, top = 50; // ms at the top of the graph
    x.clearRect(0, 0, w, h);
    const bw = w / N, y = v => h - Math.min(h, v / top * h);
    for (let i = 0; i < N; i++) {
      const k = (at + i) % N, s = simA[k], d = drawA[k], a = allA[k];
      if (!a) continue;
      const px = i * bw;
      x.fillStyle = '#3a3d52'; x.fillRect(px, y(a), bw + 0.5, h - y(a));
      x.fillStyle = '#4fe0d6'; x.fillRect(px, y(s + d), bw + 0.5, h - y(s + d));
      x.fillStyle = '#f2b84b'; x.fillRect(px, y(s), bw + 0.5, h - y(s));
    }
    x.fillStyle = '#ece6d655'; x.font = '9px sans-serif';
    for (const [v, label] of [[1000 / 60, '60 fps'], [1000 / 30, '30 fps']]) { x.fillRect(0, Math.round(y(v)), w, 1); x.fillText(label, w - 34, y(v) - 2); }
  }
  function drawMemGraph() {
    const c = el.memCv, x = c.getContext('2d'), w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    if (memA.length < 2) return;
    const hi = Math.max(...memA) * 1.15, lo = 0, step = w / 239;
    x.beginPath();
    memA.forEach((v, i) => { const px = w - (memA.length - 1 - i) * step, py = h - (v - lo) / (hi - lo) * h; i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.strokeStyle = '#7fd18b'; x.lineWidth = 1.5; x.stroke();
    x.lineTo(w, h); x.lineTo(w - (memA.length - 1) * step, h); x.closePath(); x.fillStyle = '#7fd18b22'; x.fill();
    // pictures made each half second, as ticks along the bottom: a steady stream here is waste
    x.fillStyle = '#ff6b6b';
    madeA.forEach((v, i) => { if (v) x.fillRect(w - (madeA.length - 1 - i) * step - 1, h - Math.min(h, 3 + v * 2), 2, Math.min(h, 3 + v * 2)); });
  }

  function text(now) {
    // frame
    let s = 0, d = 0, a = 0, cnt = 0;
    for (let i = 0; i < N; i++) if (allA[i]) { s += simA[i]; d += drawA[i]; a += allA[i]; cnt++; }
    if (cnt) {
      const fps = Math.round(1000 / (a / cnt));
      el.fps.textContent = fps + ' FPS'; el.fps.className = 'mon-big ' + (fps >= 50 ? 'good' : fps >= 30 ? 'mid' : 'low');
      el.sim.textContent = ms(s / cnt); el.draw.textContent = ms(d / cnt); el.other.textContent = ms(Math.max(0, (a - s - d) / cnt));
    }
    el.ticks.textContent = `${paused ? 'Paused' : speed + '× speed'} · ${ms(tickAvg)} ticks a frame · ${cv.width}×${cv.height} picture · effects ${PostFx.on ? 'on' : 'off'}`;
    // memory
    const heap = performance.memory ? performance.memory.usedJSHeapSize : null, bufs = bufferBytes();
    memA.push(heap || bufs); if (memA.length > 240) memA.shift();
    const made = canvasMade - lastMade; lastMade = canvasMade;
    madeA.push(made); if (madeA.length > 240) madeA.shift();
    el.mem.textContent = heap ? kb(heap) : kb(bufs);
    el.memNote.textContent = heap ? 'Game memory (green line), the last two minutes' : 'Safari and the Mac app keep game memory to themselves: the line shows the drawing’s working pictures';
    el.bufs.textContent = `Working pictures and lighting: ${kb(bufs)}`;
    const recent = madeA.slice(-20).reduce((p, v) => p + v, 0);
    el.made.innerHTML = `Pictures made: ${canvasMade} since opening, <span class="${recent > 6 ? 'bad' : ''}">${recent} in the last ten seconds</span> (red ticks)`;
    // saves, every five seconds (reading them is not free)
    if (now - storeT > 5000) { storeT = now; storeInfo = storage(); }
    if (storeInfo) {
      const tot = storeInfo.world + storeInfo.book + storeInfo.slots + storeInfo.other, app = !!window.BurrowApp, limit = 5e6;
      el.saveTot.textContent = kb(tot);
      const part = (v, c) => `<span style="width:${Math.min(100, v / (app ? Math.max(tot, 1) : limit) * 100)}%;background:${c}"></span>`;
      el.saveBar.innerHTML = part(storeInfo.world, '#f2b84b') + part(storeInfo.book, '#4fe0d6') + part(storeInfo.slots, '#b48cf2') + part(storeInfo.other, '#9a96a8');
      el.saveList.innerHTML = `<i class="k" style="background:#f2b84b"></i>This world ${kb(storeInfo.world)} <i class="k" style="background:#4fe0d6"></i>Scrapbooks ${kb(storeInfo.book)} <i class="k" style="background:#b48cf2"></i>Named saves ${kb(storeInfo.slots)}<br>` +
        (app ? 'Kept as files on the Mac: no limit' : `A browser keeps about 5 MB for a site: <b class="${tot > limit * 0.8 ? 'bad' : tot > limit * 0.6 ? 'mid' : 'good'}">${Math.round(tot / limit * 100)}% used</b>. The scrapbook gives up old pictures first when it fills`);
    }
    // the world
    const cut = now - 10000; while (paths.list.length && paths.list[0] < cut) paths.list.splice(0, 2);
    let pn = 0, pms = 0, worst = 0; for (let i = 0; i < paths.list.length; i += 2) { pn++; pms += paths.list[i + 1]; worst = Math.max(worst, paths.list[i + 1]); }
    const f = g.fluid || {}, size = x => x ? x.size || 0 : 0;
    const rows = [
      ['Monsters', g.monsters.length], ['Animals', g.critters.length], ['Arrows', g.arrows.length], ['Sparks and bits', g.fx.length],
      ['Water moving', size(f.water)], ['Lava moving', size(f.lava)], ['Sand falling', size(f.sand)], ['Sounds waiting', g.sfx.length],
      ['Path searches (10 s)', pn], ['Their time', ms(pms) + ' ms'], ['Slowest search', `<span class="${worst > 16 ? 'bad' : worst > 6 ? 'mid' : ''}">${ms(worst)} ms</span>`], ['Journal entries', g.log.length]
    ];
    el.world.innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
  }

  let tickAvg = 0;
  return {
    toggle,
    get open() { return open; },
    // each frame: how long it took in all, the game's thinking, the drawing, and how many ticks ran
    frame(rawMs, simMs, drawMs, ticks, now) {
      tickAvg += (ticks - tickAvg) * 0.05;
      if (!open) return;
      simA[at] = simMs; drawA[at] = drawMs; allA[at] = Math.min(250, rawMs); at = (at + 1) % N;
      drawFrameGraph();
      textT += rawMs;
      if (textT >= 500) { textT = 0; text(now); drawMemGraph(); }
    }
  };
})();
if (prefs.monitor) Monitor.toggle(true);
