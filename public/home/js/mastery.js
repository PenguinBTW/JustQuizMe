// Mastery Dashboard — "How am I doing" view on the launchpad.
// Read-only aggregation over each portal's stored scores; renders one card
// per subject with per-topic mastery bars, a weakest-3 callout and a
// recent-attempts sparkline. Pure aggregation lives in shared/js/mastery.js.
import { esc, num } from '../../shared/js/utils.js';
import { indexQuizzes, aggregateMastery, weakestTopics, recentTrend } from '../../shared/js/mastery.js';

const SUBJECTS = [
  { key: 'maths', name: 'Mathematics', spec: 'OCR H240', cls: 'math' },
  { key: 'cs', name: 'Computer Science', spec: 'OCR H446', cls: 'cs' },
  { key: 'physics', name: 'Physics', spec: 'AQA 7408', cls: 'phys' },
];

const TREND_N = 10;

// A dead endpoint must not blank the other two subject cards.
async function fetchJson(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function sparklineSvg(points, colorVar) {
  if (!points.length) {
    return '<div class="mastery-spark-empty mono">No attempts yet</div>';
  }
  const w = 220, h = 48, pad = 4;
  const xs = points.length === 1 ? [w / 2] : points.map((_, i) => pad + (i * (w - 2 * pad)) / (points.length - 1));
  const ys = points.map(p => h - pad - (Math.min(100, Math.max(0, p.pct)) / 100) * (h - 2 * pad));
  const poly = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const dots = xs.map((x, i) => {
    const title = `${points[i].pct}%${points[i].exam ? ' (exam)' : ''}`;
    return `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="2.6" fill="var(${colorVar})"><title>${title}</title></circle>`;
  }).join('');
  return `<svg class="mastery-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Recent score trend">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="mastery-spark-axis" />
    <polyline points="${poly}" fill="none" stroke="var(${colorVar})" stroke-width="1.8" />
    ${dots}
  </svg>`;
}

function topicBar(stat) {
  const pct = Math.min(100, Math.max(0, stat.pct));
  return `
    <div class="mastery-topic" title="${num(stat.earned)} / ${num(stat.total)} marks over ${stat.attempts} attempt${stat.attempts === 1 ? '' : 's'}">
      <div class="mastery-topic-head">
        <span class="mastery-topic-name">${esc(stat.topic)}</span>
        <span class="mastery-topic-pct mono">${pct}%</span>
      </div>
      <div class="mastery-track"><div class="mastery-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function subjectCard(subj, scores, manifests) {
  const quizIndex = indexQuizzes(manifests);
  const stats = aggregateMastery(scores, quizIndex).sort((a, b) => a.pct - b.pct);
  const attempts = (scores || []).length;
  const earned = stats.reduce((s, t) => s + t.earned, 0);
  const total = stats.reduce((s, t) => s + t.total, 0);
  const overall = total > 0 ? Math.round((earned / total) * 100) : 0;
  const weakest = weakestTopics(stats, 3);

  return `
    <article class="mastery-card mastery-${subj.cls}">
      <header class="mastery-card-head">
        <div>
          <div class="mastery-subj-name">${esc(subj.name)}</div>
          <div class="mastery-subj-spec mono">${esc(subj.spec)}</div>
        </div>
        <div class="mastery-overall">
          <span class="mastery-overall-pct mono">${attempts ? overall + '%' : '—'}</span>
          <span class="mastery-overall-sub mono">${num(attempts)} attempt${attempts === 1 ? '' : 's'}</span>
        </div>
      </header>

      <div class="mastery-section-label mono">Weakest Topics</div>
      <div class="mastery-weak-row">
        ${weakest.length
          ? weakest.map(w => `<span class="mastery-weak-chip">${esc(w.topic)} <b class="mono">${w.pct}%</b></span>`).join('')
          : '<span class="mastery-empty mono">No attempts logged yet — run a quiz to build mastery.</span>'}
      </div>

      <div class="mastery-section-label mono">Recent Trend (last ${TREND_N})</div>
      ${sparklineSvg(recentTrend(scores, TREND_N), `--${subj.cls}`)}

      <div class="mastery-section-label mono">Topic Mastery</div>
      <div class="mastery-topics">
        ${stats.map(topicBar).join('') || '<span class="mastery-empty mono">Nothing scored yet.</span>'}
      </div>
    </article>`;
}

export async function loadMastery() {
  const grid = document.getElementById('masteryGrid');
  if (!grid) return;
  const cards = await Promise.all(SUBJECTS.map(async subj => {
    const [scores, manifests] = await Promise.all([
      fetchJson(`/${subj.key}/api/scores`),
      fetchJson(`/${subj.key}/api/quizzes`),
    ]);
    return subjectCard(subj, Array.isArray(scores) ? scores : [], manifests || {});
  }));
  grid.innerHTML = cards.join('');
}
