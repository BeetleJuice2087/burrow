// Burrow UI · audio.js — synthesized sound effects and ambience (Web Audio, no sound files).
// The sim pushes events into g.sfx; Sound.update() drains them each frame and plays them,
// quieter the farther they are from the camera. Everything lives on the one `Sound` object.
'use strict';

const RAIN_HEARD_AT = 2, RAIN_FADE_OVER = 20; // blocks below ground: where rain starts to fade, and how far down it's gone
const Sound = (function () {
  let ctx = null, master, sfxBus, ambBus, noiseBuf, on = false;
  const amb = {};
  const lastPlayed = {};
  let envT = 0, env = {surface: 1, night: 0, lava: 0, water: 0, deep: 0};
  let nextBird = 0, nextCricket = 0, nextDrip = 0, nextPop = 0;

  const MAT = {};
  (function () {
    const T = Burrow.T;
    for (const t of [T.STONE, T.DEEP, T.COBBLE, T.MOSSY, T.SANDSTONE, T.BEDROCK, T.OBSIDIAN, T.COAL, T.COPPER, T.IRON, T.GOLD, T.GEM, T.FURNACE,
      T.STONE_BRICKS, T.SMOOTH_STONE, T.STONE_TILE, T.CUT_SANDSTONE, T.CHISELED_SANDSTONE, T.SMOOTH_SANDSTONE, T.STONECUTTER, T.SMOKER, T.BLAST_FURNACE,
      T.ANVIL, T.CAULDRON, T.IRON_BARS, T.IRON_DOOR, T.COAL_BLOCK, T.COPPER_BLOCK, T.IRON_BLOCK, T.GOLD_BLOCK, T.GEM_BLOCK, T.GLASS, T.GLASS_PANE, T.HOPPER]) MAT[t] = 'stone';
    for (const t of [T.DIRT, T.GRASS, T.SNOW]) MAT[t] = 'dirt';
    MAT[T.SAND] = 'sand';
    for (const t of [T.LOG, T.PLANKS, T.BENCH, T.DOOR, T.CHEST, T.BED, T.SIGN, T.FENCE, T.FENCE_GATE, T.WOOD_STAIRS, T.WOOD_SLAB, T.LADDER, T.TRAPDOOR, T.COPPER_CHEST, T.CAMPFIRE]) MAT[t] = 'wood';
    for (const t of [T.LEAVES, T.PINE, T.BUSH, T.BUSHE, T.TGRASS, T.FLOWER, T.CACTUS, T.EMBERCAP, T.EMBERLEAF]) MAT[t] = 'leaf';
    for (const t of [T.ASHROCK, T.CINDERITE, T.VAULT_BRICK, T.SHARDROCK, T.BONE, T.WARDSTONE]) MAT[t] = 'ash';
    MAT[T.GLIMMER] = 'stone'; MAT[T.CHARWOOD] = 'wood'; // the Underworld: dull, crumbly, hot
  })();

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.9; ambBus.connect(master);
    // 2 seconds of white noise, reused everywhere
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // continuous ambience layers
    amb.wind = loopNoise('lowpass', 380, 0.7);
    amb.cave = loopNoise('lowpass', 110, 0.9);
    amb.lava = loopNoise('lowpass', 220, 1.2);
    amb.water = loopNoise('bandpass', 1400, 0.8);
    amb.rain = loopNoise('highpass', 1800, 0.4);
    amb.gate = loopHum([[110, 'sine', 1], [111.3, 'sine', 0.8], [165, 'triangle', 0.3]]);
    return true;
  }
  function loopNoise(type, freq, q) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gn = ctx.createGain(); gn.gain.value = 0;
    src.connect(f); f.connect(gn); gn.connect(ambBus); src.start();
    return {gain: gn, filter: f};
  }

  // ---- building blocks ----
  // steady tones instead of noise; two close together slowly throb against each other
  function loopHum(voices) {
    const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    gain.gain.value = 0; filter.type = 'lowpass'; filter.frequency.value = 420;
    for (const [freq, type, level] of voices) {
      const o = ctx.createOscillator(), v = ctx.createGain();
      o.type = type; o.frequency.value = freq; v.gain.value = level;
      o.connect(v); v.connect(filter); o.start();
    }
    filter.connect(gain); gain.connect(ambBus);
    return {gain, filter};
  }
  function noise(t0, dur, type, freq, q, vol, bus, freqEnd) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q || 1;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.01, dur / 4));
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(gn); gn.connect(bus || sfxBus);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
  }
  function tone(t0, dur, type, f0, f1, vol, bus, attack) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + (attack || 0.005));
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(bus || sfxBus); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const jit = (v, p) => v * (1 + (Math.random() - 0.5) * p);

  // ---- the sounds ----
  function hit(t, mat, v, hard) {
    const k = hard ? 1.6 : 1;
    if (mat === 'stone') { noise(t, 0.05 * k, 'bandpass', jit(1900, 0.3), 3, 0.5 * v); tone(t, 0.03, 'square', jit(880, 0.2), 600, 0.06 * v); }
    else if (mat === 'ash') { tone(t, 0.09 * k, 'sine', jit(135, 0.2), 80, 0.4 * v); noise(t, 0.08 * k, 'lowpass', jit(480, 0.3), 1.2, 0.5 * v); noise(t + 0.015, 0.05, 'bandpass', jit(2600, 0.4), 2, 0.1 * v); }
    else if (mat === 'dirt') noise(t, 0.07 * k, 'lowpass', jit(650, 0.3), 1, 0.55 * v);
    else if (mat === 'sand') noise(t, 0.09 * k, 'bandpass', jit(3000, 0.3), 0.8, 0.3 * v);
    else if (mat === 'wood') { tone(t, 0.08 * k, 'triangle', jit(240, 0.2), 170, 0.35 * v); noise(t, 0.05, 'bandpass', 900, 2, 0.25 * v); }
    else noise(t, 0.05 * k, 'highpass', jit(3200, 0.3), 0.7, 0.18 * v);
  }
  function brk(t, tile, v) {
    const mat = MAT[tile] || 'stone';
    hit(t, mat, v * 1.2, true);
    for (let i = 1; i <= 3; i++) noise(t + i * 0.035, 0.04, mat === 'leaf' ? 'highpass' : 'lowpass', mat === 'stone' ? 1400 : mat === 'ash' ? 420 : 700, 1, 0.2 * v / i);
    const T = Burrow.T;
    if (tile === T.CINDERITE) { // ore down here: embers crackling instead of a sparkle
      for (let i = 0; i < 5; i++) noise(t + 0.05 + i * 0.05 + Math.random() * 0.03, 0.025, 'bandpass', jit(3400, 0.5), 5, 0.22 * v);
      tone(t + 0.04, 0.3, 'sawtooth', 95, 55, 0.06 * v);
    }
    if (tile === T.GOLD || tile === T.GEM || tile === T.IRON || tile === T.COPPER || tile === T.GLIMMER) { // ore: a little sparkle
      const base = tile === T.GEM ? 1320 : tile === T.GLIMMER ? 1568 : tile === T.GOLD ? 1046 : 880;
      [1, 1.26, 1.5].forEach((m, i) => tone(t + 0.06 + i * 0.06, 0.25, 'sine', base * m, base * m, 0.12 * v));
    }
  }
  const PLAY = {
    gate: (t, e, v) => { // sucked in, then spat out the far side
      noise(t, 0.55, 'bandpass', 300, 2.5, 0.5, undefined, 2600);
      tone(t, 0.5, 'sawtooth', 90, 620, 0.12);
      tone(t + 0.42, 0.7, 'sine', 520, 70, 0.3);
      noise(t + 0.45, 0.6, 'lowpass', 900, 1, 0.35, undefined, 120);
    },
    trade: (t, e, v) => { for (let i = 0; i < 3; i++) tone(t + i * 0.08, 0.14, 'triangle', 1500 + i * 420, 1500 + i * 420, 0.14 * v); },
    hit: (t, e, v) => hit(t, MAT[e.v] || 'stone', v),
    break: (t, e, v) => brk(t, e.v, v),
    step: (t, e, v) => { const mat = MAT[e.v] || 'dirt'; noise(t, 0.045, mat === 'stone' ? 'bandpass' : 'lowpass', mat === 'stone' ? 1500 : mat === 'sand' ? 2600 : mat === 'ash' ? 330 : 500, 1.2, 0.09 * v); },
    land: (t, e, v) => { tone(t, 0.14, 'sine', 110, 48, 0.5 * v); noise(t, 0.08, 'lowpass', 400, 1, 0.3 * v); },
    place: (t, e, v) => { tone(t, 0.07, 'triangle', jit(190, 0.1), 140, 0.3 * v); noise(t, 0.05, 'lowpass', 900, 1, 0.3 * v); },
    craft: (t, e, v) => { tone(t, 0.06, 'triangle', 300, 260, 0.25 * v); tone(t + 0.12, 0.06, 'triangle', 330, 280, 0.25 * v); tone(t + 0.28, 0.35, 'sine', 784, 784, 0.12 * v); tone(t + 0.36, 0.4, 'sine', 1046, 1046, 0.1 * v); },
    smelt: (t, e, v) => { noise(t, 0.35, 'bandpass', 300, 2, 0.35 * v, null, 1400); tone(t, 0.5, 'sawtooth', 70, 60, 0.05 * v); },
    eat: (t, e, v) => { for (let i = 0; i < 3; i++) noise(t + i * 0.13, 0.06, 'bandpass', jit(1700, 0.3), 2, 0.35 * v); },
    hurt: (t, e, v) => { tone(t, 0.13, 'square', 260, 150, 0.12 * v); noise(t, 0.08, 'lowpass', 800, 1, 0.3 * v); },
    ko: (t, e, v) => { [440, 349, 262, 196].forEach((f, i) => tone(t + i * 0.16, 0.22, 'triangle', f, f * 0.97, 0.18)); },
    mhit: (t, e, v) => { noise(t, 0.06, 'bandpass', 700, 1.5, 0.45 * v); tone(t, 0.08, 'square', 160, 110, 0.08 * v); },
    hiss: (t, e, v) => { noise(t, 0.28, 'highpass', 3400, 1, 0.16 * v, null, 2200); noise(t + 0.03, 0.12, 'bandpass', 900, 3, 0.1 * v); },
    skitter: (t, e, v) => { for (let i = 0; i < 3; i++) noise(t + i * 0.035, 0.018, 'bandpass', jit(4200, 0.25), 3, 0.09 * v); },
    fizz: (t, e, v) => { noise(t, 0.5, 'highpass', 2600, 1, 0.14 * v, null, 5200); tone(t, 0.5, 'triangle', 300, 760, 0.05 * v); },
    blast: (t, e, v) => { noise(t, 0.35, 'lowpass', 520, 0.7, 1 * v, null, 160); noise(t + 0.03, 1.7, 'lowpass', 300, 0.7, 0.75 * v, null, 45); tone(t, 1.1, 'sine', 78, 26, 0.5 * v, null, 0.015); }, // a deep thump that rolls away: anything sharp up top makes it a balloon
    mdie: (t, e, v) => { tone(t, 0.35, 'sawtooth', 220, 60, 0.12 * v); noise(t + 0.05, 0.3, 'lowpass', 1200, 1, 0.3 * v, null, 200); },
    growl: (t, e, v) => {
      if (e.v === 'crawler') { for (let i = 0; i < 6; i++) noise(t + i * 0.045, 0.02, 'bandpass', 3500, 6, 0.3 * v); }
      else if (e.v === 'archer' || e.v === 'ashcaster') noise(t, 0.6, 'bandpass', 900, 6, 0.25 * v, null, 1800);
      else if (e.v === 'warden') { tone(t, 1.1, 'sawtooth', 62, 34, 0.2 * v, null, 0.1); noise(t, 0.9, 'lowpass', 240, 1, 0.3 * v); }
      else { tone(t, 0.55, 'sawtooth', 85, 62, 0.1 * v, null, 0.08); noise(t, 0.5, 'lowpass', 300, 1, 0.2 * v); }
    },
    bow: (t, e, v) => { tone(t, 0.12, 'triangle', 620, 300, 0.2 * v); noise(t, 0.04, 'highpass', 2500, 1, 0.15 * v); },
    coo: (t, e, v) => { tone(t, 0.09, 'sine', 520, 470, 0.15 * v); tone(t + 0.11, 0.12, 'sine', 470, 400, 0.13 * v); },
    snap: (t, e, v) => { noise(t, 0.12, 'highpass', 2200, 1, 0.4 * v); tone(t, 0.25, 'square', 520, 140, 0.1 * v); tone(t + 0.1, 0.2, 'triangle', 300, 120, 0.12 * v); },
    cast: (t, e, v) => { noise(t, 0.2, 'highpass', 2800, 0.8, 0.14 * v, null, 900); noise(t + 0.3, 0.08, 'bandpass', 900, 1.5, 0.12 * v); },
    splash: (t, e, v) => { noise(t, 0.18, 'bandpass', 1300, 1, 0.3 * v, null, 500); tone(t, 0.1, 'sine', 500, 900, 0.07 * v); },
    torch: (t, e, v) => noise(t, 0.18, 'bandpass', 500, 1.5, 0.25 * v, null, 1200),
    sizzle: (t, e, v) => noise(t, 0.6, 'highpass', 4000, 0.7, 0.3 * v),
    bell: (t) => { [0, 0.42].forEach((d, i) => { tone(t + d, 1.1, 'sine', 660 - i * 80, 660 - i * 80, 0.09); tone(t + d, 0.5, 'triangle', 1320 - i * 160, 1320 - i * 160, 0.03); }); },
    level: (t) => { [392, 523, 659].forEach((f, i) => tone(t + i * 0.07, 0.3, 'triangle', f, f, 0.1)); tone(t + 0.2, 0.7, 'sine', 1046, 1046, 0.06); },
    milestone: (t) => { [523, 659, 784, 1046].forEach((f, i) => { tone(t + i * 0.09, 0.5, 'sine', f, f, 0.14); tone(t + i * 0.09, 0.3, 'triangle', f * 2, f * 2, 0.03); }); }
  };
  // minimum gap between two plays of the same sound (seconds), so 8× speed doesn't turn into static
  const GAP = {hit: 0.06, step: 0.09, break: 0.05, place: 0.06, growl: 0.4, skitter: 0.14, hiss: 0.3, coo: 0.2, sizzle: 0.3, milestone: 0.6, eat: 0.3};

  function update(g, cam, opts) {
    if (!on || !ctx) return;
    const now = ctx.currentTime;
    const list = g.sfx; g.sfx = [];
    if (opts.paused) return;
    let played = 0;
    for (const e of list) {
      if (played > 6) break;
      if (e.type === 'step' && opts.speed >= 4) continue;
      const f = PLAY[e.type]; if (!f) continue;
      let v = 1;
      if (e.type !== 'milestone' && e.type !== 'ko' && e.type !== 'gate') {
        if (opts.world) continue;
        const d = Math.hypot(e.x - cam.x, (e.y - cam.y) * 1.3);
        v = Math.max(0, 1 - d / 26); if (v < 0.05) continue;
      }
      const gap = GAP[e.type] || 0.03;
      if (lastPlayed[e.type] && now - lastPlayed[e.type] < gap) continue;
      lastPlayed[e.type] = now;
      f(now + 0.01, e, v); played++;
    }
    ambience(g, now, opts);
  }

  function ambience(g, now, opts) {
    const m = g.m, B = Burrow;
    envT -= 1 / 60;
    if (envT <= 0) { // sample the surroundings a couple of times a second
      envT = 0.4;
      const surface = B.skyAt(g, m.x, m.y - 1) && m.y <= g.w.surf[m.x] + 4 ? 1 : 0;
      let lava = 0, water = 0;
      for (let dy = -9; dy <= 9; dy++) for (let dx = -14; dx <= 14; dx++) {
        const t = B.get(g, m.x + dx, m.y + dy), w = 1 - Math.hypot(dx, dy) / 17;
        if (w <= 0) continue;
        if (t === B.T.LAVA) lava += w; else if (t === B.T.WATER) water += w;
      }
      const flowing = g.fluid ? g.fluid.water.size : 0;
      env = {surface, night: B.isNight(g) ? 1 : 0, lava: Math.min(1, lava / 18), water: Math.min(1, water / 25) * (flowing ? 1 : 0.35), deep: Math.min(1, Math.max(0, m.y - 90) / 25)};
    }
    const muted = opts.paused || opts.world;
    const set = (node, v) => node.gain.gain.setTargetAtTime(muted ? 0 : v, now, 0.6);
    set(amb.wind, env.surface * (env.night ? 0.05 : 0.08));
    amb.wind.filter.frequency.setTargetAtTime(300 + Math.sin(now * 0.3) * 120 + Math.sin(now * 0.11) * 80, now, 0.5);
    set(amb.cave, (1 - env.surface) * (0.12 + env.deep * 0.1));
    set(amb.lava, env.lava * 0.35);
    set(amb.water, env.water * 0.06);
    { // the gate hums louder the closer the miner gets
      const c = gateNow(g), d = c ? Math.hypot(g.m.x - c.x, g.m.y - c.y) : 99, near = Math.max(0, 1 - d / 16);
      set(amb.gate, Math.pow(near, 1.5) * 0.3);
    }
    { // full at ground level, then fading away the deeper the miner goes
      const wx = B.inUnder(g) ? {level: 0} : B.weatherNow(g), depth = Math.max(0, m.y - g.w.surf[m.x] - RAIN_HEARD_AT), fade = Math.pow(Math.max(0, 1 - depth / RAIN_FADE_OVER), 1.5);
      set(amb.rain, wx.level * (wx.type === 'storm' ? 0.14 : 0.08) * fade);
    }
    if (muted) return;
    if (env.surface && !env.night && now > nextBird) { // birds by day
      nextBird = now + 3 + Math.random() * 7;
      const n = 2 + Math.floor(Math.random() * 3), base = 2200 + Math.random() * 1400;
      for (let i = 0; i < n; i++) tone(now + i * 0.13, 0.09, 'sine', base, base * 1.35, 0.035, ambBus);
    }
    if (env.surface && env.night && now > nextCricket) { // crickets at night
      nextCricket = now + 0.6 + Math.random() * 1.6;
      const f = 4200 + Math.random() * 600;
      for (let i = 0; i < 4; i++) tone(now + i * 0.05, 0.03, 'sine', f, f, 0.02, ambBus);
    }
    if (!env.surface && now > nextDrip) { // drips in caves
      nextDrip = now + 1.5 + Math.random() * 5;
      const f = 900 + Math.random() * 900;
      tone(now, 0.12, 'sine', f, f * 0.55, 0.05, ambBus);
    }
    if (env.lava > 0.15 && now > nextPop) { // lava bubbling
      nextPop = now + 0.3 + Math.random() * (1.5 - env.lava);
      tone(now, 0.09, 'sine', 120 + Math.random() * 80, 60, 0.12 * env.lava, ambBus);
      noise(now, 0.06, 'lowpass', 500, 1, 0.08 * env.lava, ambBus);
    }
  }

  return {
    get on() { return on; },
    enable() { if (!init()) return false; on = true; ctx.resume(); return true; },
    disable() { on = false; if (ctx) ctx.suspend(); },
    resume() { if (on && ctx && ctx.state !== 'running') ctx.resume(); },
    rumble(loud, low) { // a tunnel caving in somewhere far off: no two alike. The Underworld's are lower
      if (!on) return;
      const pitch = (0.7 + Math.random() * 0.8) * (low || 1), rise = 0.4 + Math.random() * 0.9, len = 3 + Math.random() * 2.5;
      const t = ctx.currentTime + 0.05, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
      src.buffer = noiseBuf; src.loop = true;
      f.type = 'lowpass'; f.frequency.setValueAtTime(210 * pitch, t); f.frequency.linearRampToValueAtTime(95 * pitch, t + len); f.Q.value = 0.7;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.5 * loud, t + rise); gn.gain.linearRampToValueAtTime(0.24 * loud, t + rise + (len - rise) * 0.4); gn.gain.linearRampToValueAtTime(0.0001, t + len);
      src.connect(f); f.connect(gn); gn.connect(ambBus); src.start(t); src.stop(t + len + 0.2);
      tone(t, len * 0.8, 'sine', 62 * pitch, 40 * pitch, 0.22 * loud, ambBus, rise);
      const thuds = 3 + Math.floor(Math.random() * 5); // rock coming down in lumps
      for (let i = 0; i < thuds; i++) {
        const dur = 0.2 + Math.random() * 0.3, hit = (150 + Math.random() * 110) * pitch; // muffled noise, not a tone: a tone sliding down this fast sounds like a bubble
        noise(t + 0.15 + Math.random() * len * 0.7, dur, 'lowpass', hit, 0.7, (0.25 + Math.random() * 0.35) * loud, ambBus, hit * 0.6);
      }
    },
    thunder(far) { // close: a sharp crack, then the long roll. Far off: only a low grumble, later
      if (!on) return;
      const t = ctx.currentTime + (far ? 1 + Math.random() * 1.4 : 0.1 + Math.random() * 0.3), v = far ? 0.45 : 1;
      if (!far) noise(t, 0.28, 'highpass', 1400, 0.7, 0.55, ambBus, 500);
      noise(t + 0.05, 3.2, 'lowpass', 190, 0.8, 0.6 * v, ambBus, 45);
      noise(t + 0.5, 2.4, 'lowpass', 110, 1, 0.45 * v, ambBus, 40);
      tone(t + 0.05, 1.8, 'sine', 66, 28, 0.32 * v, ambBus);
    },
    update
  };
})();
