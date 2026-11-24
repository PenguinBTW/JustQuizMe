// Physics Stats view — progress dashboard over data/scores.json.
// Mounts itself by injecting a "Stats" tab into .room-tabs whenever the stage
// re-renders (zero edits to navigation.js / views — those are contended).
// Self-initializing: main.js only needs `import './stats.js';`.
import { S } from './state.js';
import { $, esc } from './utils.js';
import { renderRoom } from './navigation.js';
import {
  groupByTopic,
  weakestTopic,
  streakDays,
  sparklinePoints,
  recentPcts
} from '../../shared/js/stats.js';

const TAB_ID = 'statsRoomTab';

function uuidIndex() {
  const idx = {};
  for (const list of [S.quizzes.normal, S.quizzes['past-paper']]) {
    for (const m of list || []) {
      if (m.uuid && Array.isArray(m.topics) && m.topics.length) idx[m.uuid] = m.topics;
    }
  }
  return idx;
}

function statsHtml() {
  const scores = S.scores || [];
  const groups = groupByTopic(scores, uuidIndex());
  // 'Mixed practice' pools unattributed runs — it can't name a syllabus topic
  // to revise, so skip it for the callout.
  const weak = weakestTopic(groups.filter(g => g.topic !== 'Mixed practice'));
  const streak = streakDays(scores.map(s => s.date));
  const pcts = recentPcts(scores, 14);
  const pts = sparklinePoints(pcts, { w: 160, h: 30 });
  // Marks-weighted so 'overall' uses the same units as the per-topic bars.
  const totals = scores.reduce((a, s) => ({ c: a.c + (Number(s.score) || 0), t: a.t + (Number(s.total) || 0) }), { c: 0, t: 0 });
  const overall = totals.t ? Math.round((totals.c / totals.t) * 100) : 0;
  const nPractice = (S.quizzes.normal || []).length;

  const tabClone = (id, label, active = '', extra = '') =>
    `<button class="room-tab ${active}" data-stats-room="${id}" ${extra}>${label}</button>`;

  const bars = groups
    .map(g => {
      const pct = Math.max(0, Math.min(100, g.pct));
      return `
      <div class="stat-topic">
        <div class="stat-topic-head">
          <span title="${esc(g.topic)}">${esc(g.topic)}</span>
          <span class="mono">${g.correct}/${g.attempted} marks · ${g.runs} run${g.runs === 1 ? '' : 's'} · ${g.pct}%</span>
        </div>
        <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%;"></div></div>
      </div>`;
    })
    .join('') || `<p style="color:var(--ink-secondary);">No scored runs yet — finish a quiz to fill this dashboard.</p>`;

  return `
  <div class="room-nav">
    <div class="room-tabs">
      ${tabClone('past', 'Past Papers')}
      ${nPractice ? tabClone('practice', `Practice Sets <span class="mono" style="font-size:13px;">(${nPractice})</span>`) : ''}
      ${tabClone('history', 'Attempt History')}
      ${tabClone('stats', 'Stats', 'active', `id="${TAB_ID}"`)}
    </div>
    <span class="mono" style="font-size:12px; color:var(--ink-muted);">data/scores.json · ${scores.length} runs</span>
  </div>

  <div class="card" style="margin-bottom:18px;">
    <div style="display:flex; gap:18px; flex-wrap:wrap; align-items:flex-end;">
      <div>
        <div class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Runs</div>
        <div class="serif" style="font-size:34px;">${scores.length}</div>
      </div>
      <div>
        <div class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Overall accuracy</div>
        <div class="serif" style="font-size:34px;">${overall}%</div>
      </div>
      <div>
        <div class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Streak</div>
        <div class="serif" style="font-size:34px;">${streak}d</div>
      </div>
      ${weak ? `<div style="margin-left:auto;min-width:0;"><span class="pill accent stat-weak" title="Revise: ${esc(weak.topic)} — ${weak.pct}%">Revise: ${esc(weak.topic)} — ${weak.pct}%</span></div>` : ''}
    </div>
    ${
      pts
        ? `<div style="margin-top:18px;">
            <div class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase; margin-bottom:6px;">Last ${pcts.length} runs</div>
            <svg class="stat-spark" viewBox="0 0 160 30" preserveAspectRatio="none" role="img" aria-label="Recent accuracy sparkline">
              ${pcts.length === 1
                ? `<circle cx="${pts.split(',')[0]}" cy="${pts.split(',')[1]}" r="3" fill="var(--accent)"/>`
                : `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`}
            </svg>
          </div>`
        : ''
    }
  </div>

  <div class="card">
    <h3 class="serif" style="margin:0 0 16px;">Accuracy by topic</h3>
    ${bars}
  </div>`;
}

export function renderStats() {
  $('#stage').innerHTML = statsHtml();
  document.querySelectorAll('[data-stats-room]').forEach(b => {
    b.onclick = () => {
      if (b.dataset.statsRoom === 'stats') return renderStats();
      S.room = b.dataset.statsRoom;
      renderRoom();
    };
  });
  window.scrollTo(0, 0);
  if (window.renderMath) window.renderMath();
}

function injectTab() {
  const tabs = document.querySelector('.room-tabs');
  if (!tabs || tabs.querySelector(`#${TAB_ID}`)) return;
  const btn = document.createElement('button');
  btn.className = 'room-tab';
  btn.id = TAB_ID;
  btn.textContent = 'Stats';
  btn.onclick = () => renderStats();
  tabs.appendChild(btn);
}

export function initStatsTab() {
  const stage = $('#stage');
  if (!stage) return;
  new MutationObserver(injectTab).observe(stage, { childList: true });
  injectTab();
}

// Self-init on import: the module is deferred, so the DOM is ready here and
// main.js needs nothing more than the import line.
initStatsTab();
