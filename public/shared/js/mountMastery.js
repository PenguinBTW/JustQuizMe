// Self-mounting "Mastery" heatmap panel for each portal's Stats view.
// Watches #stage via MutationObserver; appends a .mastery-card after the
// existing stats cards whenever the Stats view is rendered. Fetches the same
// /api/<subject>/quizzes + /api/<subject>/scores data the stats view uses.
// stats.js is intentionally untouched — this module lives entirely alongside it.

import { topicAccuracy, cellColor, taxonomyOrder, gridModel } from './masteryGrid.js';

const CARD_CLASS = 'mastery-card';
const STYLE_ID = 'mastery-grid-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${CARD_CLASS} { margin-top: 18px; }
    .${CARD_CLASS} .mastery-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
      gap: 8px;
    }
    .${CARD_CLASS} .mastery-cell {
      border-radius: 8px; padding: 10px 10px 8px; min-height: 52px;
      display: flex; flex-direction: column; justify-content: space-between;
      background: var(--mastery-empty, #3a3f47);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      transition: transform 120ms ease, border-color 120ms ease;
      cursor: default;
    }
    .${CARD_CLASS} .mastery-cell:hover { transform: translateY(-1px); border-color: var(--accent, #6ea8ff); }
    .${CARD_CLASS} .mastery-name {
      font-size: 11px; line-height: 1.25; color: rgba(255,255,255,0.92);
      overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .${CARD_CLASS} .mastery-pct {
      font-family: var(--mono, monospace); font-size: 15px; font-weight: 600;
      color: rgba(255,255,255,0.95); margin-top: 6px; text-align: right;
    }
    .${CARD_CLASS} .mastery-pct.mastery-na { font-size: 11px; color: rgba(255,255,255,0.55); }
  `;
  document.head.appendChild(style);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderCard(subject, quizzes, scores) {
  const uuidIndex = {};
  for (const cat of ['normal', 'past-paper']) {
    for (const q of quizzes?.[cat] || []) {
      if (q?.uuid && Array.isArray(q.topics)) uuidIndex[q.uuid] = q.topics;
    }
  }
  const acc = topicAccuracy(scores, uuidIndex);
  const cells = gridModel(taxonomyOrder(quizzes), acc);
  const card = document.createElement('div');
  card.className = `card ${CARD_CLASS}`;
  card.innerHTML = `
    <h3 class="serif" style="margin:0 0 14px;">Topic mastery</h3>
    ${cells.length ? `<div class="mastery-grid">${cells.map(c => `
      <div class="mastery-cell" style="background:${cellColor(c.pct, c.total)}"
           title="${esc(c.topic)} — ${c.total ? `${c.correct}/${c.total} correct` : 'no attempts yet'}"
           data-mastery-topic="${esc(c.topic)}">
        <span class="mastery-name">${esc(c.topic)}</span>
        <span class="mastery-pct ${c.total ? '' : 'mastery-na'}">${c.total ? `${c.pct}%` : '—'}</span>
      </div>`).join('')}</div>`
    : `<p class="mono" style="font-size:12px;color:var(--ink-muted,#889);">No attempts yet — finish a quiz to light this up.</p>`}
  `;
  return card;
}

// The Stats view (from the stats PRs) renders .card blocks into #stage and
// carries a #stats-tab .room-tab; mount only while that view is live.
function statsViewActive(stage) {
  return !!stage?.querySelector?.('[data-stats-room], .stat-bar, .stat-spark');
}

export function mountMastery(subject, opts = {}) {
  const stageSel = opts.stageSelector || '#stage';
  let data = null;
  const tryMount = () => {
    const stage = document.querySelector(stageSel);
    if (!statsViewActive(stage) || !data) return;
    if (stage.querySelector(`.${CARD_CLASS}`)) return;
    stage.appendChild(renderCard(subject, data.quizzes, data.scores));
  };
  const start = () => {
    injectStyle();
    const stage = document.querySelector(stageSel);
    if (!stage) return;
    new MutationObserver(tryMount).observe(stage, { childList: true, subtree: true });
    tryMount();
  };
  Promise.all([
    fetch(`/${subject}/api/quizzes`).then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`/${subject}/api/scores`).then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([quizzes, scores]) => {
    data = { quizzes, scores: Array.isArray(scores) ? scores : [] };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  });
}
