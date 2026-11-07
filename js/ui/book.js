// Burrow UI · book.js — The scrapbook: small pictures of the big moments, the album, the road map, and a look back when you sit down again.
// The pages are part of the world (stats.book, stats.road). The pictures live in this browser under burrow.book.<seed>, so a save file carries the pages without them.
'use strict';

const BOOK_INDEX = 'burrow.books.v1', BOOK_W = 320, BOOK_H = 200, BOOK_PICS = window.BurrowApp ? 240 : 90, BOOK_WORLDS = window.BurrowApp ? 12 : 3, BOOK_ZOOM = [4, 16];
const BOOK_BIOME = ['#dfe9ef', '#3f7d31', '#8bb44a', '#d8c98a', '#5d7058', '#b5583a', '#d08a2e', '#b5a24a'];
const BOOK_MARK = {camp: ['⛺', 'Camp'], keep: ['▣', 'Keep'], village: ['⌂', 'Village'], ruin: ['✕', 'Ruin']};
const bookBox = document.getElementById('bookBox'), bookNew = document.getElementById('bookNew');
const Book = {
  pics: {}, seed: null, dirty: false, seenTo: 0, view: 'album', page: null, rd: null,
  key: seed => 'burrow.book.' + seed,
  open(gg) {
    this.flush();
    this.seed = gg.seed; this.pics = store.get(this.key(gg.seed)) || {}; this.dirty = false;
    this.seenTo = gg.stats.bookN || 0;
    const worlds = [gg.seed].concat((store.get(BOOK_INDEX) || []).filter(s => s !== gg.seed));
    for (const s of worlds.slice(BOOK_WORLDS)) localStorage.removeItem(this.key(s));
    store.set(BOOK_INDEX, worlds.slice(0, BOOK_WORLDS));
    this.badge();
  },
  flush() {
    if (!this.dirty || this.seed === null) return;
    for (let tries = 0; tries < 6; tries++) { if (store.set(this.key(this.seed), this.pics)) break; this.trim(Object.keys(this.pics).length - 10); }
    this.dirty = false;
  },
  // something more important needs the room: other worlds' pictures first, then the oldest of this one's
  free() {
    const others = (store.get(BOOK_INDEX) || []).filter(s => s !== this.seed && localStorage.getItem(this.key(s)) !== null);
    if (others.length) { localStorage.removeItem(this.key(others[others.length - 1])); return true; }
    const n = Object.keys(this.pics).length;
    if (!n) return false;
    this.trim(n - 15);
    if (!store.set(this.key(this.seed), this.pics)) localStorage.removeItem(this.key(this.seed));
    return true;
  },
  // too many: the everyday ones go first, the keeps and villages last
  trim(most) {
    const ids = Object.keys(this.pics).map(Number), kind = {};
    for (const p of g.stats.book || []) kind[p.id] = p.kind;
    const rank = id => ({keep: 2, village: 2, ruin: 2, moment: 1}[kind[id]] || 0);
    ids.sort((a, b) => rank(a) - rank(b) || a - b);
    while (ids.length > Math.max(0, most)) delete this.pics[ids.shift()];
  },
  camera() {
    if (!this.rd) {
      const c = document.createElement('canvas'); c.width = BOOK_W; c.height = BOOK_H;
      this.rd = new R.Renderer(c); this.rd.wild = new Map();
    }
    return this.rd;
  },
  snap(s, now) {
    const r = this.camera();
    r.realm = g.realm || 'over'; // a camera of its own, or the main view would lose its place
    r.zoom = Math.max(BOOK_ZOOM[0], Math.min(BOOK_ZOOM[1], Math.floor(BOOK_W / Math.max(14, s.wide))));
    r.cam.x = s.x + 0.5; r.cam.y = s.y;
    try {
      r.draw(g, now, {dpr: 1, world: false, still: true, rightPad: 0});
      this.pics[s.id] = r.cv.toDataURL('image/jpeg', 0.62);
      this.dirty = true;
      if (Object.keys(this.pics).length > BOOK_PICS) this.trim(BOOK_PICS);
    } catch (e) { /* a page without a picture still has its words */ }
  },
  update(now) {
    if (g.snaps && g.snaps.length) {
      for (const s of g.snaps) if (s.realm === (g.realm || 'over')) this.snap(s, now);
      g.snaps.length = 0;
      this.flush();
      this.badge();
      if (bookBox.classList.contains('show') && this.view === 'album' && !this.page) this.render();
    }
  },
  badge() {
    const n = (g && g.stats.bookN || 0) - this.seenTo;
    bookNew.hidden = n <= 0; bookNew.textContent = n > 99 ? '99+' : n;
  },
  pages: () => (g.stats.book || []).slice().reverse(),
  card(p) {
    const pic = this.pics[p.id];
    return `<button class="book-page book-${esc(p.kind)}" data-page="${p.id}">${pic ? `<img src="${pic}" alt="">` : '<span class="book-nopic">No picture</span>'}<b>${esc(p.title)}</b><span>Day ${p.day}</span></button>`;
  },
  album() {
    const pages = this.pages();
    return pages.length ? `<div class="book-grid">${pages.map(p => this.card(p)).join('')}</div>` : '<p class="save-note">Nothing yet. The big moments will turn up here as they happen.</p>';
  },
  road() {
    const road = g.stats.road || [], pad = 40;
    if (!road.length) return '<p class="save-note">The road starts here. Camps, keeps, villages and ruins get marked as the miner reaches them.</p>';
    const a = road[0].at, b = road[road.length - 1].at, wide = Math.max(560, Math.min(6000, Math.round((b - a) / 2.5))), X = at => pad + (b > a ? (at - a) / (b - a) * (wide - pad * 2) : 0);
    let bars = '', marks = '';
    road.forEach((p, i) => { const q = road[i + 1], x0 = X(p.at), x1 = q ? X(q.at) : x0 + 8; bars += `<i style="left:${x0}px;width:${Math.max(2, x1 - x0)}px;background:${BOOK_BIOME[p.biome] || '#777'}"></i>`; });
    road.forEach((p, i) => { const m = BOOK_MARK[p.kind] || ['•', '']; marks += `<span class="road-mark road-${esc(p.kind)} ${i % 2 ? 'low' : ''}" style="left:${X(p.at)}px" title="${esc(m[1])}: day ${p.day}"><em>${m[0]}</em><small>${esc(p.name)}</small></span>`; });
    const here = g.stats.farthest || b;
    return `<p class="save-note">${road.filter(p => p.kind === 'camp').length} camps, ${road.filter(p => p.kind === 'village').length} villages and ${road.filter(p => p.kind === 'ruin').length} ruins so far. ${bigNum(here)} blocks from where it all began. Scroll along the road.</p>
      <div class="road-wrap"><div class="road" style="width:${wide}px">${bars}${marks}</div></div>`;
  },
  full(p) {
    const pages = this.pages(), i = pages.indexOf(p), pic = this.pics[p.id];
    return `<div class="book-full">${pic ? `<img src="${pic}" alt="">` : '<span class="book-nopic big">No picture</span>'}
      <h3>${esc(p.title)}</h3><p class="book-when">Day ${p.day}${p.under ? ', in the Underworld' : ''}</p><p>${esc(p.text || '')}</p>
      <div class="end-actions"><button data-go="${pages[i + 1] ? pages[i + 1].id : ''}" ${pages[i + 1] ? '' : 'disabled'}>Older</button><button data-back="1">All pages</button><button data-go="${pages[i - 1] ? pages[i - 1].id : ''}" ${pages[i - 1] ? '' : 'disabled'}>Newer</button></div></div>`;
  },
  render() {
    const card = bookBox.querySelector('.end-card'), p = this.page && (g.stats.book || []).find(q => q.id === this.page);
    const tabs = `<div class="book-tabs"><button data-view="album" aria-pressed="${this.view === 'album'}">Album</button><button data-view="road" aria-pressed="${this.view === 'road'}">The road</button><button data-close="1">Close</button></div>`;
    card.innerHTML = `<h2>Scrapbook</h2>${tabs}${p ? this.full(p) : this.view === 'road' ? this.road() : this.album()}`;
  },
  show() {
    this.seenTo = g.stats.bookN || 0; this.page = null; this.badge(); this.render();
    bookBox.classList.add('show');
  },
  // a look back at the last few pages when you sit down again
  lastTime() {
    const pages = this.pages().slice(0, 4);
    if (!pages.length || prefs.noLookBack) return;
    this.page = null;
    bookBox.querySelector('.end-card').innerHTML = `<h2>Last time</h2><p class="save-note">Day ${g.day}. Here’s where you left the miner.</p>
      <div class="book-grid">${pages.map(p => this.card(p)).join('')}</div>
      <div class="end-actions"><button data-close="1">Carry on watching</button><button data-never="1">Don’t show this again</button></div>`;
    bookBox.classList.add('show');
  }
};
document.getElementById('bookOpen').addEventListener('click', () => Book.show());
bookBox.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (e.target === bookBox || (b && b.dataset.close)) { bookBox.classList.remove('show'); return; }
  if (!b) return;
  if (b.dataset.never) { prefs.noLookBack = true; savePrefs(); bookBox.classList.remove('show'); return; }
  if (b.dataset.view) { Book.view = b.dataset.view; Book.page = null; }
  else if (b.dataset.back) Book.page = null;
  else if (b.dataset.page) Book.page = +b.dataset.page;
  else if (b.dataset.go) Book.page = +b.dataset.go;
  else return;
  Book.render();
});
