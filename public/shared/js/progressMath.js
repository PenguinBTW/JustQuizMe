// JustQuizMe progress aggregation — pure functions, no DOM.
// Honest, simple math over the saved score history; every input quirk documented.

// Chronological per-run accuracy series, oldest → newest.
// Entries with unusable totals/dates are skipped, never throw.
export function accuracySeries(scores) {
  const rows = [];
  for (const s of scores || []) {
    try {
      const total = Number(s?.total) || 0;
      if (!total) continue;
      const t = s?.date instanceof Date ? s.date : new Date(s?.date);
      if (Number.isNaN(+t)) continue;
      rows.push({ t, pct: Math.max(0, Math.min(1, (Number(s?.score) || 0) / total)) });
    } catch { continue; }
  }
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

// Rolling accuracy: each point is the mean of the window ending at that run
// (window=3) — smooths single-paper noise without hiding genuine trends.
export function rollingAccuracy(series, window = 3) {
  return (series || []).map((p, i) => {
    const lo = Math.max(0, i - window + 1);
    const slice = series.slice(lo, i + 1);
    return { t: p.t, pct: slice.reduce((s, x) => s + x.pct, 0) / slice.length };
  });
}

// Total questions attempted — exact when per-question records exist,
// estimated from marks otherwise (documented approximation: 1 mark ≈ 1 question
// is wrong, so we count questions only where recorded and otherwise omit them
// from the exact count; the UI labels the number accordingly).
export function questionStats(scores) {
  let recorded = 0;
  let attempted = 0;
  let legacyRuns = 0;
  for (const s of scores || []) {
    const pq = Array.isArray(s?.perQuestion) ? s.perQuestion : null;
    if (pq && pq.length) {
      recorded += pq.length;
      attempted += pq.filter(q => q && q.attempted).length;
    } else {
      legacyRuns += 1;
    }
  }
  return { recorded, attempted, legacyRuns, exact: legacyRuns === 0 };
}

// Mastery-over-time: weekly snapshots. For each of the last `weeks` weeks,
// overall mastery (mean of per-topic masteries) is recomputed using only
// entries up to that boundary — honest reconstruction, no interpolation.
// computeFn is injected (computeMastery) to keep this module dependency-free.
export function masteryTrend(scores, resolveTopics, computeFn, weeks = 6, now = new Date()) {
  const out = [];
  const weekMs = 7 * 86400000;
  const entries = (scores || []).filter(s => {
    try { return !Number.isNaN(+new Date(s?.date)); } catch { return false; }
  });
  for (let i = weeks - 1; i >= 0; i--) {
    const boundary = new Date(+now - i * weekMs);
    const upto = entries.filter(s => {
      try { return new Date(s.date) <= boundary; } catch { return false; }
    });
    if (!upto.length) { out.push({ t: boundary, mastery: null }); continue; }
    const rows = computeFn(upto, resolveTopics, boundary);
    const vals = rows.map(r => r.mastery);
    out.push({ t: boundary, mastery: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
  }
  return out;
}
