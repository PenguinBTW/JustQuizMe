// Mode badges — self-mounts a small engagement-mix badge row into each set
// card's footer. Reads the portal's existing /api/<portal>/scores store
// (cached per portal namespace); writes no stats of its own.
import { badgeModel, countsFromScores } from './modeBadges.js';

const PORTAL = (location.pathname.match(/^\/(maths|physics|cs)\//) || [])[1];
const CACHE_KEY = `jqm.modeBadges.${PORTAL}`;
const STALE_MS = 30000;
let model = null;
let lastFetch = 0;
let pending = null;

const style = document.createElement('style');
style.textContent = `
  .mode-badges { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; flex-basis:100%; }
  .mode-badge { font:600 10.5px/1.4 ui-monospace,monospace; padding:2px 8px;
    border-radius:10px; background:rgba(255,255,255,0.07); color:var(--ink-muted,#9aa); }
  .mode-badge b { color:var(--ink-secondary,#ccd); font-weight:700; }
`;
document.head.appendChild(style);

async function load(force = false) {
  if (model && !force) return model;
  if (pending) return pending;
  pending = (async () => {
    let scores = [];
    try { scores = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch {}
    try {
      // portal namespaced endpoint — /api/scores falls through to index.html
      const r = await fetch(`/${PORTAL}/api/scores`);
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
        scores = await r.json();
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(scores)); } catch {}
      }
    } catch {}
    model = badgeModel(countsFromScores(scores));
    lastFetch = Date.now();
    pending = null;
    return model;
  })();
  return pending;
}

function decorate(card, m) {
  if (card.querySelector('.mode-badges')) {
    // refresh counts on an already-decorated card after a new attempt —
    // compare before writing or each sweep retriggers the observer forever
    card.querySelectorAll('.mode-badge[data-kind]').forEach((chip, i) => {
      const b = m.badges[i];
      if (!b) return;
      const next = b.kind === 'new' ? `${b.icon} new` : `${b.icon} ${b.kind} ×${b.count}`;
      if (chip.textContent !== next) chip.textContent = next;
    });
    const more = card.querySelector('.mode-badge:not([data-kind])');
    const moreText = m.extra > 0 ? `+${m.extra} more` : '';
    if (more) {
      if (more.textContent !== moreText) more.textContent = moreText;
    } else if (m.extra > 0) {
      const chip = document.createElement('span');
      chip.className = 'mode-badge';
      chip.textContent = moreText;
      card.querySelector('.mode-badges')!.appendChild(chip);
    }
    return;
  }
  // set/picker cards carry a run-start action; results/info cards don't
  if (!card.classList.contains('subtopic-card') &&
      !card.querySelector('[data-practice-start], [data-quiz-file], [data-exam-file], [data-practice-explore], .btn-practice-start, [data-idx]')) {
    return;
  }
  // flex-row set cards (cs practice) would pin the badges beside the buttons —
  // let the card wrap so the badge row lands in the footer
  const cs = getComputedStyle(card);
  if (cs.display === 'flex' && cs.flexWrap === 'nowrap') card.style.flexWrap = 'wrap';
  const row = document.createElement('div');
  row.className = 'mode-badges';
  for (const b of m.badges) {
    const chip = document.createElement('span');
    chip.className = `mode-badge mode-${b.kind}`;
    chip.dataset.kind = b.kind;
    chip.textContent = b.kind === 'new' ? `${b.icon} new` : `${b.icon} ${b.kind} ×${b.count}`;
    row.appendChild(chip);
  }
  if (m.extra > 0) {
    const more = document.createElement('span');
    more.className = 'mode-badge';
    more.textContent = `+${m.extra} more`;
    row.appendChild(more);
  }
  card.appendChild(row);
}

function sweep() {
  // scores may have changed since page load (a finished run refreshes them)
  if (lastFetch && Date.now() - lastFetch > STALE_MS) model = null;
  if (!model) { load().then(sweep); return; }
  document.querySelectorAll('.subtopic-card, .card')
    .forEach((c) => decorate(c, model));
}

load().then(sweep);
new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true });
