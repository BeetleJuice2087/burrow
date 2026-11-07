// Burrow UI · ending.js — The end screen: once the Ember crown is home, the run's story in numbers.
'use strict';

// ---------- end screen ----------
const endEl = document.getElementById('ending');
const END_MOMENTS = ['first_kill', 'c_gem_pick', 'gate', 'underworld', 'c_cinder_pick', 'q_citadel', 'q_warden', 'q_home'];
let endOpen = false, endPrevBest; // the best time before this run, caught as the milestone lands
function endingHtml() {
  const s = g.stats, t = s.retired, best = records.q_home;
  const mined = Object.values(s.mined).reduce((a, b) => a + b, 0), [far, unit] = distanceParts(s.distance || 0);
  const fresh = endPrevBest === undefined ? best === t : t < endPrevBest;
  const line = fresh && endPrevBest !== undefined ? `New best time! The old one was ${runTime(endPrevBest)}.` : fresh ? 'Your first finished run, so that’s your time to beat.' : `Your best is ${runTime(best)}.`;
  const stat = (n, label) => `<div><b>${n}</b><span>${label}</span></div>`;
  const moments = END_MOMENTS.map(id => s.milestones.find(q => q.id === id)).filter(Boolean)
    .map(q => `<li><span>${esc(q.label)}</span><time>${runTime(q.tick)}</time></li>`).join('');
  return `<img src="${R.icon('ember_crown')}" alt="">
    <h2>The miner retires</h2>
    <p class="end-sub">The Ember crown is home and the pickaxe is on the wall.</p>
    <p class="end-time"><b>${runTime(t)}</b><span>${esc(line)}</span></p>
    <div class="end-stats">${stat(s.retiredDay, 'days')}${stat(s.deaths, s.deaths === 1 ? 'knockout' : 'knockouts')}${stat(bigNum(s.kills), 'monsters beaten')}
      ${stat(s.underTrips || 0, 'Underworld trips')}${stat(far + ' ' + unit, 'walked')}${stat(bigNum(mined), 'blocks mined')}</div>
    <ul class="end-moments">${moments}</ul>
    ${s.diary && s.diary.length ? `<blockquote class="end-quote">${esc(s.diary[s.diary.length - 1].text)}</blockquote>` : ''}
    <div class="end-actions"><button id="endStay" class="end-go">Keep watching</button><button id="endJourney">Endless journey</button><button id="endNew">Start a new miner</button></div>
    <p class="end-note">A new miner replaces this world. Your best times stay. On the endless journey the miner packs up, walks east forever and camps along the way.</p>`;
}
function closeEnding() { endOpen = false; endEl.classList.remove('show'); g.stats.endSeen = true; saveGame(); }
function showEnding() {
  endOpen = true;
  endEl.querySelector('.end-card').innerHTML = endingHtml();
  endEl.classList.add('show');
  document.getElementById('endStay').addEventListener('click', closeEnding);
  document.getElementById('endNew').addEventListener('click', () => { closeEnding(); seedInput.value = ''; document.getElementById('yes').click(); });
  document.getElementById('endJourney').addEventListener('click', () => { closeEnding(); askMoveOn(); });
  document.getElementById('endStay').focus();
}
addEventListener('keydown', e => { if (endOpen && e.key === 'Escape') closeEnding(); });
