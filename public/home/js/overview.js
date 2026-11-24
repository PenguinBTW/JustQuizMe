// Launchpad cross-subject revision overview — one honest picture across all
// three portals. Zero deps: hand-rolled HTML + the shared sparkline.
import { subjectSummary, attentionList, recentActivity } from '../../shared/js/overviewMath.js';
import { accuracySeries, rollingAccuracy } from '../../shared/js/progressMath.js';
import { sparkline } from '../../shared/js/sparklineSvg.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SUBJECTS = {
  cs: { name: 'Computer Science', spec: 'OCR H446', route: '/cs', color: '#0FB86E' },
  maths: { name: 'Mathematics', spec: 'OCR H240', route: '/maths', color: '#4A8DFF' },
  physics: { name: 'Physics', spec: 'AQA 7408', route: '/physics', color: '#FF7844' },
};

export async function renderOverview(container) {
  let data = null;
  try {
    const res = await fetch('/api/overview');
    if (res.ok) data = await res.json();
  } catch { /* server unreachable — hide section */ }
  if (!data) { container.style.display = 'none'; return; }

  const bySubject = {
    cs: (data.cs && data.cs.scores) || [],
    maths: (data.maths && data.maths.scores) || [],
    physics: (data.physics && data.physics.scores) || [],
  };
  const now = Date.now();
  const summaries = Object.fromEntries(Object.entries(bySubject).map(([k, v]) => [k, subjectSummary(v, now)]));
  const attention = attentionList(bySubject, now, 5);
  const recent = recentActivity(bySubject, 6);
  const totalRuns = Object.values(summaries).reduce((s, x) => s + x.runs, 0);

  if (!totalRuns) {
    container.innerHTML = `
      <div class="ov-empty">
        <h2 class="serif">Your revision picture</h2>
        <p>Complete a quiz in any subject and your cross-subject mastery, activity and what needs attention will appear here.</p>
      </div>`;
    return;
  }

  const subjectCards = Object.entries(SUBJECTS).map(([key, cfg]) => {
    const sum = summaries[key];
    const series = accuracySeries(bySubject[key]);
    const roll = rollingAccuracy(series);
    const spark = roll.length >= 2
      ? sparkline(roll, { width: 180, height: 34, color: cfg.color })
      : '';
    const masteryPct = sum.meanMastery == null ? null : Math.round(sum.meanMastery * 100);
    return `
      <a href="${cfg.route}" class="ov-subject">
        <div class="ov-subject-head">
          <span class="ov-subject-name">${esc(cfg.name)}</span>
          <span class="mono ov-spec">${esc(cfg.spec)}</span>
        </div>
        ${sum.runs ? `
        <div class="ov-subject-stats">
          <span class="ov-mastery" style="color:${masteryPct != null && masteryPct < 60 ? '#e0735f' : cfg.color}">
            ${masteryPct != null ? masteryPct + '%' : '—'}
          </span>
          <span class="mono ov-sub-label">mean mastery · ${sum.topicsPracticed} topic${sum.topicsPracticed === 1 ? '' : 's'}</span>
        </div>
        ${spark ? `<div class="ov-spark">${spark}</div>` : ''}
        <div class="mono ov-meta">
          ${sum.weakCount ? `<span style="color:#e0735f;">${sum.weakCount} weak</span> · ` : ''}${sum.runs} run${sum.runs === 1 ? '' : 's'}${sum.questionsAttempted ? ` · ${sum.questionsAttempted} questions` : ''}
        </div>`
        : `<p class="mono ov-none">No practice yet</p>`}
      </a>`;
  }).join('');

  const attentionHtml = attention.length ? `
    <div class="ov-panel">
      <h3 class="serif">Needs attention</h3>
      <span class="mono ov-panel-hint">weakest topics across all subjects — recency-weighted</span>
      ${attention.map(a => `
        <div class="ov-att-row">
          <span class="ov-att-dot" style="background:${SUBJECTS[a.subject].color}"></span>
          <span class="ov-att-topic">${esc(a.topic)}</span>
          <span class="mono ov-att-pct" style="color:${a.weak ? '#e0735f' : 'inherit'}">${Math.round(a.mastery * 100)}%</span>
          <a class="ov-att-link" href="${SUBJECTS[a.subject].route}">revise →</a>
        </div>`).join('')}
    </div>` : '';

  const recentHtml = recent.length ? `
    <div class="ov-panel">
      <h3 class="serif">Recent activity</h3>
      ${recent.map(r => `
        <div class="ov-act-row">
          <span class="ov-att-dot" style="background:${SUBJECTS[r.subject].color}"></span>
          <div class="ov-act-main">
            <span class="ov-act-title">${esc(r.title)}</span>
            <span class="mono ov-act-meta">${new Date(r.ts).toISOString().slice(0, 10)} · ${r.flashcard ? 'Flashcards' : r.exam ? 'Exam' : 'Quiz'}</span>
          </div>
          <span class="mono ov-act-score">${r.score}/${r.total}</span>
        </div>`).join('')}
    </div>` : '';

  container.innerHTML = `
    <div class="ov-head">
      <h2 class="serif">Your revision picture</h2>
      <span class="mono ov-head-hint">across all three subjects</span>
    </div>
    <div class="ov-grid">${subjectCards}</div>
    <div class="ov-panels">${attentionHtml}${recentHtml}</div>`;
}
