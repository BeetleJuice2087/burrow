// Burrow render · decor.js — art for the bigger crafting set: building blocks, workshop furniture, yard decor,
// and the icon templates (every tool and armor piece in every material).
// Plain script: uses the sim globals and js/render/textures.js. Load after textures.js, before icons.js.
'use strict';

// material colours for tool and armor icons: [main, dark]
const MAT_COL = {ember: ['#ffd84a', '#ff5a2a'], wood: ['#b08850', '#7a5530'], stone: ['#9a9aa0', '#5e5e66'], copper: ['#e0905a', '#9a5a2e'], iron: ['#e2e4ea', '#8d9099'],
  gold: ['#ffd84a', '#b48a1a'], gem: ['#4fe0d6', '#1f9e98'], cinder: ['#ff7a3a', '#a03a18']};

// ---------- block textures (16x16, 4 variants, painted like the natural tiles) ----------
function paintBricks(p, r, base, rows) {
  p.rect(0, 0, 16, 16, shade(base, 0.62));
  const h = 16 / rows;
  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? 4 : 0;
    for (let i = -1; i < 2; i++) {
      const x = i * 8 + off, y = j * h, f = 0.9 + r() * 0.2;
      p.rect(Math.max(0, x + 1), y + 1, Math.min(16, x + 8) - Math.max(0, x + 1), h - 1, shade(base, f));
      if (x + 1 >= 0) p.rect(x + 1, y + 1, Math.min(7, 16 - x - 1), 1, shade(base, f * 1.12));
    }
  }
}
function paintMetal(p, r, base, hi) {
  p.rect(0, 0, 16, 16, shade(base, 0.72));
  p.rect(1, 1, 14, 14, shade(base, 1));
  p.rect(1, 1, 14, 1, shade(base, 1.2)); p.rect(1, 1, 1, 14, shade(base, 1.12));
  p.rect(1, 14, 14, 1, shade(base, 0.82)); p.rect(14, 1, 1, 14, shade(base, 0.86));
  for (let i = 0; i < 3; i++) p.px(3 + i, 3, hi); p.px(3, 4, hi);
  for (let i = 0; i < 6; i++) p.px(2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), shade(base, 0.92 + r() * 0.16));
}
function paintSmooth(p, r, base) {
  speckle(p, r, base, 0.04, 3);
  p.rect(0, 0, 16, 1, shade(base, 1.12)); p.rect(0, 15, 16, 1, shade(base, 0.78));
  p.rect(0, 0, 1, 16, shade(base, 1.06)); p.rect(15, 0, 1, 16, shade(base, 0.82));
}
Object.assign(PAINT, {
  [T.STONE_BRICKS]: (p, r) => paintBricks(p, r, hex('#8a8a90'), 2),
  [T.STONE_TILE]: (p, r) => paintStone(p, r, hex('#85858b')),
  [T.SMOOTH_STONE]: (p, r) => { paintSmooth(p, r, hex('#a4a4aa')); p.rect(0, 7, 16, 1, shade(hex('#a4a4aa'), 0.86)); },
  [T.CUT_SANDSTONE]: (p, r) => { paintSmooth(p, r, hex('#d6bf84')); p.rect(0, 5, 16, 1, '#b39a5e'); p.rect(0, 10, 16, 1, '#b39a5e'); },
  [T.SMOOTH_SANDSTONE]: (p, r) => paintSmooth(p, r, hex('#dfc98e')),
  [T.CHISELED_SANDSTONE]: (p, r) => {
    paintSmooth(p, r, hex('#cfb576'));
    const d = '#9e844a'; p.rect(3, 3, 10, 1, d); p.rect(3, 12, 10, 1, d); p.rect(3, 3, 1, 10, d); p.rect(12, 3, 1, 10, d);
    p.rect(7, 6, 2, 4, d); p.rect(6, 7, 4, 2, d);
  },
  [T.COAL_BLOCK]: (p, r) => { speckle(p, r, hex('#232329'), 0.3, 10); for (let i = 0; i < 8; i++) p.px(Math.floor(r() * 16), Math.floor(r() * 16), '#4a4a55'); },
  [T.COPPER_BLOCK]: (p, r) => paintMetal(p, r, hex('#d9844a'), '#ffc79a'),
  [T.IRON_BLOCK]: (p, r) => paintMetal(p, r, hex('#d2d4da'), '#ffffff'),
  [T.GOLD_BLOCK]: (p, r) => paintMetal(p, r, hex('#f0c43c'), '#fff6b8'),
  [T.GEM_BLOCK]: (p, r) => paintMetal(p, r, hex('#45d2ca'), '#e8fffd'),
  [T.GLASS]: (p, r) => {
    p.rect(0, 0, 16, 16, 'rgba(190,225,240,0.22)');
    const f = '#cfe8f2'; p.rect(0, 0, 16, 1, f); p.rect(0, 15, 16, 1, f); p.rect(0, 0, 1, 16, f); p.rect(15, 0, 1, 16, f);
    for (let i = 0; i < 4; i++) p.px(3 + i, 6 - i, 'rgba(255,255,255,0.8)'); p.px(9, 11, 'rgba(255,255,255,0.7)'); p.px(10, 10, 'rgba(255,255,255,0.7)');
  }
});

// ---------- furniture & decor (16x16 art) ----------
function buildDecor() {
  const wood = {b: '#4a2e14', W: '#b07a30', w: '#8e5f22'};
  FURN[T.IRON_DOOR] = art([
    '..kkkkkkkkkkkk..', '..kIIIIIIIIIIk..', '..kIiiiiiiiiIk..', '..kIi.i..i.iIk..', '..kIi.i..i.iIk..', '..kIiiiiiiiiIk..', '..kIIIIIIIIIIk..', '..kIiiiiiiiiIk..',
    '..kIIIIIIIIIIk..', '..kIIIIIIIIgIk..', '..kIIIIIIIIgIk..', '..kIIIIIIIIIIk..', '..kIiiiiiiiiIk..', '..kIIIIIIIIIIk..', '..kIIIIIIIIIIk..', '..kkkkkkkkkkkk..'], {k: '#4a4c55', I: '#c8ccd6', i: '#8d9099', g: '#5a5c66'});
  FURN[T.ANVIL] = art([
    '................', '................', '................', '................', '................', '.kkkkkkkkkkkkkk.', 'kAAAAAAAAAAAAAAk', '.kkAAAAAAAAAAkk.',
    '....kAAAAAAk....', '.....kaaaak.....', '.....kAAAAk.....', '.....kaaaak.....', '...kkAAAAAAkk...', '..kAAAAAAAAAAk..', '..kaaaaaaaaaak..', '..kkkkkkkkkkkk..'], {k: '#1f1f25', A: '#5a5a64', a: '#44444c'});
  FURN[T.STONECUTTER] = art([
    '................', '................', '................', '................', '.......ss.......', '......sSSs......', '.....sSwwSs.....', '.kkkksSwwSskkkk.',
    'kWWWWWWWWWWWWWWk', 'kcccccccccccccck', 'kcCCCCCCCCCCCCck', 'kcCccccccccccCck', 'kcCCCCCCCCCCCCck', 'kcccccccccccccck', 'kcccccccccccccck', 'kkkkkkkkkkkkkkkk'], {k: '#3a3a42', W: '#a07a48', c: '#6a6a72', C: '#8a8a92', s: '#7a7a84', S: '#d0d2d8', w: '#f0f2f8'});
  const smoker = (O, y) => art([
    '................', '.kkkkkkkkkkkkkk.', '.kWWWWWWWWWWWWk.', '.kwwwwwwwwwwwwk.', '.kcccccccccccck.', '.kcCCCCCCCCCCck.', '.kcCccccccccCck.', '.kcCckkkkkkcCck.',
    '.kcCkkkkkkkkCck.', '.kcCkOOyyOOkCck.', '.kcCkOyYYyOkCck.', '.kcCkkOOOOkkCck.', '.kcCCCCCCCCCCck.', '.kWWWWWWWWWWWWk.', '.kkkkkkkkkkkkkk.', '................'],
    {k: '#2a2420', W: '#6e4a2a', w: '#8e6a3a', c: '#4a4a52', C: '#6a6a72', O, y, Y: '#fff0b0'});
  FURN[T.SMOKER] = [smoker('#ff7a2a', '#ffc04a'), smoker('#ff8a3a', '#ffd06a')];
  const blast = (O, y) => art([
    '................', '.kkkkkkkkkkkkkk.', '.kIIIIIIIIIIIIk.', '.kIccccccccccIk.', '.kIcCCCCCCCCcIk.', '.kIcCkkkkkkCcIk.', '.kIcCkkkkkkCcIk.', '.kIIIIIIIIIIIIk.',
    '.kcCCCCCCCCCCck.', '.kcCkOOyyOOkCck.', '.kcCkOyYYyOkCck.', '.kcCkOOyyOOkCck.', '.kcCCCCCCCCCCck.', '.kSSSSSSSSSSSSk.', '.kkkkkkkkkkkkkk.', '................'],
    {k: '#1d1d22', I: '#9a9ca6', c: '#3f3f45', C: '#5a5a62', S: '#a4a4aa', O, y, Y: '#fff0b0'});
  FURN[T.BLAST_FURNACE] = [blast('#ff7a2a', '#ffc04a'), blast('#ff8a3a', '#ffd06a')];
  FURN[T.CAULDRON] = art([
    '................', '................', '................', '................', '.kk..........kk.', '.kAkkkkkkkkkkAk.', '.kAbbbbbbbbbbAk.', '.kAbBbbbbbBbbAk.',
    '.kAAAAAAAAAAAAk.', '.kAaaaaaaaaaaAk.', '.kAAAAAAAAAAAAk.', '..kAaaaaaaaaAk..', '..kAAAAAAAAAAk..', '...kAk....kAk...', '...kAk....kAk...', '...kkk....kkk...'], {k: '#16161b', A: '#45454e', a: '#35353d', b: '#3a6fd8', B: '#9ac4ff'});
  FURN[T.COPPER_CHEST] = art([
    '................', '................', '................', '................', '..bbbbbbbbbbbb..', '.bWWWWWWWWWWWWb.', '.bWwwwwwwwwwwWb.', '.bWwwwwwwwwwwWb.',
    '.bbbbbbggbbbbbb.', '.bWwwwwgywwwwWb.', '.bWwwwwggwwwwWb.', '.bWwwvwwwwvwwWb.', '.bWwwwwwwwwwwWb.', '.bWWWWWWWWWWWWb.', '.bbbbbbbbbbbbbb.', '................'], {b: '#6a3a1a', W: '#e0905a', w: '#b8683a', g: '#c9c9cf', y: '#f2d34a', v: '#5fc7a8'});
  FURN[T.HOPPER] = art([
    'kkkkkkkkkkkkkkkk', 'kAAAAAAAAAAAAAAk', 'kAkkkkkkkkkkkkAk', 'kAk..........kAk', 'kAk..........kAk', 'kAAAAAAAAAAAAAAk', '.kAAAAAAAAAAAAk.', '..kAAAAAAAAAAk..',
    '...kAAAAAAAAk...', '....kAAAAAAk....', '.....kAAAAk.....', '......kAAk......', '......kAAk......', '......kAAk......', '......kAAk......', '......kkkk......'], {k: '#1d1d22', A: '#55555e'});
  const lantern = (g1, g2, size) => art([
    '.......kk.......', '......k..k......', '.......kk.......', '.....kkkkkk.....', '....kIIIIIIk....', '....kkkkkkkk....', '....kGy' + (size === 0 ? 'YY' : 'yy') + 'yGk....', '....kGy' + (size === 2 ? 'yy' : 'YY') + 'yGk....',
    '....kGyYYyGk....', '....kGyyyyGk....', '....kkkkkkkk....', '.....kIIIIk.....', '......kkkk......', '................', '................', '................'], {k: '#2a2a32', I: '#55555e', G: g1, y: g2, Y: '#fff7d6'});
  FURN[T.LANTERN] = [lantern('#3a3a42', '#ffd36e', 0), lantern('#3a3a42', '#ffc04a', 1), lantern('#3a3a42', '#f0a83a', 2)];
  FURN[T.COPPER_LANTERN] = [lantern('#c87a3a', '#a8ffd8', 0), lantern('#c87a3a', '#8af0c0', 1), lantern('#c87a3a', '#6ad8a8', 2)];
  const fire = size => art([
    '................', '................', '................', '.......' + (size === 0 ? 'y' : '.') + '........', '......' + (size === 0 ? 'yO' : size === 1 ? '.y' : '..') + '........', '.....' + (size === 2 ? '.yy.' : 'yOOy') + '.......', '....yOYYOy......', '....yOYYOOy.....',
    '...yOOYYYOy.....', '...yOYYYYOOy....', '..bbOOYYOObbb...', '.bBBbbbbbbbBBb..', 'bBBBBBBBBBBBBBBb', '.bbbbbbbbbbbbbb.', '..k..k..k..k....', '................'], {y: '#ff8a2a', O: '#ff6a1a', Y: '#ffe08a', b: '#5a3a1a', B: '#8a6036', k: '#3a3a42'});
  FURN[T.CAMPFIRE] = [fire(0), fire(1), fire(2)];
  FURN[T.SIGN] = art([
    '................', '................', '.bbbbbbbbbbbbbb.', '.bWWWWWWWWWWWWb.', '.bWkkkkWkkkWWWb.', '.bWWWWWWWWWWWWb.', '.bWkkkWkkkkkWWb.', '.bWWWWWWWWWWWWb.',
    '.bbbbbbbbbbbbbb.', '.......bb.......', '.......bb.......', '.......bb.......', '.......bb.......', '.......bb.......', '.......bb.......', '.......bb.......'], {b: '#5a3a1a', W: '#c99a5c', k: '#6e4a2a'});
  FURN[T.FENCE] = art([
    '................', '................', '......bwwb......', '......bWWb......', '......bWWb......', 'bbbbbbbWWbbbbbbb', 'WWWWWWWWWWWWWWWW', 'bbbbbbbWWbbbbbbb',
    '......bWWb......', '......bWWb......', 'bbbbbbbWWbbbbbbb', 'WWWWWWWWWWWWWWWW', 'bbbbbbbWWbbbbbbb', '......bWWb......', '......bWWb......', '......bWWb......'], {b: '#5a3a1a', W: '#a07a48', w: '#c99a5c'});
  FURN[T.FENCE_GATE] = art([
    '................', '................', 'bwwb........bwwb', 'bWWb........bWWb', 'bWWb........bWWb', 'bWWbbbbbbbbbbWWb', 'bWWWWWWWWWWWWWWb', 'bWWbbbbWWbbbbWWb',
    'bWWb..bWWb..bWWb', 'bWWbbbbWWbbbbWWb', 'bWWWWWWWWWWWWWWb', 'bWWbbbbbbbbbbWWb', 'bWWb........bWWb', 'bWWb........bWWb', 'bWWb........bWWb', 'bWWb........bWWb'], {b: '#5a3a1a', W: '#a07a48', w: '#c99a5c'});
  FURN[T.RAIL] = art([
    '................', '................', '................', '................', '................', '................', '................', '................',
    '................', '................', '................', '................', 'IIIIIIIIIIIIIIII', 'iiiiiiiiiiiiiiii', 'b.bb.bb.bb.bb.bb', 'b.bb.bb.bb.bb.bb'], {I: '#c8ccd6', i: '#7a7d86', b: '#6e4a2a'});
  FURN[T.MINECART] = art([
    '................', '................', '................', '................', '................', 'kkkkkkkkkkkkkkkk', 'kAAAAAAAAAAAAAAk', 'kAaaaaaaaaaaaaAk',
    'kAaaaaaaaaaaaaAk', 'kAAAAAAAAAAAAAAk', '.kkkkkkkkkkkkkk.', '..kKk......kKk..', 'IIkkkIIIIIIkkkII', 'iiiiiiiiiiiiiiii', 'b.bb.bb.bb.bb.bb', 'b.bb.bb.bb.bb.bb'], {k: '#1d1d22', A: '#6a6a72', a: '#4a4a52', K: '#8a8a92', I: '#c8ccd6', i: '#7a7d86', b: '#6e4a2a'});
  FURN[T.WOOD_STAIRS] = art([
    '................', '................', '................', '................', 'bbbbbbbb........', 'bWWWWWWb........', 'bwwwwwwb........', 'bWWWWWWbbbbbbbbb',
    'bwwwwwwwwwwwwwwb', 'bWWWWWWWWWWWWWWb', 'bwwwwwwwwwwwwwwb', 'bWWWWWWWWWWWWWWb', 'bwwwwwwwwwwwwwwb', 'bWWWWWWWWWWWWWWb', 'bwwwwwwwwwwwwwwb', 'bbbbbbbbbbbbbbbb'], {b: '#6e4a2a', W: '#c99a5c', w: '#b08850'});
  FURN[T.WOOD_SLAB] = art([
    '................', '................', '................', '................', '................', '................', '................', '................',
    'bbbbbbbbbbbbbbbb', 'bWWWWWWWWWWWWWWb', 'bwwwwwwwwwwwwwwb', 'bWWWWWWWWWWWWWWb', 'bwwwwwwwwwwwwwwb', 'bWWWWWWWWWWWWWWb', 'bwwwwwwwwwwwwwwb', 'bbbbbbbbbbbbbbbb'], {b: '#6e4a2a', W: '#c99a5c', w: '#b08850'});
  FURN[T.LADDER] = art([
    '..bW........Wb..', '..bWbbbbbbbbWb..', '..bWWWWWWWWWWb..', '..bWbbbbbbbbWb..', '..bW........Wb..', '..bWbbbbbbbbWb..', '..bWWWWWWWWWWb..', '..bWbbbbbbbbWb..',
    '..bW........Wb..', '..bWbbbbbbbbWb..', '..bWWWWWWWWWWb..', '..bWbbbbbbbbWb..', '..bW........Wb..', '..bWbbbbbbbbWb..', '..bWWWWWWWWWWb..', '..bWbbbbbbbbWb..'], {b: '#5a3a1a', W: '#9a6a3a'});
  FURN[T.TRAPDOOR] = art([
    '................', '................', '................', '................', '................', '................', '................', '................',
    '................', '................', '................', '................', 'bbbbbbbbbbbbbbbb', 'bWWbWWWWWWWWbWWb', 'bWWbWWWWWWWWbWWb', 'bbbbbbbbbbbbbbbb'], {b: '#5a3a1a', W: '#9a6a3a'});
  FURN[T.GLASS_PANE] = art([
    'ffffffffffffffff', 'f......ff......f', 'f.g....ff......f', 'f..g...ff......f', 'f...g..ff......f', 'f......ff...g..f', 'f......ff......f', 'ffffffffffffffff',
    'ffffffffffffffff', 'f......ff......f', 'f.g....ff......f', 'f..g...ff......f', 'f......ff..g...f', 'f......ff...g..f', 'f......ff......f', 'ffffffffffffffff'], {f: '#9a6a3a', g: '#e8f6ff'});
  FURN[T.IRON_BARS] = art([
    'IIIIIIIIIIIIIIII', '.i..i..i..i..i..', '.I..I..I..I..I..', '.I..I..I..I..I..', '.I..I..I..I..I..', '.I..I..I..I..I..', '.I..I..I..I..I..', 'IIIIIIIIIIIIIIII',
    '.I..I..I..I..I..', '.I..I..I..I..I..', '.I..I..I..I..I..', '.I..I..I..I..I..', '.I..I..I..I..I..', '.I..I..I..I..I..', '.i..i..i..i..i..', 'IIIIIIIIIIIIIIII'], {I: '#9a9ca6', i: '#6a6c74'});
  FURN.copperTorch = torchFrames({y: '#8af0c0', Y: '#e8fff4', O: '#3fd8a0', b: '#7a5530', c: '#e0905a'}, 'c');
}

// ---------- icon templates ----------
function toolIcon(kind, mat) {
  const [C, c] = MAT_COL[mat], pal = {C, c, b: '#7a5530', g: '#5a4a2a'};
  const rows = {
    axe: ['................', '.......cc.......', '......cCCc......', '.....cCCCbb.....', '.....cCCbbC.....', '......ccbbc.....', '.......bb.......', '......bb........', '.....bb.........', '....bb..........', '...bb...........', '..bb............', '................', '................', '................', '................'],
    shovel: ['................', '..........ccc...', '.........cCCCc..', '.........cCCCc..', '..........cCc...', '.........bb.....', '........bb......', '.......bb.......', '......bb........', '.....bb.........', '....bb..........', '...bb...........', '..bb............', '................', '................', '................'],
    hoe: ['................', '.......ccccc....', '......cCCCCbb...', '..........bb....', '.........bb.....', '........bb......', '.......bb.......', '......bb........', '.....bb.........', '....bb..........', '...bb...........', '..bb............', '................', '................', '................', '................'],
    pick: ['................', '...cccccccc.....', '..cCCCCCCCCc....', '.cC...bb...Cc...', '.c....bb....c...', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '................', '................'],
    sword: ['............cc..', '...........cCc..', '..........cCc...', '.........cCc....', '........cCc.....', '.......cCc......', '......cCc.......', '..g..cCc........', '...gcCc.........', '....gc..........', '...bgg..........', '..bb..g.........', '.bb.............', '................', '................', '................']
  }[kind];
  return art(rows, pal);
}
function armorIcon(slot, mat) {
  const [C, c] = MAT_COL[mat], d = shade(hex(C), 0.82);
  const rows = {
    helmet: ['................', '................', '................', '.....cccccc.....', '....cCCCCCCc....', '...cCCddddCCc...', '...cCCCCCCCCc...', '...cCc....cCc...', '...cCc....cCc...', '...ccc....ccc...', '................', '................', '................', '................', '................', '................'],
    chest: ['................', '...cc......cc...', '..cCCc....cCCc..', '..cCCCccccCCCc..', '..cCCCCCCCCCCc..', '...cCCCddCCCc...', '...cCCCCCCCCc...', '...cCCCddCCCc...', '...cCCCCCCCCc...', '...cCCCCCCCCc...', '....cCCCCCCc....', '....cccccccc....', '................', '................', '................', '................'],
    legs: ['................', '................', '....cccccccc....', '....cCCddCCc....', '....cCCCCCCc....', '....cCCccCCc....', '....cCc..cCc....', '....cCc..cCc....', '....cCc..cCc....', '....cCc..cCc....', '....cCc..cCc....', '....ccc..ccc....', '................', '................', '................', '................'],
    boots: ['................', '................', '................', '................', '................', '................', '...cCc....cCc...', '...cCc....cCc...', '...cCc....cCc...', '...cCCcc..cCCcc.', '...cCCCCc.cCCCCc', '...cccccc.cccccc', '................', '................', '................', '................']
  }[slot];
  return art(rows, {C, c, d});
}
// a slab / stairs / wall icon cut from a block texture
// the same picture moved down so it rests on the floor of its cell
function atFloor(c) {
  const a = c.getContext('2d').getImageData(0, 0, 16, 16).data;
  let low = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) low = Math.floor(i / 64);
  const o = canvas(16, 16); o.getContext('2d').drawImage(c, 0, 15 - low); return o;
}
function buildDecorItems() {
  const shaped = {[T.COBBLE_STAIRS]: [T.COBBLE, 'stairs'], [T.SANDSTONE_STAIRS]: [T.SANDSTONE, 'stairs'], [T.STONE_SLAB]: [T.STONE_TILE, 'slab'],
    [T.SANDSTONE_SLAB]: [T.SANDSTONE, 'slab'], [T.COBBLE_WALL]: [T.COBBLE, 'wall'], [T.SANDSTONE_WALL]: [T.SANDSTONE, 'wall']};
  for (const t in shaped) FURN[t] = atFloor(shapedIcon(TEX[shaped[t][0]][0], shaped[t][1]));
  const pic = k => art(MISC_ICONS[k].rows, MISC_ICONS[k].pal);
  for (const [t, k] of [[T.PRESSURE_PLATE, 'pressure_plate'], [T.BUCKET, 'bucket'], [T.BOAT, 'boat'], [T.CHEST_BOAT, 'chest_boat'], [T.EXPEDITION_PACK, 'expedition_pack']]) FURN[t] = atFloor(pic(k));
  FURN[T.BUTTON] = pic('button');
  FURN[T.IRON_TRAPDOOR] = tint(FURN[T.TRAPDOOR], 'rgba(200,204,214,0.85)');
  FURN[T.COPPER_TORCH] = FURN.copperTorch;
  FURN[T.STORE_CHEST] = FURN[T.CHEST];
  // Underworld stone and glow
  const scorch = (src, col) => src.map(c => tint(c, col));
  TEX[T.ASHROCK] = scorch(TEX[T.DEEP], 'rgba(110,34,24,0.6)');
  TEX[T.CINDERITE] = scorch(TEX[T.IRON], 'rgba(255,84,20,0.55)');
  TEX[T.VAULT_BRICK] = scorch(TEX[T.STONE_BRICKS], 'rgba(40,12,44,0.72)');
  TEX[T.CHARWOOD] = scorch(TEX[T.LOG], 'rgba(24,12,14,0.72)');
  TEX[T.EMBERLEAF] = scorch(TEX[T.LEAVES], 'rgba(246,104,30,0.72)');
  TEX[T.SHARDROCK] = scorch(TEX[T.STONE], 'rgba(92,74,176,0.6)');
  TEX[T.GLIMMER] = scorch(TEX[T.GEM], 'rgba(206,186,255,0.6)');
  TEX[T.BONE] = scorch(TEX[T.SAND], 'rgba(226,214,186,0.75)');
  TEX[T.WARDSTONE] = scorch(TEX[T.STONE_BRICKS], 'rgba(28,18,44,0.8)');
  TEX[T.WARD_DOOR] = scorch(TEX[T.GEM], 'rgba(120,64,224,0.72)');
  WALL.ash = tint(WALL.deep, 'rgba(120,30,16,0.6)');
  WALL.red = tint(WALL.sand, 'rgba(120,40,24,0.55)');
  FURN[T.GATESTONE] = tint(TEX[T.DEEP][0], 'rgba(30,16,52,0.75)');
  FURN[T.EMBERCAP] = art([
    '................', '................', '................', '................', '................', '................', '................', '................',
    '.....oOOOo......', '....oOyOOOo.....', '....oOOOOyo.....', '.....ccccc......', '.......s........', '.......s...oO...', '.......s..oyOo..', '......sss..s....'], {o: '#d8541e', O: '#ff8a3a', y: '#ffd27a', c: '#7a2a14', s: '#c8a080'});
  const swirl = spin => {
    const rows = [];
    for (let y = 0; y < 16; y++) { let row = ''; for (let x = 0; x < 16; x++) { const q = Math.sin((x + y) * 0.9 + spin) + Math.sin((x - y) * 0.7 - spin * 2); row += q > 0.9 ? 'y' : q > -0.2 ? 'o' : 'r'; } rows.push(row); }
    return art(rows, {r: '#7a1f2a', o: '#d8481e', y: '#ffae4a'});
  };
  FURN[T.GATE] = [swirl(0), swirl(1.6)];
  // an iron cage with a cold flame turning over inside it
  const cage = lick => {
    const rows = [];
    for (let y = 0; y < 16; y++) {
      let row = '';
      for (let x = 0; x < 16; x++) {
        const bar = x % 5 === 0 || y === 0 || y === 15, rim = (x % 5 === 0) && (y === 0 || y === 15);
        const reach = 6 - Math.abs(x - 7.5 + (y % 4 < 2 ? lick : -lick)) * 1.1 + (y - 8) * 0.7;
        row += rim ? 'I' : bar ? 'i' : reach > 3 ? 'w' : reach > 1.2 ? 'c' : reach > 0 ? 'b' : 'd';
      }
      rows.push(row);
    }
    return art(rows, {i: '#4a4f5e', I: '#7c8496', d: '#10131f', b: '#23408c', c: '#3f7be0', w: '#a8d4ff'});
  };
  FURN[T.SPAWNER] = [cage(0.8), cage(-0.8)];
  FURN[T.SAPLING] = art([
    '................', '................', '................', '................', '................', '................', '.......gg.......', '......gGGg......',
    '.....gGgGGg.....', '......gGGg.gg...', '...gg..bGgGGg...', '..gGGg.b..gg....', '...ggGbb........', '.......b........', '.......b........', '.......b........'], {g: '#3f7a2c', G: '#6ab04a', b: '#7a5530'});
}
function shapedIcon(src, shape) {
  const c = canvas(16, 16), x = c.getContext('2d');
  const parts = {slab: [[0, 8, 16, 8]], stairs: [[0, 0, 8, 16], [8, 8, 8, 8]], wall: [[4, 0, 8, 16], [0, 6, 16, 4]]}[shape];
  for (const [px, py, w, h] of parts) x.drawImage(src, px, py, w, h, px + 1, py + 1, w * 0.875, h * 0.875);
  return c;
}
const MISC_ICONS = {
  fishing_rod: {rows: ['............bb..', '...........bb.w.', '..........bb..w.', '.........bb...w.', '........bb....w.', '.......bb.....w.', '......bb......w.', '.....bb.......w.', '....bb........w.', '...bb.........r.', '..bb..........r.', '.bb.............', '................', '................', '................', '................'], pal: {b: '#8a6036', w: '#e8e8e8', r: '#d8402e'}},
  raw_fish: {rows: ['................', '................', '................', '................', '..........ss....', '.....sssssSSs..t', '...sSSSSSSSSSstt', '..sSkSSSSSSSSStt', '..sSSSSWWWSSSstt', '...sSSWWWWSSs..t', '.....sssssss....', '................', '................', '................', '................', '................'], pal: {s: '#5f8fb0', S: '#8fc0dc', W: '#d8eaf2', k: '#14202a', t: '#6f9fc0'}},
  cooked_fish: {rows: ['................', '................', '................', '................', '..........ss....', '.....sssssSSs..t', '...sSSSSSSSSSstt', '..sSkSSHSSHSSStt', '..sSSSSHSSHSSstt', '...sSSHSSHSSs..t', '.....sssssss....', '................', '................', '................', '................', '................'], pal: {s: '#7a4a22', S: '#c08848', H: '#6a3e1c', k: '#20140a', t: '#a06c34'}},
  old_boot: {rows: ['................', '................', '....bbbbbb......', '....bBBBBb......', '....bBBBBb......', '....bBddBb......', '....bBBBBb......', '....bBddBb......', '....bBBBBbbbb...', '....bBBBBBBBBb..', '....bBBBBBBBBb..', '....bbbbbbbbbb..', '....kkkkkkkkkk..', '................', '................', '................'], pal: {b: '#3e2c1c', B: '#6e4e30', d: '#a88a5a', k: '#1e1610'}},
  shield: {rows: ['................', '..kkkkkkkkkkkk..', '..kWWWWIIWWWWk..', '..kWwwwIIwwwWk..', '..kWwwwIIwwwWk..', '..kIIIIIIIIIIk..', '..kWwwwIIwwwWk..', '..kWwwwIIwwwWk..', '...kWwwIIwwWk...', '....kWwIIwWk....', '.....kWIIWk.....', '......kkkk......', '................', '................', '................', '................'], pal: {k: '#3a2a1a', W: '#b08850', w: '#8e6a3a', I: '#c8ccd6'}},
  bucket: {rows: ['................', '................', '....kkkkkkkk....', '...k........k...', '..kIIIIIIIIIIk..', '..kIiiiiiiiiIk..', '..kIIIIIIIIIIk..', '...kIIIIIIIIk...', '...kIiiiiiiIk...', '...kIIIIIIIIk...', '....kIIIIIIk....', '....kkkkkkkk....', '................', '................', '................', '................'], pal: {k: '#4a4c55', I: '#c8ccd6', i: '#8d9099'}},
  shears: {rows: ['................', '..II........II..', '...II......II...', '....II....II....', '.....II..II.....', '......IIII......', '.......kk.......', '......rkkr......', '.....rr..rr.....', '....rr....rr....', '...rr......rr...', '...rr......rr...', '....rrr..rrr....', '................', '................', '................'], pal: {I: '#e2e4ea', k: '#5a5c66', r: '#c0392b'}},
  golden_apple: {rows: ['................', '.......b........', '.......bg.......', '....yyybyy......', '...yWyyyyyy.....', '...yWyyyyyy.....', '...yyyyyyyy.....', '...yyyyyyyy.....', '....yyyyyy......', '.....yyyy.......', '................', '................', '................', '................', '................', '................'], pal: {b: '#5a3a1a', g: '#5aa33a', y: '#f2c33a', W: '#fff6b8'}},
  boat: {rows: ['................', '................', '................', '................', '................', '................', '.b............b.', '.bWb........bWb.', '.bWWbbbbbbbbWWb.', '..bWWWWWWWWWWb..', '..bwwwwwwwwwwb..', '...bbbbbbbbbb...', '................', '................', '................', '................'], pal: {b: '#4a2e14', W: '#b07a30', w: '#8e5f22'}},
  chest_boat: {rows: ['................', '................', '................', '.....bbbbbb.....', '.....bWWWWb.....', '.....bbggbb.....', '.b...bWWWWb...b.', '.bWb.bbbbbb.bWb.', '.bWWbbbbbbbbWWb.', '..bWWWWWWWWWWb..', '..bwwwwwwwwwwb..', '...bbbbbbbbbb...', '................', '................', '................', '................'], pal: {b: '#4a2e14', W: '#b07a30', w: '#8e5f22', g: '#c9c9cf'}},
  pressure_plate: {rows: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '..bbbbbbbbbbbb..', '..bWWWWWWWWWWb..', '..bwwwwwwwwwwb..', '..bbbbbbbbbbbb..', '................', '................', '................'], pal: {b: '#5a3a1a', W: '#c99a5c', w: '#a07a48'}},
  button: {rows: ['................', '................', '................', '................', '................', '......bbbb......', '.....bWWWWb.....', '.....bwwwwb.....', '......bbbb......', '................', '................', '................', '................', '................', '................', '................'], pal: {b: '#5a3a1a', W: '#c99a5c', w: '#a07a48'}},
  fruit_pie: {rows: ['................', '................', '................', '....bbbbbbbb....', '...bBrBBrBBrb...', '..bBBBBBBBBBBb..', '..bBrBBrBBrBBb..', '..bbbbbbbbbbbb..', '...kkkkkkkkkk...', '................', '................', '................', '................', '................', '................', '................'], pal: {b: '#8a5a24', B: '#d09a4a', r: '#c22a3e', k: '#6a4a24'}},
  leaf_cloak: {rows: ['................', '.....gggggg.....', '....gGGgGGgg....', '...gGgGGgGGgg...', '...gGGgGGGgGg...', '..gGgGGgGGgGGg..', '..gGGgGGgGGgGg..', '..gGgGGgGGgGGg..', '..gGGgGGgGGgGg..', '...gGGgGGgGGg...', '...ggggggggggg..', '................', '................', '................', '................', '................'], pal: {g: '#2d5a2a', G: '#4f8a3a'}},
  expedition_pack: {rows: ['................', '.....kkkkkk.....', '....k......k....', '...bbbbbbbbbb...', '..bWWWWWWWWWWb..', '..bWgggggggWWb..', '..bWgGGGGGgWWb..', '..bWgggggggWWb..', '..bWWWWWWWWWWb..', '..bWWWyyWWWWWb..', '..bWWWWWWWWWWb..', '...bbbbbbbbbb...', '................', '................', '................', '................'], pal: {k: '#5a3a1a', b: '#4a2e14', W: '#b07a30', g: '#3f7d31', G: '#5aa33a', y: '#f2d34a'}},
  mining_lantern: {rows: ['....kkkkkkkk....', '...k........k...', '...k..kkkk..k...', '.....kIIIIk.....', '.....kkkkkk.....', '.....kyyyyk.....', '.....kyYYyk.....', '.....kyYYyk.....', '.....kyyyyk.....', '.....kkkkkk.....', '......kIIk......', '................', '................', '................', '................', '................'], pal: {k: '#2a2a32', I: '#c8ccd6', y: '#ffc04a', Y: '#fff7d6'}}
};
// returns a 16x16 canvas for any item the base icons don't cover, or null
function decorIconArt(name) {
  const tileIcon = {stone_bricks: T.STONE_BRICKS, glass: T.GLASS, coal_block: T.COAL_BLOCK, copper_block: T.COPPER_BLOCK, iron_block: T.IRON_BLOCK,
    gold_block: T.GOLD_BLOCK, gem_block: T.GEM_BLOCK, smooth_stone: T.SMOOTH_STONE, cut_sandstone: T.CUT_SANDSTONE,
    chiseled_sandstone: T.CHISELED_SANDSTONE, smooth_sandstone: T.SMOOTH_SANDSTONE, stone: T.STONE_TILE};
  if (tileIcon[name] !== undefined) {
    const c = canvas(16, 16), x = c.getContext('2d');
    x.drawImage(TEX[tileIcon[name]][0], 2, 2, 12, 12);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(2, 13, 12, 1); x.fillRect(13, 2, 1, 12);
    return c;
  }
  const t = BUILD_TILE[name];
  if (t !== undefined && FURN[t]) { const f = FURN[t]; return Array.isArray(f) ? f[0] : f; }
  const shaped = {stone_slab: [T.STONE_TILE, 'slab'], sandstone_slab: [T.SANDSTONE, 'slab'], cobble_stairs: [T.COBBLE, 'stairs'], sandstone_stairs: [T.SANDSTONE, 'stairs'],
    cobble_wall: [T.COBBLE, 'wall'], sandstone_wall: [T.SANDSTONE, 'wall']}[name];
  if (shaped) return shapedIcon(TEX[shaped[0]][0], shaped[1]);
  if (name === 'iron_trapdoor') return tint(FURN[T.TRAPDOOR], 'rgba(200,204,214,0.85)');
  if (name === 'copper_torch') return FURN.copperTorch[0];
  if (name === 'iron_nugget' || name === 'copper_nugget') {
    const [C, c] = name === 'iron_nugget' ? MAT_COL.iron : MAT_COL.copper;
    return art(['................', '................', '................', '................', '................', '.......cc.......', '......cCCc......', '.....cCCCCc.....', '.....cCCCcc.....', '......cccc......', '................', '................', '................', '................', '................', '................'], {C, c});
  }
  if (name === 'reinforced_pick') {
    return art(['................', '...IcccccccI....', '..cCCCCCCCCc....', '.cC...bb...Cc...', '.I....bb....I...', '......ii........', '......bb........', '......bb........', '......ii........', '......bb........', '......bb........', '......bb........', '......ii........', '......bb........', '................', '................'], {C: MAT_COL.gem[0], c: MAT_COL.gem[1], I: '#e2e4ea', i: '#8d9099', b: '#7a5530'});
  }
  const kind = TOOL_KIND[name];
  if (kind) return toolIcon(kind, TOOL_MAT[name]);
  const a = ARMOR[name];
  if (a) return armorIcon(a.slot, name.split('_')[0]);
  if (MISC_ICONS[name]) return art(MISC_ICONS[name].rows, MISC_ICONS[name].pal);
  return null;
}
