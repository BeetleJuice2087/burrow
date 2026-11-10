// Burrow render · shaders.js — Lighting effects: the switch, and the colour each light glows.
// Plain script (no modules). The work is done in renderer.js (fxShade and friends), straight into the 2D picture:
// coloured light, a soft glow round fire, lava and the gate, heat haze over lava and a darker edge underground.
// (It started as a WebGL pass over the frame, but sending the whole picture to the graphics card each frame halved the frame rate.)
'use strict';

// the colour each kind of light glows (0..255), and how strong
const FX_GLOW = {};
[[T.TORCH, 255, 168, 70, 1], [T.LANTERN, 255, 178, 84, 1], [T.CAMPFIRE, 255, 140, 56, 1], [T.COPPER_TORCH, 120, 255, 190, 0.9], [T.COPPER_LANTERN, 120, 255, 190, 0.9],
 [T.EMBERCAP, 255, 110, 50, 0.8], [T.LAVA, 255, 108, 30, 0.68], [T.FURNACE, 255, 124, 50, 0.55], [T.SMOKER, 255, 124, 50, 0.55], [T.BLAST_FURNACE, 255, 124, 50, 0.55],
 [T.GATE, 176, 96, 255, 1], [T.WARD_DOOR, 255, 120, 60, 0.8], [T.GLIMMER, 200, 180, 255, 0.8]]
  .forEach(([t, r, gg, b, s]) => { if (t !== undefined) FX_GLOW[t] = [r * s, gg * s, b * s]; });

const PostFx = {
  on: false,
  init() { return true; },
  // after rd.draw: tells the renderer whether to light the next frame with the effects
  frame(rd, src, now, show) { rd.fxWant = this.on; }
};
