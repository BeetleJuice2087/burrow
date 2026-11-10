// Burrow UI · panel.js — Right panel / phone sheet: Plan, Pack, Stats and Log tabs.
'use strict';

// ---------- panel ----------
const panel = document.getElementById('panel'), body = document.getElementById('body');
let tab = prefs.tab;
const MS_FOR_GOAL = {bench: 'place_bench', wood_pick: 'c_wood_pick', stone_pick: 'c_stone_pick', stone_sword: 'c_stone_sword', furnace: 'place_furnace', torch: 'c_torch', bed: 'bed', hut: 'hut', copper_armor: 'c_copper_armor', iron_pick: 'c_iron_pick', iron_sword: 'c_iron_sword', iron_armor: 'c_iron_armor', gem_pick: 'c_gem_pick', workshop: 'workshop2', decorate: 'decorate2', finish: 'finish', storage: 'storage', gate: 'gate', descend: 'underworld', cinder_pick: 'c_cinder_pick', cinder_sword: 'c_cinder_sword', cinder_set: 'c_cinder_armor', reinforced: 'c_reinforced_pick', rod: 'c_fishing_rod', fish: 'first_fish'};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const ORDER = ['log', 'planks', 'stick', 'leaf', 'dirt', 'cobble', 'sand', 'sandstone', 'coal', 'raw_copper', 'raw_iron', 'raw_gold', 'gem', 'copper_ingot', 'iron_ingot', 'gold_ingot', 'torch', 'bench', 'furnace', 'bed', 'door', 'chest', 'berries', 'apple', 'bread', 'raw_meat', 'cooked_meat'];
// big numbers: 1.23K, 4.56M ... up to Uvg (10^66), with the exact value on hover
const BIG_NAMES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg', 'Uvg'];
function bigNum(n) {
  n = n || 0;
  if (Math.abs(n) < 1000) return String(Math.round(n));
  const last = BIG_NAMES.length - 1;
  let v = Math.abs(n), t = 0;
  while (v >= 1000 && t < last) { v /= 1000; t++; }
  if (v >= 999.5 && t < last) { v /= 1000; t++; } // 999.9K rounds up to 1.00M, not 1000K
  return (n < 0 ? '-' : '') + v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0) + BIG_NAMES[t];
}
const exactNum = (n, unit) => (n || 0).toLocaleString('en-US', {maximumFractionDigits: 0}) + (unit ? ' ' + unit : '');
// distance climbs the units as it grows: ft, yd, m, km, then ml (one tile is one meter)
function distanceParts(meters) {
  const m = meters || 0, num = (v, d) => v.toLocaleString('en-US', {maximumFractionDigits: d, minimumFractionDigits: d});
  if (m < 30.48) return [num(m * 3.28084, 0), 'ft'];
  if (m < 91.44) return [num(m * 1.09361, 0), 'yd'];
  if (m < 1000) return [num(m, 0), 'm'];
  if (m < 1609.344) return [num(m / 1000, 2), 'km'];
  const mi = m / 1609.344;
  return [num(mi, mi < 100 ? 2 : 1), 'ml'];
}
const big = (n, unit) => `<span class="big" title="${exactNum(n, unit)}">${bigNum(n)}</span>`;
function planHtml() {
  const m = g.m; let html = '<ul class="ladder">';
  let curFound = false;
  for (const G of B.GOALS) {
    const done = G.done(g, m);
    const ms = g.stats.milestones.find(s => s.id === (MS_FOR_GOAL[G.id] || G.id));
    let cls = done ? 'done' : '';
    if (!done && !curFound) { cls = 'cur'; curFound = true; }
    html += `<li class="${cls}"><span class="mark"></span><span>${esc(G.label)}</span><span class="when">${ms ? runTime(ms.tick) : ''}</span>`;
    if (cls === 'cur' && m.chain && m.chain.length > 1) html += `<span class="chain">${m.chain.slice(1).map(c => `<span>${esc(c)}</span>`).join('')}</span>`;
    html += '</li>';
  }
  return html + '</ul>';
}
function packHtml() {
  const m = g.m;
  const gear = [[B.equipped(m, 'pick'), 'Pickaxe'], [B.equipped(m, 'sword'), 'Weapon'], [m.inv.shield ? 'shield' : null, 'Shield'],
    [B.armorPiece(m, 'helmet'), 'Helmet'], [B.armorPiece(m, 'chest'), 'Chest'], [B.armorPiece(m, 'legs'), 'Legs'], [B.armorPiece(m, 'boots'), 'Boots'],
    [B.equipped(m, 'axe'), 'Axe'], [B.equipped(m, 'shovel'), 'Shovel']];
  const used = new Set(gear.map(s => s[0]).filter(Boolean));
  const bar = k => { const f = Math.max(0, B.durLeft(m, k) / B.DUR[k]); return `<span class="dur"><i style="width:${f * 100}%;background:${f > 0.5 ? '#7fd36b' : f > 0.2 ? '#f0c24a' : '#e8604a'}"></i></span>`; };
  const slot = (k, label) => `<div class="slot">${k ? `<img src="${R.icon(k)}" alt="">` : '<span class="empty"></span>'}<b>${k ? esc(B.ITEMS[k]) : 'None'}</b>${k && B.DUR[k] ? bar(k) : ''}${label}${k && m.inv[k] > 1 ? ` · ${big(m.inv[k] - 1)} spare` : ''}</div>`;
  let html = `<h3>Equipped</h3><div class="equip">${gear.map(s => slot(s[0], s[1])).join('')}</div><h3>Pack</h3><div class="grid">`;
  const keys = Object.keys(m.inv).filter(k => !used.has(k)).sort((a, b) => (ORDER.indexOf(a) + 99) % 999 - (ORDER.indexOf(b) + 99) % 999);
  if (!keys.length) html += '<p style="color:var(--muted);grid-column:1/-1;margin:0">Empty. The miner hasn’t picked anything up yet.</p>';
  for (const k of keys) html += `<div class="cell" title="${esc(B.ITEMS[k] || k)} × ${exactNum(m.inv[k])}"><img src="${R.icon(k)}" alt="${esc(B.ITEMS[k] || k)}"><span class="n">${bigNum(m.inv[k])}</span></div>`;
  html += '</div>';
  const stored = Object.keys(m.stash || {}).sort((a, b) => (ORDER.indexOf(a) + 99) % 999 - (ORDER.indexOf(b) + 99) % 999);
  if (stored.length) {
    html += '<h3>In the chests at home</h3><div class="grid">';
    for (const k of stored) html += `<div class="cell" title="${esc(B.ITEMS[k] || k)} × ${exactNum(m.stash[k])}"><img src="${R.icon(k)}" alt="${esc(B.ITEMS[k] || k)}"><span class="n">${bigNum(m.stash[k])}</span></div>`;
    html += '</div>';
  }
  const left = (m.journey && m.journey.chests || []).slice(-3).reverse();
  for (const c of left) {
    html += `<h3>Left behind · ${c.camp ? 'camp ' + c.camp : 'the old home'}${c.camp ? ', ' + esc(c.biome) : ''}</h3><div class="grid">`;
    const keys2 = Object.keys(c.items).sort((a, b) => (ORDER.indexOf(a) + 99) % 999 - (ORDER.indexOf(b) + 99) % 999);
    for (const k of keys2) html += `<div class="cell" title="${esc(B.ITEMS[k] || k)} × ${exactNum(c.items[k])}"><img src="${R.icon(k)}" alt="${esc(B.ITEMS[k] || k)}"><span class="n">${bigNum(c.items[k])}</span></div>`;
    html += '</div>';
  }
  return html;
}
function statsHtml() {
  const s = g.stats, T = B.T;
  const mined = Object.values(s.mined).reduce((a, b) => a + b, 0);
  const crafted = Object.values(s.crafted).reduce((a, b) => a + b, 0);
  const tile = (k, v, unit, sub) => `<div class="tile"><div class="k">${k}</div><div class="v">${big(v, unit)}${unit || sub ? ` <small>${unit || sub}</small>` : ''}</div></div>`;
  let html = '<h3>This world</h3><div class="tiles">' +
    tile('Days survived', g.day - 1) + tile('Deepest point', s.deepest, 'm') +
    tile('Blocks mined', mined) + tile('Blocks placed', s.placed) +
    `<div class="tile"><div class="k">Distance walked</div><div class="v"><span class="big" title="${exactNum(s.distance, 'm')}">${distanceParts(s.distance)[0]}</span> <small>${distanceParts(s.distance)[1]}</small></div></div>` +
    tile('Tiles travelled', s.walked) +
    tile('Torches placed', s.torches) + tile('Items stored', s.stored || 0) + tile('Spawners broken', s.spawners || 0) + tile('Underworld trips', s.underTrips || 0) +
    tile('Items crafted', crafted) + tile('Meals eaten', s.eaten) +
    tile('Grit level', B.gritLevel(g.m)) + tile('Best Grit level', Math.max(s.gritBest || 0, B.gritLevel(g.m))) + tile('Levels lost', s.gritLost || 0) + (g.m.pal ? tile('Companion', g.m.pal.name) : '') + (s.palDug ? tile('Dug by companions', s.palDug) : '') + tile('Monsters beaten', s.kills) + tile('Knockouts', s.deaths) + tile('Arrows shot', s.shots || 0) +
    tile('Fish caught', s.fish || 0) + tile('Trades made', s.trades || 0) + (s.villages || s.ruins ? tile('Villages visited', s.villages || 0) + tile('Ruins searched', s.ruins || 0) : '') + tile('Crops harvested', s.harvested || 0) + (g.m.journey ? tile('Camps made', s.camps || 0) + tile('Rooms added', s.keepsGrown || 0) + tile('Keeps built', s.keeps || 0) + tile('Things left behind', s.leftBehind || 0) + tile('Lands crossed', s.lands || 0) + tile('Blocks east', g.m.journey.off + g.m.x - 300) : '') + tile('Gear worn out', s.broken || 0) + tile('Repairs', s.repaired || 0) +
    tile('Collection', B.collectionCount(g), '', '/ ' + B.COLLECTION.length) + '</div>' +
    '<p class="big-note">Big numbers use K, M, B, T, Qa, Qi, Sx and on up to Uvg (10^66). Hover a number for the exact value.</p>';
  const ores = [['Coal', T.COAL, '#77778a'], ['Copper', T.COPPER, '#d9844a'], ['Iron', T.IRON, '#dcc2ae'], ['Gold', T.GOLD, '#f5cd45'], ['Gem', T.GEM, '#4fe0d6']];
  const max = Math.max(1, ...ores.map(o => s.mined[o[1]] || 0));
  html += '<h3>Ore mined</h3><div class="ores">' + ores.map(([n, t, c]) => { const v = s.mined[t] || 0; return `<div class="ore"><span>${n}</span><div class="track"><div class="fill" style="width:${v / max * 100}%;background:${c}"></div></div><span class="c">${big(v)}</span></div>`; }).join('') + '</div>';
  html += '<h3>Milestones</h3>';
  if (!s.milestones.length) html += '<p style="color:var(--muted);margin:0">Nothing yet. First up: punching a tree.</p>';
  else {
    html += '<ul class="timeline">' + s.milestones.map(ms => {
      const best = records[ms.id];
      const pb = best !== undefined && best === ms.tick;
      return `<li><span class="t">${runTime(ms.tick)}</span><span>${esc(ms.label)}<span class="best${pb ? ' pb' : ''}">Day ${ms.day}${best !== undefined ? ' · ' + (pb ? 'best run so far' : 'best ' + runTime(best)) : ''}</span></span></li>`;
    }).join('') + '</ul>';
  }
  return html;
}
// ---------- recipe book ----------
const RECIPE_KINDS = [['all', 'All'], ['gear', 'Gear'], ['survival', 'Survival'], ['building', 'Building'], ['decor', 'Decor'], ['materials', 'Materials']];
const RK_SURVIVAL = new Set(['torch', 'bed', 'cooked_meat', 'cooked_fish', 'bucket', 'campfire', 'golden_apple', 'lantern', 'copper_torch', 'copper_lantern', 'fruit_pie', 'leaf_cloak', 'expedition_pack', 'mining_lantern', 'grapple', 'ember_treads', 'silk_net', 'blast_charge']);
const RK_MATERIALS = new Set(['planks', 'stick', 'sand', 'copper_ingot', 'iron_ingot', 'gold_ingot', 'iron_nugget', 'copper_nugget']);
const RK_DECOR = new Set(['pressure_plate', 'button', 'sign', 'boat', 'chest_boat', 'minecart', 'smooth_sandstone', 'chiseled_sandstone', 'cut_sandstone', 'coal_block', 'copper_block', 'iron_block', 'gold_block', 'gem_block']);
const STATION_NAME = {bench: 'Workbench', furnace: 'Furnace'};
function recipeKind(k) { return B.DUR[k] ? 'gear' : RK_SURVIVAL.has(k) ? 'survival' : RK_MATERIALS.has(k) ? 'materials' : RK_DECOR.has(k) ? 'decor' : 'building'; }
let recipeFilter = prefs.recipeFilter || 'all';
function recipesHtml() {
  const m = g.m, all = Object.keys(B.RECIPES), list = all.filter(k => recipeFilter === 'all' || recipeKind(k) === recipeFilter);
  const made = all.filter(k => g.stats.crafted[k]).length;
  let html = `<h3>Recipe book · ${all.length} recipes</h3><p class="rb-intro">The miner works these out itself: it gathers the ingredients, walks to the right station and crafts. It has made ${big(made)} of them so far.</p>`;
  html += '<div class="rb-filters">' + RECIPE_KINDS.map(([id, label]) => `<button data-rf="${id}" aria-pressed="${id === recipeFilter}">${label}</button>`).join('') + '</div><div class="rb-list">';
  for (const k of list) {
    const rc = B.RECIPES[k], can = Object.keys(rc.in).every(i => (m.inv[i] || 0) >= rc.in[i]), n = m.inv[k] || 0, c = g.stats.crafted[k] || 0;
    const ins = Object.keys(rc.in).map(i => `${rc.in[i]} ${esc(B.ITEMS[i] || i)}`).join(' + ');
    const where = [STATION_NAME[rc.st] || 'By hand'];
    if (n) where.push('in pack: ' + big(n));
    if (c) where.push('made ' + big(c));
    html += `<div class="rb-card${can ? ' can' : ''}${c ? ' made' : ''}"><img src="${R.icon(k)}" alt=""><div><b>${esc(B.ITEMS[k])} <em>×${rc.out}</em></b><span class="in">${ins}</span><span class="st">${where.join(' · ')}</span></div></div>`;
  }
  return html + '</div><p class="rb-key"><span class="sw can"></span>has the ingredients now · faded icon: not made yet</p>';
}
body.addEventListener('click', e => {
  const b = e.target.closest('[data-rf]'); if (!b) return;
  recipeFilter = prefs.recipeFilter = b.dataset.rf; savePrefs(); renderPanel(true);
});
function diaryHtml() {
  const pages = (g.stats.diary || []).slice().reverse();
  if (!pages.length) return '<p class="diary-empty">The first page gets written at the end of the day.</p>';
  return '<div class="diary">' + pages.map(p => `<article><h3>Day ${p.day}</h3><p>${esc(p.text)}</p></article>`).join('') + '</div>';
}
function logHtml() {
  return '<ul class="log">' + g.log.slice().reverse().map(l => `<li class="${l.text.startsWith('★') ? 'star' : ''}"><span class="d">Day ${l.day}</span><span>${esc(l.text.replace('★ ', ''))}</span></li>`).join('') + '</ul>';
}
let lastPanel = '';
function renderPanel(force) {
  if (!force && body.querySelector('.big:hover')) return; // hold still so the exact-value tooltip can show
  const html = tab === 'plan' ? planHtml() : tab === 'pack' ? packHtml() : tab === 'stats' ? statsHtml() : tab === 'recipes' ? recipesHtml() : tab === 'diary' ? diaryHtml() : logHtml();
  if (html !== lastPanel || force) { const st = body.scrollTop; body.innerHTML = html; body.scrollTop = st; lastPanel = html; }
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab; prefs.tab = tab; savePrefs();
  document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  body.scrollTop = 0; renderPanel(true);
  if (panel.classList.contains('collapsed')) toggleSheet(false);
}));
document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === tab));
function toggleSheet(c) { const col = c === undefined ? !panel.classList.contains('collapsed') : c; panel.classList.toggle('collapsed', col); prefs.collapsed = col; savePrefs(); }
panel.classList.toggle('collapsed', !!prefs.collapsed);
document.getElementById('handle').addEventListener('click', () => toggleSheet());
// desktop: fold the panel up to just the current goal (phones have the sheet handle instead)
const panelToggle = document.getElementById('panelToggle');
const panelFolded = () => panel.classList.contains('folded') && innerWidth > 860;
function foldPanel(f, loading) {
  panel.classList.toggle('folded', f);
  if (!loading) { prefs.panelFolded = f; savePrefs(); }
  panelToggle.setAttribute('aria-expanded', !f);
  panelToggle.setAttribute('aria-label', f ? 'Expand the panel' : 'Collapse the panel');
  panelToggle.title = (f ? 'Expand' : 'Collapse') + ' (P)';
}
panelToggle.addEventListener('click', () => foldPanel(!panel.classList.contains('folded')));
if (prefs.panelFolded) foldPanel(true, true);
document.getElementById('nowBox').addEventListener('click', () => { if (matchMedia('(max-width: 860px)').matches) toggleSheet(); });
