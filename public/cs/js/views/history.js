// Computer Science Attempt History View
import { S } from '../state.js';
import { $, esc, fmtDate } from '../utils.js';
import { roomNav, wireRoomNav } from '../navigation.js';
import { startReviewRun } from '../runner/starters.js';
import { reviewQueue, REVIEW_DECK_CAP } from '../review.js';

function reviewRowHtml(i) {
  const sep = i.key.indexOf(':');
  const file = i.key.slice(0, sep), qid = i.key.slice(sep + 1);
  return `<div class="history-entry">
    <div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
        <strong style="font-size:15px;">${esc(qid.toUpperCase())}</strong>
        <span class="pill">${esc(file)}.json</span>
        ${i.misses > 1 ? `<span class="pill red">${i.misses} misses</span>` : ''}
      </div>
      <div class="mono" style="font-size:12px; color:var(--ink-muted);">
        ${esc(i.quizTitle || 'Assessment')} · last ${i.got}/${i.marks ?? '?'} marks${i.date ? ` · ${fmtDate(i.date)}` : ''}
      </div>
    </div>
    <div class="mono" style="font-size:14px; font-weight:700; color:var(--accent);">
      ${i.lost != null ? `${i.lost}m owed` : 'queued'}
    </div>
  </div>`;
}

export function renderHistory() {
  const scores = [...(S.scores || [])].reverse();
  const items = reviewQueue();
  const owed = items.reduce((s, i) => s + (i.lost ?? 0), 0);
  const repeat = items.filter(i => i.misses > 1).length;
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

    <div class="card" style="padding:16px 28px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <strong style="font-size:16px;">Review Queue</strong>
        <span class="pill">${items.length} queued</span>
        <span class="pill">${owed}m owed</span>
        ${repeat ? `<span class="pill red">${repeat} repeat misses</span>` : ''}
        <span style="flex:1;"></span>
        ${items.length ? `
          <button class="btn btn-primary" id="reviewStartBtn">Start Review Deck (${Math.min(items.length, REVIEW_DECK_CAP)}Q)</button>
          <button class="btn" id="reviewExamBtn">Exam Conditions</button>` : ''}
      </div>
      ${items.length ? `<div style="margin-top:8px;">${items.map(reviewRowHtml).join('')}</div>`
        : '<p class="mono" style="font-size:12.5px; color:var(--ink-muted); margin:10px 0 4px;">Nothing queued — questions you miss or part-score will appear here after a run.</p>'}
    </div>

    <div class="card" style="padding:10px 28px;">
      ${scores.map(a => `
        <div class="history-entry">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <strong style="font-size:15px;">${esc(a.quizTitle || 'Assessment')}</strong>
              ${a.exam ? '<span class="pill red">Exam Mode</span>' : '<span class="pill">Quiz Mode</span>'}
            </div>
            <div class="mono" style="font-size:12px; color:var(--ink-muted);">
              ${fmtDate(a.date)} · ${a.minutes}m ${a.seconds % 60}s · ${a.breakdown?.coding ? `Coding: ${a.breakdown.coding.got}/${a.breakdown.coding.total}m` : ''}
            </div>
          </div>
          <div class="mono" style="font-size:18px; font-weight:700; color:var(--accent);">
            ${a.score} / ${a.total} <span style="font-size:13px; color:var(--ink-muted);">(${Math.round(a.score / (a.total || 1) * 100)}%)</span>
          </div>
        </div>
      `).join('') || '<p class="mono" style="color:var(--ink-muted); padding:20px 0;">No test attempts logged yet.</p>'}
    </div>
  `;

  wireRoomNav();
  const rsBtn = $('#reviewStartBtn');
  if (rsBtn) rsBtn.onclick = () => startReviewRun(false);
  const reBtn = $('#reviewExamBtn');
  if (reBtn) reBtn.onclick = () => startReviewRun(true);
}
