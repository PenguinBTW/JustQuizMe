// Topic-coverage model — DOM-free. Given a portal's scores feed and quiz meta,
// bucket attempts per topic into correct/partial/incorrect shares, then sort
// weakest-accuracy-first so weak topics surface at the top.

const CORRECT_MIN = 0.85;
const PARTIAL_MIN = 0.4;

/** Topic matching is case/whitespace-insensitive (bank tags are loose). */
const normTopic = (t) => String(t).trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * @param {Array} scores    /api/scores entries ({quizUuid, score, total})
 * @param {Array} quizzes   quiz meta entries ({uuid, topics, questionCount})
 * @param {string[]} topics topic names to report, in display order
 * @returns {Array} rows: {topic, banked, attempted, correct, partial,
 *   incorrect, accuracy} — accuracy = total marks got / total marks, null when
 *   no attempts. Sorted weakest-first; never-attempted topics sort last.
 */
export function topicCoverage(scores, quizzes, topics) {
  const metaByUuid = new Map((quizzes || []).map((m) => [m.uuid, m]));
  const acc = new Map();
  for (const t of topics || []) {
    acc.set(normTopic(t), { topic: t, banked: 0, attempted: 0, correct: 0, partial: 0, incorrect: 0, got: 0, total: 0 });
  }
  const topicOf = (tags) => {
    const out = [];
    for (const raw of tags || []) {
      const row = acc.get(normTopic(raw));
      if (row && !out.includes(row)) out.push(row);
    }
    return out;
  };
  for (const m of quizzes || []) {
    for (const row of topicOf(m.topics)) row.banked += m.questionCount || 0;
  }
  for (const s of scores || []) {
    const m = metaByUuid.get(s.quizUuid);
    // Virtual quizzes (topic/sub/mixed) share one UUID with no catalog entry;
    // their titles start with the topic name ("Waves · 20-mark quiz").
    const rows = m ? topicOf(m.topics) : topicOf([String(s.quizTitle || '').split('·')[0]]);
    if (!rows.length) continue;
    const got = Number(s.score) || 0;
    const total = Number(s.total) || 0;
    const pct = total > 0 ? got / total : 0;
    const bucket = pct >= CORRECT_MIN ? 'correct' : pct >= PARTIAL_MIN ? 'partial' : 'incorrect';
    for (const row of rows) {
      row.attempted += 1;
      row[bucket] += 1;
      row.got += got;
      row.total += total;
    }
  }
  const rows = [...acc.values()].map((r) => ({ ...r, accuracy: r.total > 0 ? r.got / r.total : null }));
  rows.sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2));
  return rows;
}

/** Percentages [correct, partial, incorrect] of attempted, each 0-100. */
export function shares(row) {
  const n = row.correct + row.partial + row.incorrect;
  if (!n) return [0, 0, 0];
  return [row.correct / n * 100, row.partial / n * 100, row.incorrect / n * 100];
}

/** One coverage row's HTML. `esc` is injected so the module stays DOM-free. */
export function rowHtml(row, esc) {
  const [c, p, i] = shares(row);
  const acc = row.accuracy == null ? '—' : `${Math.round(row.accuracy * 100)}%`;
  const seg = (cls, pct) => `<i class="${cls}" style="width:${pct}%"></i>`;
  return `<div class="coverage-row" title="${esc(row.topic)}: ${row.correct} correct, ${row.partial} partial, ${row.incorrect} incorrect of ${row.attempted} attempt(s)">
    <span class="coverage-name">${esc(row.topic)}</span>
    <span class="coverage-bar" role="group" aria-label="${row.correct} correct, ${row.partial} partial, ${row.incorrect} incorrect">${seg('cov-c', c)}${seg('cov-p', p)}${seg('cov-i', i)}</span>
    <span class="coverage-meta mono">${row.attempted} tries · ${row.banked}Q · ${acc}</span>
  </div>`;
}

/** Whole block; empty state when no attempts anywhere. */
export function coverageHtml(rows, esc) {
  if (!rows.some((r) => r.attempted > 0)) {
    return `<div class="coverage-empty mono">No scored attempts yet — coverage appears once you finish a quiz.</div>`;
  }
  return rows.filter((r) => r.banked > 0 || r.attempted > 0).map((r) => rowHtml(r, esc)).join('');
}
