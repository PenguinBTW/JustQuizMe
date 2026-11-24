// Mode badges — self-mounts a small engagement-mix badge row into each set
// card's footer. Reads the portal's existing /api/<portal>/scores store
// (cached per portal namespace); writes no stats of its own.
import { badgeModel, countsFromScores } from './modeBadges.js';

const PORTAL = (location.pathname.match(/^\/(maths|physics|cs)\//) || [])[1];
const CACHE_KEY = `jqm.modeBadges.${PORTAL}`;
let model = null;

const style = document.createElement('style');
style.textContent = `
  .mode-badges { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
  .mode-badge { font:600 10.5px/1.4 ui-monospace,monospace; padding:2px 8px;
    border-radius:10px; background:rgba(255,255,255,0.07); color:var(--ink-muted,#9aa); }
  .mode-badge b { color:var(--ink-secondary,#ccd); font-weight:700; }
`;
document.head.appendChild(style);

async function load() {
  if (model) return model;
  let scores = [];
  try { scores = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch {}
  try {
    const r = await fetch(`/api/scores`);
    if (r.ok) {
      scores = await r.json();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(scores)); } catch {}
    }
  } catch {}
  model = badgeModel(countsFromScores(scores));
  return model;
}

function decorate(card, m) {
  if (card.querySelector('.mode-badges')) return;
  const row = document.createElement('div');
  row.className = 'mode-badges';
  for (const b of m.badges) {
    const chip = document.createElement('span');
    chip.className = `mode-badge mode-${b.kind}`;
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
  if (!model) return;
  document.querySelectorAll('.subtopic-card').forEach((c) => decorate(c, model));
}

load().then(sweep);
new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true });
