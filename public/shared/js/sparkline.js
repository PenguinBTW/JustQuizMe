// Tiny inline SVG score-trend sparkline for a quiz's recent attempts.
// Pure string builders — no DOM access — so they can be exercised in node.

const DEFAULTS = { width: 72, height: 20, pad: 3, maxPoints: 10 };

/**
 * Attempts for one question file, oldest-first, last `max` kept.
 * Entries without a quizFile (or the synthetic 'mixed' quiz) have no series.
 */
export function attemptsForQuiz(scores, quizFile, max = DEFAULTS.maxPoints) {
  if (!Array.isArray(scores) || !quizFile || quizFile === 'mixed') return [];
  return scores
    .filter(s => s.quizFile === quizFile && Number(s.total) > 0)
    .map(s => ({ score: Number(s.score) || 0, total: Number(s.total) }))
    .slice(-max);
}

/**
 * SVG string for [{score, total}, ...] chronological — height encodes % of
 * marks, with a dot on the latest attempt. Returns '' for <2 points.
 */
export function sparklineSvg(points, opts = {}) {
  const { width, height, pad } = { ...DEFAULTS, ...opts };
  if (!Array.isArray(points) || points.length < 2) return '';
  const pcts = points.map(p => {
    const total = Number(p.total);
    const score = Number(p.score);
    return total > 0 ? Math.max(0, Math.min(1, score / total)) : 0;
  });
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = pcts.length > 1 ? innerW / (pcts.length - 1) : 0;
  const xy = pcts.map((p, i) => [pad + i * step, pad + innerH * (1 - p)]);
  const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="score trend, latest ${Math.round(pcts[pcts.length - 1] * 100)}%"><polyline points="${pts}" fill="none" stroke="var(--ink-muted, #888)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.4" fill="var(--accent, #f90)"/></svg>`;
}
