// Computer Science Attempt History View
import { S } from '../state.js';
import { $, esc, fmtDate } from '../utils.js';
import { roomNav, wireRoomNav } from '../navigation.js';
import { filterAttempts, drilldownHtml, compareAttempts, compareHtml } from '../../../shared/js/attemptDrilldown.js';

export function renderHistory() {
  const scores = [...(S.scores || [])].reverse();
  const totalAttempts = scores.length;
  const avg = totalAttempts ? Math.round(scores.reduce((s, a) => s + ((a.score / (a.total || 1)) * 100), 0) / totalAttempts) : 0;
  const totalMins = scores.reduce((s, a) => s + (a.minutes || 0), 0);

  $('#stage').innerHTML = `
    ${roomNav('history')}
    <div class="history-stats-grid">
      <div class="history-stat-card">
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">TOTAL ATTEMPTS</div>
        <div class="mono" style="font-size:26px; font-weight:700; margin-top:4px;">${totalAttempts}</div>
      </div>
      <div class="history-stat-card">
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">AVERAGE SCORE</div>
        <div class="mono" style="font-size:26px; font-weight:700; color:var(--accent); margin-top:4px;">${avg}%</div>
      </div>
      <div class="history-stat-card">
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">TOTAL REVISION TIME</div>
        <div class="mono" style="font-size:26px; font-weight:700; margin-top:4px;">${totalMins}m</div>
      </div>
    </div>

    ${filterBar()}
    <div class="card" id="histList" style="padding:10px 28px;">
      ${""/* rows rendered dynamically by wireDrilldown */}
    </div>
  `;

  wireRoomNav();
  wireDrilldown(scores);
}

// drill-down wiring: filters + expandable per-attempt reconstruction
function wireDrilldown(scores) {
  const apply = () => {
    const topic = (document.getElementById('histTopic') || {}).value || '';
    const mode = (document.getElementById('histMode') || {}).value || '';
    const search = (document.getElementById('histSearch') || {}).value || '';
    const from = (document.getElementById('histFrom') || {}).value || '';
    const to = (document.getElementById('histTo') || {}).value || '';
    const list = filterAttempts(scores, { topic, mode, search, from, to });
    const host = document.getElementById('histList');
    if (!host) return;
    host.innerHTML = list.map((a, i) => entryRow(a, i)).join('') || '<p class="mono" style="color:var(--ink-muted); padding:20px 0;">No attempts match these filters.</p>';
    host.querySelectorAll('[data-attempt]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = +el.dataset.attempt;
        const detail = el.querySelector('.attempt-detail');
        if (!detail) return;
        if (detail.innerHTML) { detail.innerHTML = ''; el.style.cursor = 'pointer'; return; }
        const e = list[idx];
        detail.innerHTML = drilldownHtml(e) + compareHtml(compareAttempts(scores, e.quizUuid, e.date));
      });
    });
  };
  ['histTopic', 'histMode', 'histSearch', 'histFrom', 'histTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', apply);
  });
  apply();
}

function entryRow(a, i) {
  return `
    <div class="history-entry" data-attempt="${i}" style="cursor:pointer;">
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <strong style="font-size:15px;">${esc(a.quizTitle || 'Assessment')}</strong>
          ${a.exam ? '<span class="pill red">Exam Mode</span>' : '<span class="pill">Quiz Mode</span>'}
        </div>
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">${fmtDate(a.date)} · ${a.minutes != null ? a.minutes + 'm' : ''}</div>
        <div class="attempt-detail" style="margin-top:10px;"></div>
      </div>
      <div class="mono" style="font-size:18px; font-weight:700; color:var(--accent); white-space:nowrap;">
        ${a.score} / ${a.total} <span style="font-size:13px; color:var(--ink-muted);">(${Math.round(a.score / (a.total || 1) * 100)}%)</span>
      </div>
    </div>`;
}

function filterBar() {
  return `
    <div class="card" style="padding:12px 20px; margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
      <input id="histSearch" placeholder="search papers…" style="padding:6px 10px; font-size:13px; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--ink); width:150px;" />
      <input id="histTopic" placeholder="topic…" style="padding:6px 10px; font-size:13px; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--ink); width:120px;" />
      <select id="histMode" style="padding:6px 10px; font-size:13px; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--ink);">
        <option value="">all modes</option><option value="exam">exam</option><option value="quiz">quiz</option><option value="flashcards">flashcards</option>
      </select>
      <input id="histFrom" type="date" style="padding:6px 10px; font-size:12px; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--ink);" />
      <input id="histTo" type="date" style="padding:6px 10px; font-size:12px; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--ink);" />
      <span class="mono" style="font-size:11px; color:var(--ink-muted);">click an attempt for full detail</span>
    </div>`;
}
