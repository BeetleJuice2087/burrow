// Burrow render · sprites.js — miner, tools, monsters and pudgeon pixel art.
// Plain script: uses the sim globals and js/render/textures.js.
'use strict';

// ---------- sprites ----------
const SPR = {};
const TOUGH_TINT = [null, 'rgba(24,4,14,0.5)', 'rgba(150,44,6,0.45)']; // darker, then lit from within
function buildSprites() {
  const pal = {H: '#e8b53c', h: '#b8862a', L: '#fff2b0', S: '#e9b48a', s: '#c98f68', B: '#5a3a24', E: '#1d1d24', R: '#b5442e', r: '#8a3122', O: '#5b4230', o: '#45311f', K: '#2a2420', g: '#cfa04a'};
  const top = [
    '..hHHh..',
    '.hHHHHHL',
    '..SSSSs.',
    '..SSSEs.',
    '..BSSSB.',
    '..BBBBB.',
    '.rRRRRr.',
    '.rROORr.',
    '.rOOgOr.',
    '..OOOO..'];
  const legs = [
    ['..OooO..', '..Oo.O..', '..Oo.O..', '..Oo.O..', '.KK..KK.', '.KK..KK.'],
    ['..OooO..', '..Oo.O..', '.Oo..O..', '.Oo...O.', 'KK....KK', 'KK....KK'],
    ['..OooO..', '..O.oO..', '..O..oO.', '.O...oO.', '.KK..KK.', '..K...KK']];
  SPR.base = {top, legs, pal};
  SPR.miner = legs.map(l => art(top.concat(l), pal));
  SPR.minerL = SPR.miner.map(flip);
  SPR.minerHurt = SPR.miner.map(c => tint(c, 'rgba(255,70,60,0.55)')); SPR.minerHurtL = SPR.minerHurt.map(flip);
  // armor overlays
  const plate = (c1, c2) => art(['........', '........', '........', '........', '........', '........', '.cCCCCc.', '.cCddCc.', '.cCCCCc.', '..cCCc..', '........', '........', '........', '........', '........', '........'], {c: c2, C: c1, d: c2});
  SPR.plate = {}; SPR.plateL = {};
  for (const k of ['copper', 'iron', 'gold', 'gem', 'cinder']) { SPR.plate[k] = plate(MAT_COL[k][0], MAT_COL[k][1]); SPR.plateL[k] = flip(SPR.plate[k]); }
  SPR.shield = art(['kkkkk', 'kWIWk', 'kIIIk', 'kWIWk', '.kIk.', '..k..'], {k: '#3a2a1a', W: '#b08850', I: '#c8ccd6'});
  SPR.sleep = art([
    '................',
    '..hH.....rRRRr..',
    '.hHHSS.BrRRRRRrO',
    '.hHHSSBBrRRRRRrK',
    '................'], pal);
  SPR.arm = art(['rR', 'rR', 'rR', 'SS'], pal);
  // tools (8x8), drawn pointing up-right from handle at bottom-left
  SPR.heldCache = {};
  // monsters
  SPR.shambler = art([
    '........',
    '..mmmm..',
    '.mMMMMm.',
    '.MeMMeM.',
    '.MMMMMM.',
    'mMMddMMm',
    'mMMMMMMm',
    'MMmMMmMM',
    'M.MMMM.M',
    'M.MMMM.M',
    '..MMMM..',
    '..MmmM..',
    '..M..M..',
    '..M..M..',
    '.mM..Mm.',
    '.mm..mm.'], {m: '#2f4a3a', M: '#3f6650', e: '#ffcf4a', d: '#1b2a22'});
  SPR.crawler = art([
    '........',
    '........',
    '........',
    '..pppp..',
    '.pPPPPp.',
    'pPPPPPPe',
    'pPPpPPPP',
    'l.l..l.l'], {p: '#4a2a6a', P: '#7a4aa8', e: '#ff4a6a', l: '#2a1a3a'});
  SPR.archer = art([
    '..kkkk..',
    '.kKKKKk.',
    '.kKwwKk.',
    '.kweewk.',
    '.kKwwKk.',
    'kKKKKKKk',
    'kKKKKKKk',
    '.KKKKKKb',
    '.KKKKKKb',
    '.KKKKK.b',
    '.KKKKK.b',
    '.KKKKK.b',
    '..KKKK.b',
    '..KK.K..',
    '..KK.K..',
    '.kk..kk.'], {k: '#1c1a26', K: '#2e2a40', w: '#d8d4c8', e: '#7ad8ff', b: '#8a6036'});
  SPR.pudgeon = art([
    '........',
    '..gg....',
    '.gGeg...',
    'yGGGgg..',
    '.gGGGGg.',
    '.gGGGGGg',
    '..gGGGg.',
    '...y.y..'], {g: '#8a7a9a', G: '#b8a8c8', e: '#1d1d24', y: '#e8a43a'});
  SPR.cinderling = tint(SPR.shambler, 'rgba(226,74,24,0.6)'); SPR.ashcaster = tint(SPR.archer, 'rgba(58,18,60,0.65)');
  SPR.ashhound = tint(SPR.crawler, 'rgba(120,108,100,0.7)'); SPR.shardling = tint(SPR.shambler, 'rgba(120,96,220,0.62)'); SPR.warden = tint(SPR.shambler, 'rgba(24,10,20,0.8)');
  SPR.spider = art([
    '........',
    '.k.kk.k.',
    'k.kKKk.k',
    'kkKssKkk',
    '.kKKKKk.',
    'kkKKKKkk',
    'k.k..k.k',
    'k.k..k.k'], {k: '#17141c', K: '#2c2634', s: '#6a5470'});
  SPR.spiderB = art([
    '........',
    'k..kk..k',
    '.kkKKkk.',
    'k.KssK.k',
    '.kKKKKk.',
    'k.KKKK.k',
    '.k.kk.k.',
    'k.k..k.k'], {k: '#17141c', K: '#2c2634', s: '#6a5470'});
  SPR.blastcap = art([
    '...rr...',
    '..rRRr..',
    '.rRyRRr.',
    'rRRRRyRr',
    'rrrrrrrr',
    '..cccc..',
    '..cccc..',
    '.cCCCCc.'], {r: '#6a3e32', R: '#9c5e42', y: '#dcbc78', c: '#a89880', C: '#c4b49c'});
  for (const k of ['shambler', 'crawler', 'archer', 'pudgeon', 'cinderling', 'ashcaster', 'ashhound', 'shardling', 'warden', 'blastcap', 'spider', 'spiderB']) { for (const n of [1, 2]) { SPR[k + 'T' + n] = tint(SPR[k], TOUGH_TINT[n]); SPR[k + 'T' + n + 'L'] = flip(SPR[k + 'T' + n]); } SPR[k + 'L'] = flip(SPR[k]); SPR[k + 'H'] = tint(SPR[k], 'rgba(255,255,255,0.6)'); SPR[k + 'HL'] = flip(SPR[k + 'H']); }
}


// tools in the miner's hand (8x8, handle at bottom-left), any kind in any material
const HELD_ROWS = {
  pick: ['..cccc..', '.c....c.', 'c..b...c', '...b....', '..b.....', '..b.....', '.b......', 'b.......'],
  axe: ['...ccc..', '..cCCc..', '..cCb...', '...b....', '..b.....', '..b.....', '.b......', 'b.......'],
  shovel: ['....cc..', '...cCCc.', '...cCc..', '...b....', '..b.....', '..b.....', '.b......', 'b.......'],
  hoe: ['.ccc....', '...cb...', '...b....', '...b....', '..b.....', '..b.....', '.b......', 'b.......'],
  sword: ['.......c', '......cc', '.....cc.', '....cc..', '.g.cc...', '..gc....', '.bg.....', 'b.g.....']
};
// a bow held up, string on the left, ready to flip for facing left
const BOW_ROWS = ['.sbb....', '.s..b...', '.s...b..', '.s...b..', '.s...b..', '.s...b..', '.s..b...', '.sbb....'];
function bowSprite(left) {
  if (!SPR.bow) { const c = art(BOW_ROWS, {b: '#8a5a2a', s: '#e8e0d0'}); SPR.bow = [c, flip(c)]; }
  return SPR.bow[left ? 1 : 0];
}
function heldTool(kind, mat) {
  const key = kind + mat;
  if (!SPR.heldCache[key]) SPR.heldCache[key] = art(HELD_ROWS[kind] || HELD_ROWS.pick, {c: MAT_COL[mat][0], C: MAT_COL[mat][1], b: '#7a5530', g: '#5a4a2a'});
  return SPR.heldCache[key];
}
// the miner recoloured for the helmet, leggings and boots it's wearing (chestplates are an overlay)
const SKIN_CACHE = {};
function minerSkin(helm, legs, boots) {
  const key = helm + '|' + legs + '|' + boots;
  if (SKIN_CACHE[key]) return SKIN_CACHE[key];
  const pal = Object.assign({}, SPR.base.pal);
  if (helm) { pal.H = MAT_COL[helm][0]; pal.h = MAT_COL[helm][1]; }
  if (legs) { pal.O = MAT_COL[legs][0]; pal.o = MAT_COL[legs][1]; }
  if (boots) pal.K = MAT_COL[boots][1];
  const R = SPR.base.legs.map(l => art(SPR.base.top.concat(l), pal)), hurt = R.map(c => tint(c, 'rgba(255,70,60,0.55)'));
  return (SKIN_CACHE[key] = {R, L: R.map(flip), hurt, hurtL: hurt.map(flip)});
}
