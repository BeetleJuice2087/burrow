// Burrow render · crops.js — The growth stages of the farm's crops, one picture per cropStage().
'use strict';

const CROP_ART = {};
function buildCrops() {
  const wheat = [
    ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '..g...g..g...g..', '..g.g.g..g.g.g..', '..g.g.g..g.g.g..', '.gg.g.g.gg.g.gg.', '.gg.g.ggggggggg.'],
    ['................', '................', '................', '................', '................', '................', '..g.....g....g..', '..g.g...g.g..g..', '..g.g.g.g.g..g..', '.gg.g.g.g.g.gg..', '.gg.g.ggg.g.gg..', '..g.g.g.g.g..g..', '..g.ggg.g.ggg...', '..g.g.g.g.g.g...', '.gg.g.g.g.g.gg..', '.gg.g.ggggggggg.'],
    ['................', '................', '..Y.....Y....Y..', '..g.Y...g.Y..g..', '..g.g.Y.g.g..g..', '..g.g.g.g.g..g..', '..g.g.g.g.g.gg..', '.gg.g.g.g.g.gg..', '.gg.g.ggg.g.gg..', '..g.g.g.g.g..g..', '..g.ggg.g.ggg...', '..g.g.g.g.g.g...', '..g.g.g.g.g.g...', '.gg.g.g.g.g.gg..', '.gg.g.g.g.g.gg..', '.gg.g.ggggggggg.'],
    ['...Y.....Y...Y..', '..YyY...YyY.YyY.', '..YyYY..YyYYYyY.', '..YyYyY.YyYyYyY.', '...tYyY..tYyYt..', '...t.Y....tY.t..', '...t.t.t..t..t..', '...t.t.t..t..t..', '...t.t.t..t.tt..', '..tt.t.t..t.tt..', '..tt.t.tt.t.tt..', '...t.t.t..t..t..', '...t.ttt..ttt...', '...t.t.t..t.t...', '..tt.t.t.tt.tt..', '..tt.t.ttttttt..']];
  const potato = [
    ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '...g.......g....', '..ggg.....ggg...', '...g...g...g....', '...g..ggg..g....'],
    ['................', '................', '................', '................', '................', '................', '................', '.....gg....gg...', '...ggGgg..gGgg..', '..gGGggg.gGGgg..', '..ggggGg.gggGg..', '...ggg.....gg...', '...g.gg.gg.g....', '..ggGggggGgg....', '...gggggggg.....', '.....g..g.......'],
    ['................', '................', '................', '................', '....gg.....gg...', '..ggGgg...gGgg..', '.gGGggg..gGGggg.', '.gggggGg.gggggGg', '..gGgggggggGggg.', '...ggGggGggggg..', '...gggggggGgg...', '..ggGggggggggg..', '..gggggGgggGgg..', '...ggggggggg....', '.....gg.gg......', '.....g...g......'],
    ['................', '................', '.....p.....p....', '....pWp...pWp...', '.....pgg..ggp...', '..ggGgg...gGgg..', '.gGGggg.pgGGggg.', '.gggggGpWpggggGg', '..gGggggpggGggg.', '...ggGggGggggg..', '...gggggggGgg...', '..ggGggggggggg..', '..gggggGgggGgg..', '...ggggggggg....', '.....gg.gg......', '.....g...g......']];
  const pal = {g: '#5a9a3a', G: '#7ab84a', Y: '#e8c84a', y: '#c89a2e', t: '#c8a848', p: '#b48ae0', W: '#f0e8a0'};
  CROP_ART[T.WHEAT] = wheat.map(r => art(r, pal));
  CROP_ART[T.POTATO_PLANT] = potato.map(r => art(r, pal));
  FURN[T.WILD_POTATO] = CROP_ART[T.POTATO_PLANT][3];
}
