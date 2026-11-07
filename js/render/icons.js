// Burrow render · icons.js — item icons for the Pack tab and HUD heart/food icons.
// Plain script: uses the sim globals and js/render/textures.js.
'use strict';

// ---------- item icons ----------
const ICON_CACHE = {};
function iconArt(name) {
  const tileIcon = {log: T.LOG, planks: T.PLANKS, dirt: T.DIRT, cobble: T.COBBLE, sand: T.SAND, sandstone: T.SANDSTONE, leaf: T.LEAVES, obsidian: T.OBSIDIAN};
  const furnIcon = {torch: T.TORCH, bench: T.BENCH, furnace: T.FURNACE, chest: T.CHEST, bed: T.BED, door: T.DOOR};
  if (tileIcon[name] !== undefined) {
    const c = canvas(16, 16), x = c.getContext('2d');
    x.drawImage(TEX[tileIcon[name]][0], 2, 2, 12, 12);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(2, 13, 12, 1); x.fillRect(13, 2, 1, 12);
    return c;
  }
  if (name === 'gatestone') {
    const c = canvas(16, 16), x = c.getContext('2d');
    x.drawImage(FURN[T.GATESTONE], 2, 2, 12, 12);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(2, 13, 12, 1); x.fillRect(13, 2, 1, 12);
    return c;
  }
  if (furnIcon[name] !== undefined) { const f = FURN[furnIcon[name]]; return Array.isArray(f) ? f[0] : f; }
  const P = s => art(s.rows, s.pal);
  const nug = (a, b) => ({rows: ['................', '................', '................', '................', '......aa........', '....aaAAa.......', '...aAAAAaa......', '...aAAbAAAa.....', '..aAAbbAAAa.....', '..aAAAAAAaa.....', '...aaAAAa.......', '.....aaa........', '................', '................', '................', '................'].map(r => r.replace(/^(.{3})/, '.$1').slice(0, 16)), pal: {a: b, A: a, b: '#fff8'}});
  const ingot = (a, b) => ({rows: ['................', '................', '................', '................', '................', '.....AAAAAAA....', '....AAAAAAAAa...', '...aAAAAAAAaa...', '..aaaaaaaaaaa...', '..aaaaaaaaaa....', '................', '................', '................', '................', '................', '................'], pal: {A: a, a: b}});
  const pick = c => ({rows: ['................', '...cccccccc.....', '..cCCCCCCCCc....', '.cC...bb...Cc...', '.c....bb....c...', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '......bb........', '................', '................'], pal: {c: shadeHex(c, 0.7), C: c, b: '#7a5530'}});
  const sword = c => ({rows: ['............cc..', '...........cCc..', '..........cCc...', '.........cCc....', '........cCc.....', '.......cCc......', '......cCc.......', '..g..cCc........', '...gcCc.........', '....gc..........', '...bgg..........', '..bb..g.........', '.bb.............', '................', '................', '................'], pal: {c: shadeHex(c, 0.7), C: c, g: '#5a4a2a', b: '#7a5530'}});
  const plate = (c) => ({rows: ['................', '...cc......cc...', '..cCCc....cCCc..', '..cCCCccccCCCc..', '..cCCCCCCCCCCc..', '...cCCCddCCCc...', '...cCCCCCCCCc...', '...cCCCddCCCc...', '...cCCCCCCCCc...', '...cCCCCCCCCc...', '....cCCCCCCc....', '....cccccccc....', '................', '................', '................', '................'], pal: {c: shadeHex(c, 0.65), C: c, d: shadeHex(c, 0.8)}});
  const arrowIcon = c => ({rows: ['............cc..', '...........cCc..', '..........bcc...', '.........b......', '........b.......', '.......b........', '......b.........', '.....b..........', '....b...........', '..ff............', '.ff.............', '.f..............', '................', '................', '................', '................'], pal: {c: shadeHex(c, 0.7), C: c, b: '#c8b080', f: '#e8e4dc'}});
  const defs = {
    bow: {rows: ['................', '.....bbbbb......', '...bb....sbb....', '..b....ss...b...', '..b..ss.....b...', '.b.ss........b..', '.bs..........b..', '.s...........b..', '.b...........b..', '.b..........b...', '..b........b....', '...b......b.....', '....bbbbbb......', '................', '................', '................'], pal: {b: '#8a5a2a', s: '#e8e0d0'}},
    copper_arrow: arrowIcon('#d9844a'), iron_arrow: arrowIcon('#e2e4ea'), gold_arrow: arrowIcon('#ffd84a'), gem_arrow: arrowIcon('#4fe0d6'), cinder_arrow: arrowIcon('#ff7a3a'),
    stick: {rows: ['................', '...........bb...', '..........bb....', '.........bb.....', '........bb......', '.......bb.......', '......bb........', '.....bb.........', '....bb..........', '...bb...........', '................', '................', '................', '................', '................', '................'], pal: {b: '#8a6036'}},
    coal: {rows: ['................', '................', '................', '.....kkkk.......', '...kkKKKkk......', '..kKKkKKKKk.....', '..kKKKKkKKk.....', '..kkKKKKKkk.....', '...kkKKkkk......', '.....kkk........', '................', '................', '................', '................', '................', '................'], pal: {k: '#1b1b20', K: '#3a3a42'}},
    gem: {rows: ['................', '................', '.....cccccc.....', '....cCWCCCCc....', '...cCWCCCCCCc...', '...cccccccccc...', '....cCCCCCCc....', '.....cCCCCc.....', '......cCCc......', '.......cc.......', '................', '................', '................', '................', '................', '................'], pal: {c: '#1f9e98', C: '#4fe0d6', W: '#e8fffd'}},
    raw_copper: nug('#d9844a', '#8e4e24'), raw_iron: nug('#dcc2ae', '#9a7a62'), raw_gold: nug('#f5cd45', '#b08a1a'), raw_cinderite: nug('#ff7a3a', '#a03a18'), emberfruit: nug('#ffb03a', '#c8401a'), glimmer: nug('#d8c8ff', '#7a5ad0'),
    copper_ingot: ingot('#e0905a', '#9a5a2e'), iron_ingot: ingot('#e2e4ea', '#8d9099'), gold_ingot: ingot('#ffd84a', '#b48a1a'), cinder_ingot: ingot('#ff7a3a', '#a03a18'), ward_key: ingot('#b49aff', '#5a3ab0'),
    wood_pick: pick('#b08850'), stone_pick: pick('#9a9aa0'), iron_pick: pick('#e2e4ea'), gem_pick: pick('#4fe0d6'),
    wood_sword: sword('#b08850'), stone_sword: sword('#9a9aa0'), iron_sword: sword('#e8eaf0'),
    copper_armor: plate('#d98a4e'), iron_armor: plate('#d4d6dc'),
    berries: {rows: ['................', '................', '.......g........', '......gg........', '....rr..rr......', '...rRrrrRr......', '...rrrrrrrr.....', '....rrRrrR......', '.....rrrrr......', '................', '................', '................', '................', '................', '................', '................'], pal: {g: '#4f8a33', r: '#c22a3e', R: '#ff8a9a'}},
    apple: {rows: ['................', '.......b........', '.......bg.......', '....rrrbrr......', '...rRrrrrrr.....', '...rRrrrrrr.....', '...rrrrrrrr.....', '...rrrrrrrr.....', '....rrrrrr......', '.....rrrr.......', '................', '................', '................', '................', '................', '................'], pal: {b: '#5a3a1a', g: '#5aa33a', r: '#c8302a', R: '#ff8a7a'}},
    raw_meat: {rows: ['................', '................', '.....ppppp......', '...pPPPPPPp.....', '..pPPwPPPPPp....', '..pPPPPPPPPp....', '...pPPPPPPp.ww..', '....pppppp.wWw..', '...........ww...', '................', '................', '................', '................', '................', '................', '................'], pal: {p: '#a8333e', P: '#e0606a', w: '#e8e0d0', W: '#ffffff'}},
    cooked_meat: {rows: ['................', '................', '.....ppppp......', '...pPPPPPPp.....', '..pPPhPPPPPp....', '..pPPPPPPPPp....', '...pPPPPPPp.ww..', '....pppppp.wWw..', '...........ww...', '................', '................', '................', '................', '................', '................', '................'], pal: {p: '#6a3a1a', P: '#a0602e', h: '#d8955a', w: '#e8e0d0', W: '#ffffff'}},
    wheat: {rows: ['................', '.......YY.......', '......YyYY......', '......YyYY......', '.......YyY......', '......YYyY......', '......YyY.......', '.......t........', '.......t........', '.......t........', '.......t........', '.......t........', '.......t........', '................', '................', '................'], pal: {Y: '#e8c84a', y: '#c89a2e', t: '#a8884a'}},
    wheat_seeds: {rows: ['................', '................', '................', '................', '.....s....s.....', '....sS...sS.....', '........s.......', '.......sS...s...', '...s........sS..', '...sS...s.......', '.......sS.......', '................', '................', '................', '................', '................'], pal: {s: '#8a7a3a', S: '#c8b05a'}},
    potato: {rows: ['................', '................', '................', '.....ppppp......', '...pPPPPPPPp....', '..pPPPdPPPPPp...', '..pPPPPPPdPPp...', '..pPdPPPPPPPp...', '...pPPPPdPPPp...', '....ppPPPPpp....', '......pppp......', '................', '................', '................', '................', '................'], pal: {p: '#9a7040', P: '#c49a5a', d: '#7a5428'}},
    baked_potato: {rows: ['................', '................', '.....ww.w.......', '......w.w.......', '.....ppppp......', '...pPPYYYPPp....', '..pPPYWWYPPPp...', '..pPPPYYYPPPp...', '..pPPPPPPPPPp...', '...pPPPPPPPp....', '....ppPPPpp.....', '......pppp......', '................', '................', '................', '................'], pal: {p: '#6a4422', P: '#94683a', Y: '#f0d060', W: '#fff4b0', w: '#d8d8e0'}},
    bread: {rows: ['................', '................', '................', '.....bbbbbb.....', '...bBBBBBBBBb...', '..bBhBBhBBhBBb..', '..bBBBBBBBBBBb..', '..bbbbbbbbbbbb..', '................', '................', '................', '................', '................', '................', '................', '................'], pal: {b: '#8a5a24', B: '#d09a4a', h: '#f2cf8a'}}
  };
  if (defs[name]) return P(defs[name]);
  return decorIconArt(name);
}
function shadeHex(h, f) { return shade(hex(h), f); }
function icon(name) {
  if (ICON_CACHE[name] !== undefined) return ICON_CACHE[name];
  const c = iconArt(name);
  let url = '';
  if (c) { const big = canvas(32, 32), x = big.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, 32, 32); url = big.toDataURL(); }
  ICON_CACHE[name] = url;
  return url;
}
function uiIcon(rows, pal) { const c = art(rows, pal), big = canvas(c.width * 2, c.height * 2), x = big.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, big.width, big.height); return big.toDataURL(); }
const UI_ICONS = {
  heart: () => uiIcon(['.rr.rr.', 'rRrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], {r: '#e04a4a', R: '#ffb0b0'}),
  heartE: () => uiIcon(['.kk.kk.', 'k..k..k', 'k.....k', '.k...k.', '..k.k..', '...k...'], {k: '#5a4048'}),
  heartH: () => uiIcon(['.rr.kk.', 'rRr..k.', 'rrr...k', '.rr..k.', '..r.k..', '...k...'], {r: '#e04a4a', R: '#ffb0b0', k: '#5a4048'}),
  food: () => uiIcon(['...bbb.', '..bBBBb', '..bBBBb', '.wbbbb.', 'ww.....', 'w......'], {b: '#8a4a24', B: '#c87a3a', w: '#efe6d6'}),
  foodE: () => uiIcon(['...kkk.', '..k...k', '..k...k', '.kkkkk.', 'kk.....', 'k......'], {k: '#5a4a40'})
};

