// Burrow UI · saves.js — Named saves (a list in this browser, or a file to keep), and the Move on button for the endless journey.
'use strict';

const SLOTS = 'burrow.slots.v1', slotKey = id => 'burrow.slot.' + id;
const savesBox = document.getElementById('savesBox'), moveBox = document.getElementById('moveBox'), moveOnBtn = document.getElementById('moveOnBtn'), moveSeg = document.getElementById('moveSeg'), saveFile = document.getElementById('saveFile');
const slotList = () => store.get(SLOTS) || [];
const saveLabel = () => g.m.journey ? (g.m.journey.camps ? 'Camp ' + g.m.journey.camps : 'On the road') + ', day ' + g.day : 'Home, day ' + g.day;
// false when the browser's storage is full
function saveSlot(name) {
  const id = Date.now().toString(36), meta = {id, name: name || saveLabel(), day: g.day, when: Date.now(), world: g.seed};
  if (!store.set(slotKey(id), saveSnapshot())) return false;
  if (!store.set(SLOTS, [meta].concat(slotList()))) { localStorage.removeItem(slotKey(id)); return false; }
  return true;
}
// saves made before they were squeezed take up far more room
for (const s of slotList()) { const o = store.get(slotKey(s.id)); if (o && !o.rle) store.set(slotKey(s.id), compactSave(o)); }
function deleteSlot(id) {
  localStorage.removeItem(slotKey(id));
  store.set(SLOTS, slotList().filter(s => s.id !== id));
}
function downloadSave(name, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: 'application/json'}));
  a.download = (name || 'burrow').replace(/[^\w -]+/g, '').trim().replace(/ +/g, '-') + '.burrow';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// a loaded place stays put: the miner mines around it until it's told to move on
function openSave(o) {
  const gg = readSave(o);
  if (!gg) { toast('That save could not be opened'); return; }
  B.holdJourney(gg);
  start(gg); saveGame(); setFollow(true); setWorld(false);
  closeSaves();
  toast('Save loaded');
}
function closeSaves() { savesBox.classList.remove('show'); }
// phones and some computers offer to install the site as an app: keep that offer for a button on this page
let installOffer = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installOffer = e; if (savesBox.classList.contains('show')) renderSaves(); });
addEventListener('appinstalled', () => { installOffer = null; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.BurrowApp) navigator.serviceWorker.register('sw.js').then(r => {
  // what this page has already loaded gets kept for offline
  const keep = () => { const w = r.active || navigator.serviceWorker.controller; if (w) w.postMessage({keep: [location.href].concat(performance.getEntriesByType('resource').map(e => e.name))}); };
  navigator.serviceWorker.ready.then(keep);
}).catch(() => {});
function renderSaves() {
  const rows = slotList().map(s => `<li class="save-row"><div><b>${esc(s.name)}</b><span>Day ${s.day} · World ${s.world} · ${new Date(s.when).toLocaleDateString()}</span></div>
    <button data-do="load" data-id="${s.id}">Load</button><button data-do="file" data-id="${s.id}">Download</button><button data-do="del" data-id="${s.id}">Delete</button></li>`).join('');
  savesBox.querySelector('.end-card').innerHTML = `<h2>Saves</h2>
    <div class="save-now"><input id="saveName" type="text" maxlength="40" placeholder="${esc(saveLabel())}" aria-label="Save name"><button id="saveHere">Save</button></div>
    ${rows ? `<ul class="save-list">${rows}</ul>` : '<p class="save-note">No saves yet. The game still saves itself as you go.</p>'}
    <p class="save-note">Loading a save replaces the world you’re watching, so save that first if you want it. This browser only holds a few saves. Download keeps one as a file.</p>
    <div class="end-actions"><button id="saveLoadFile">Load a file</button><button id="saveToFile">Download this world</button><button id="savesClose">Close</button></div>
    ${installOffer ? '<div class="end-actions"><button id="installApp">Install Burrow as an app</button></div>' : ''}`;
}
function openSaves() { renderSaves(); savesBox.classList.add('show'); }
document.getElementById('savesOpen').addEventListener('click', openSaves);
savesBox.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (e.target === savesBox || (b && b.id === 'savesClose')) return closeSaves();
  if (!b) return;
  const name = document.getElementById('saveName').value.trim(), id = b.dataset.id;
  if (b.id === 'saveHere') { toast(saveSlot(name) ? 'Saved' : 'No room left here. Delete a save, or use Download'); renderSaves(); }
  else if (b.id === 'saveToFile') downloadSave(name || saveLabel(), saveSnapshot());
  else if (b.id === 'saveLoadFile') saveFile.click();
  else if (b.id === 'installApp' && installOffer) { installOffer.prompt(); installOffer = null; renderSaves(); }
  else if (b.dataset.do === 'load') openSave(store.get(slotKey(id)));
  else if (b.dataset.do === 'file') downloadSave((slotList().find(s => s.id === id) || {}).name, store.get(slotKey(id)));
  else if (b.dataset.do === 'del') { deleteSlot(id); renderSaves(); }
});
saveFile.addEventListener('change', () => {
  const f = saveFile.files[0];
  saveFile.value = '';
  if (!f) return;
  f.text().then(text => { let o = null; try { o = JSON.parse(text); } catch (e) { /* openSave says so */ } openSave(o); });
});

// ---------- moving on ----------
function updateMoveOn() {
  const j = g.m.journey, show = !!g.stats.retired && !!g.stats.endSeen && !endOpen && (!!j || !B.inUnder(g)), label = j && !j.hold ? 'Stay here' : 'Move on';
  if (moveSeg.hidden === show) moveSeg.hidden = !show;
  if (moveOnBtn.textContent !== label) moveOnBtn.textContent = label;
}
// the first time means leaving home for good, so it asks. After that it's only a camp
function askMoveOn() {
  const j = g.m.journey;
  if (!j) { moveBox.classList.add('show'); return; }
  if (j.hold) { if (B.moveOn(g)) { saveGame(); toast(B.inUnder(g) ? 'The miner will move on after this trip' : 'The miner is moving on'); } else toast('The miner can’t leave from here just yet'); return; }
  const road = j.stage === 'travel';
  B.holdJourney(g); saveGame();
  toast(road ? 'The miner will make camp at the next good spot' : 'The miner is staying here');
}
function goNow() { moveBox.classList.remove('show'); if (B.moveOn(g)) { saveGame(); toast('The miner is moving on'); } else toast('The miner can’t leave from here just yet'); }
moveOnBtn.addEventListener('click', askMoveOn);
document.getElementById('moveGo').addEventListener('click', goNow);
document.getElementById('moveStay').addEventListener('click', () => moveBox.classList.remove('show'));
document.getElementById('moveSave').addEventListener('click', () => {
  if (!saveSlot('')) downloadSave(saveLabel(), saveSnapshot()); // no room in this browser: it goes to a file instead
  goNow();
});
