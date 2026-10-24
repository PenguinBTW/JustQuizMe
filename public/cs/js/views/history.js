// Computer Science Attempt History View
import { S } from '../state.js';
import { $, esc, fmtDate } from '../utils.js';
import { roomNav, wireRoomNav } from '../navigation.js';

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
}
