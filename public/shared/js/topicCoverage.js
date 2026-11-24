// Topic-coverage model — DOM-free. Given a portal's scores feed and quiz meta,
// bucket attempts per topic into correct/partial/incorrect shares, then sort
// weakest-accuracy-first so weak topics surface at the top.

const CORRECT_MIN = 0.85;
const PARTIAL_MIN = 0.4;

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
  const acc = new Map((topics || []).map((t) => [t, { topic: t, banked: 0, attempted: 0, correct: 0, partial: 0, incorrect: 0, got: 0, total: 0 }]));
  for (const t of topics || []) {
    const row = acc.get(t);
    for (const m of quizzes || []) {
      if ((m.topics || []).includes(t)) row.banked += m.questionCount || 0;
    }
  }
  for (const s of scores || []) {
    const m = metaByUuid.get(s.quizUuid);
    if (!m) continue;
    const got = Number(s.score) || 0;
    const total = Number(s.total) || 0;
    const pct = total > 0 ? got / total : 0;
    const bucket = pct >= CORRECT_MIN ? 'correct' : pct >= PARTIAL_MIN ? 'partial' : 'incorrect';
    for (const t of m.topics || []) {
      const row = acc.get(t);
      if (!row) continue;
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
  return `<div class="coverage-row">
    <span class="coverage-name">${esc(row.topic)}</span>
    <span class="coverage-bar"><i class="cov-c" style="width:${c}%"></i><i class="cov-p" style="width:${p}%"></i><i class="cov-i" style="width:${i}%"></i></span>
    <span class="coverage-meta mono">${row.attempted}/${row.banked} · ${acc}</span>
  </div>`;
}

/** Whole block; empty state when no attempts anywhere. */
export function coverageHtml(rows, esc) {
  if (!rows.some((r) => r.attempted > 0)) {
    return `<div class="coverage-empty mono">No scored attempts yet — coverage appears once you finish a quiz.</div>`;
  }
  return rows.filter((r) => r.banked > 0 || r.attempted > 0).map((r) => rowHtml(r, esc)).join('');
}
