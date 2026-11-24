// Tiny inline SVG score-trend sparkline for a quiz's recent attempts.
// Pure string builders — no DOM access — so they can be exercised in node.
//
// S.scores is stored NEWEST-first (save-service unshifts each entry), so the
// first `max` matches are the recent ones; the series is reversed to
// chronological before plotting.

const DEFAULTS = { width: 72, height: 20, pad: 3, maxPoints: 10 };

/** Group key joining a quiz's identity — uuid alone collides on 'mixed',
 * file alone collides across practice/past-paper sets sharing a filename.
 * Returns null for non-primitive identifiers: stored rows are attacker-shaped
 * and an object id could throw mid-coercion and kill the view. */
export function attemptKey(s) {
  const f = s?.quizFile;
  const u = s?.quizUuid;
  if (typeof f !== 'string' || f === '' || (typeof u !== 'string' && typeof u !== 'number')) return null;
  return `${u}|${f}`;
}

/**
 * All quizzes' attempt series in one pass — call once per render instead of
 * scanning the log per row. Returns Map<attemptKey, [{score,total}]> with
 * each series chronological and capped at `max`.
 */
export function groupAttempts(scores, max = DEFAULTS.maxPoints) {
  const m = new Map();
  for (const s of scores || []) {
    if (s?.quizFile === 'mixed' || !(Number(s?.total) > 0)) continue;
    const k = attemptKey(s);
    if (k === null) continue;
    const arr = m.get(k) ?? [];
    if (arr.length < max) arr.push({ score: Number(s.score) || 0, total: Number(s.total) });
    m.set(k, arr);
  }
  for (const arr of m.values()) arr.reverse();
  return m;
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
