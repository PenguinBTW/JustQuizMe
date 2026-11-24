// Shared progress dashboard — HTML-string builders, no DOM coupling.
// Each portal wires a thin view that calls progressHtml with its own data.
import { accuracySeries, rollingAccuracy, questionStats, masteryTrend } from './progressMath.js';
import { computeMastery, weakestTopics } from './mastery.js';
import { sparkline } from './sparklineSvg.js';
import { resolveScoreTopics, buildUuidIndex, masteryBadge } from './masteryUi.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// progressHtml({scores, quizzes, knownTopics, now}) → full dashboard HTML string.
export function progressHtml({ scores, quizzes, knownTopics, now = new Date() }) {
  const idx = buildUuidIndex(quizzes);
  const resolve = (s) => resolveScoreTopics(s, idx);
  const rows = computeMastery(scores, resolve, now);
  const weak3 = weakestTopics(rows, knownTopics, 3).filter(p => p.weak || p.unpracticed).slice(0, 3);
  const series = accuracySeries(scores);
  const rolling = rollingAccuracy(series, 3);
  const q = questionStats(scores);
  const trend = masteryTrend(scores, resolve, computeMastery, 6, now);
  const recent = [...(scores || [])].slice(0, 5);

  const empty = !(scores || []).length;
  if (empty) {
    return `
      <div class="card" style="text-align:center; padding:48px 32px;">
        <h2 class="serif" style="font-size:28px; margin-bottom:10px;">No progress yet</h2>
        <p class="mono" style="font-size:13px; color:var(--ink-muted);">Finish a quiz or exam and your trajectory will appear here — accuracy trend, mastery over time, and what to review next.</p>
      </div>`;
  }

  const overallMastery = rows.length ? rows.reduce((s, r) => s + r.mastery, 0) / rows.length : null;
  const latestAcc = series.length ? series[series.length - 1].pct : null;

  return `
    <div class="history-stats-grid" style="margin-bottom:22px;">
      <div class="history-stat-card">
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">ACCURACY TREND</div>
        <div style="margin-top:6px;">${sparkline(rolling, { width: 200, height: 38 })}</div>
        <div class="mono" style="font-size:12px; color:var(--ink-secondary); margin-top:4px;">latest ${latestAcc != null ? Math.round(latestAcc * 100) : '—'}% · rolling mean of 3</div>
      </div>
      <div class="history-stat-card">
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">MASTERY · 6 WEEKS</div>
        <div style="margin-top:6px;">${sparkline(trend, { width: 200, height: 38, color: 'var(--green, #3d9e63)' })}</div>
        <div class="mono" style="font-size:12px; color:var(--ink-secondary); margin-top:4px;">${overallMastery != null ? Math.round(overallMastery * 100) : '—'}% across ${rows.length} topic${rows.length === 1 ? '' : 's'}</div>
      </div>
      <div class="history-stat-card">
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">QUESTIONS ATTEMPTED</div>
        <div class="mono" style="font-size:26px; font-weight:700; margin-top:4px;">${q.attempted}<span style="font-size:13px; color:var(--ink-muted); font-weight:400;"> / ${q.recorded} seen</span></div>
        <div class="mono" style="font-size:11px; color:var(--ink-muted); margin-top:4px;">${q.exact ? 'exact per-question records' : `excludes ${q.legacyRuns} legacy run${q.legacyRuns === 1 ? '' : 's'} without per-question data`}</div>
      </div>
    </div>

    <div class="card" style="padding:20px 26px; margin-bottom:22px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
        <h3 class="serif" style="font-size:20px;">Focus next</h3>
        <span class="mono" style="font-size:11.5px; color:var(--ink-muted);">weakest by recency-weighted mastery</span>
      </div>
      ${weak3.length ? weak3.map(w => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-top:1px solid var(--border);">
          <span style="font-size:14.5px;">${esc(w.topic)}</span>
          <span style="display:flex; align-items:center; gap:10px;">
            ${masteryBadge(rows.find(r => r.topic === w.topic))}
            <button class="btn" style="padding:4px 13px; font-size:12px;" data-progress-review>Review weakest ⚡</button>
          </span>
        </div>`).join('')
      : `<p class="mono" style="font-size:12.5px; color:var(--ink-muted);">No weak topics — everything practiced is above 60% mastery.</p>`}
    </div>

    <div class="card" style="padding:10px 26px;">
      ${recent.map(a => `
        <div class="history-entry">
          <div>
            <strong style="font-size:14.5px;">${esc(a.quizTitle || 'Assessment')}</strong>
            <div class="mono" style="font-size:11.5px; color:var(--ink-muted); margin-top:2px;">${esc(String(a.date || '').slice(0, 10))} · ${a.exam ? 'Exam' : 'Quiz'}</div>
          </div>
          <span class="mono" style="font-weight:700; color:var(--accent);">${+a.score || 0}/${+a.total || 0} (${+a.total ? Math.round((+a.score || 0) / +a.total * 100) : 0}%)</span>
        </div>`).join('')}
    </div>`;
}
