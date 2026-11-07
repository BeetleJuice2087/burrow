// Burrow sim · book.js — The scrapbook's pages and the road behind the miner (stats.book, stats.road). The page takes the pictures: g.snaps asks for them, and isn't saved.
// Plain script (no modules): shares top-level names with the other sim files. Load order is set in index.html.
// Pages are picked by hash, never g.rng, so keeping a scrapbook doesn't reshuffle a run.
'use strict';

const BOOK_MOST = 240, ROAD_MOST = 400, BOOK_GRIT_EVERY = 25, BOOK_KO_GAP = 3, BOOK_CLOSE = 0.2;
const BOOK_MOMENTS = new Set(['night1', 'hut', 'pet', 'chest', 'trader', 'journey', 'underworld', 'spawner', 'deep', 'bottom', 'storm', 'harvest', 'first_kill', 'farm', 'c_gem_pick', 'gem_pick']);
const BOOK_CLOSE_LINES = ['That was too close.', 'Saw my whole life. It was mostly rock.', 'Still standing. Just.', 'I would like to not do that again.'];
const BOOK_GROW_LINES = ['Nobody asked for this. It looks great.', 'It keeps getting bigger. I keep having ideas.', 'One more room and then I am done. Probably.', 'Stood back and had a good look at it. Yes.'];
const BOOK_GRIT_LINES = ['Getting good at this. Or at least still here.', 'Harder to kill these days. So are they.', 'My knees disagree, but the numbers are going up.'];

function bookPage(g, kind, title, text, x, y, wide) {
  const s = g.stats, j = g.m.journey, id = s.bookN = (s.bookN || 0) + 1;
  s.book = s.book || [];
  s.book.push({id, kind, title, text, day: g.day, at: x + (j ? j.off : 0), under: inUnder(g) || undefined});
  if (s.book.length > BOOK_MOST) s.book.shift();
  g.snaps = g.snaps || [];
  g.snaps.push({id, x, y, wide: wide || 24, realm: g.realm || 'over'});
  if (g.snaps.length > 12) g.snaps.shift();
}
function roadMark(g, kind, name, x) {
  const s = g.stats, j = g.m.journey;
  s.road = s.road || [];
  s.road.push({kind, name, day: g.day, at: x + (j ? j.off : 0), biome: g.w.biome[x]});
  if (s.road.length > ROAD_MOST) s.road.shift();
}
const BOOK_EXTRA_LINES = {night1: 'Made it to morning. Nothing ate me. I call that a win.', q_home: 'Brought the crown home. It looks odd on the shelf. Good.'};
const bookMoment = id => BOOK_MOMENTS.has(id) || id.startsWith('q_') || id.startsWith('c_cinder');
function bookMilestone(g, id, label) {
  if (!bookMoment(id) || label.startsWith('Gave up')) return;
  const lines = DIARY_MILESTONES[id], pet = g.m.pet ? g.m.pet.name : '';
  bookPage(g, 'moment', label, lines ? lines[0].replace('#', pet) : BOOK_EXTRA_LINES[id] || '', g.m.x, g.m.y - 1);
}
function bookKO(g, src) {
  const s = g.stats, m = g.m;
  if (g.day - (s.bookKO || -99) < BOOK_KO_GAP) return;
  s.bookKO = g.day;
  bookPage(g, 'ko', 'Knocked out', DIARY_KO[src] || diaryPick(g, DIARY_FLAT, 6).replace('#', koName(src)), m.x, m.y - 1);
}
// worn right down and still on its feet
function bookClose(g, src) {
  const s = g.stats, m = g.m;
  if (m.hp <= 0 || m.hp > maxHp(m) * BOOK_CLOSE || s.bookClose === g.day || src === 'hunger') return;
  s.bookClose = g.day;
  bookPage(g, 'close', 'A close call', BOOK_CLOSE_LINES[skyHash(g.seed, g.day) % BOOK_CLOSE_LINES.length], m.x, m.y - 1);
}
function bookGrit(g, lv) {
  const s = g.stats;
  if (lv <= (s.gritBest || 0)) return; // only the first time up here
  s.gritBest = lv;
  if (lv % BOOK_GRIT_EVERY) return;
  bookPage(g, 'grit', 'Grit level ' + lv, BOOK_GRIT_LINES[skyHash(g.seed, lv) % BOOK_GRIT_LINES.length], g.m.x, g.m.y - 1);
}
// the whole keep in the picture
function bookKeep(g, title, text) {
  const m = g.m, k = m.journey.keep;
  bookPage(g, 'keep', title, text, k ? (k.x0 + k.x1) >> 1 : m.home.x, (k ? k.F : m.home.y) - 3, k ? k.x1 - k.x0 + 8 : 24);
}
