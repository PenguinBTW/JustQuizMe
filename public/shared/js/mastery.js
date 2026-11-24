// JustQuizMe mastery model — pure functions, no DOM.
//
// WHAT THIS IS: a simple, honest recency-weighted picture of per-topic mastery
// built from saved run results. Each score entry covers one or more topics with
// a single aggregate percentage, so a run's percentage is attributed to every
// topic it covered (the data model has no per-question breakdown — documented
// limitation, not hidden).
//
// THE MATH (deliberately simple):
//   weight(run) = 0.5 ^ (daysAgo / HALF_LIFE_DAYS)   — exponential decay, 14-day half-life
//   mastery(topic) = Σ(weight × pct) / Σ(weight)      — weighted mean of run percentages
// Recent runs dominate; a topic untouched for a month counts for very little.
// A topic with no runs is simply absent — callers must treat absence as
// "unpracticed", never as 0% mastery.

export const HALF_LIFE_DAYS = 14;
export const WEAK_THRESHOLD = 0.6;   // mastery below this ⇒ "needs review"

function daysBetween(older, newer) {
  return Math.max(0, (newer - older) / 86400000);
}

function runPct(s) {
  const total = Number(s?.total) || 0;
  if (!total) return null;
  const score = Number(s?.score) || 0;
  return Math.max(0, Math.min(1, score / total));
}

function runDate(s) {
  const t = s?.date instanceof Date ? s.date : new Date(s?.date);
  return Number.isNaN(+t) ? null : t;
}

// resolveTopics is injected by the caller (stats.js topicsFor in practice) so
// this module stays free of the quizTitle/uuidIndex resolution rules.
export function computeMastery(scores, resolveTopics, now = new Date()) {
  const topics = new Map();
  for (const s of scores || []) {
    const pct = runPct(s);
    const date = runDate(s);
    if (pct == null || !date) continue;
    let names = [];
    try { names = resolveTopics(s) || []; } catch { continue; }
    const w = Math.pow(0.5, daysBetween(date, now) / HALF_LIFE_DAYS);
    for (const name of names) {
      if (typeof name !== 'string' || !name) continue;
      const e = topics.get(name) || { topic: name, wsum: 0, wpct: 0, runs: 0, last: null };
      e.wsum += w;
      e.wpct += w * pct;
      e.runs += 1;
      if (!e.last || date > e.last) e.last = date;
      topics.set(name, e);
    }
  }
  const out = [...topics.values()].map(e => ({
    topic: e.topic,
    mastery: e.wsum ? e.wpct / e.wsum : 0,
    runs: e.runs,
    daysSince: e.last ? Math.round(daysBetween(e.last, now)) : null,
    weak: e.wsum ? (e.wpct / e.wsum) < WEAK_THRESHOLD : false
  }));
  // weakest first; ties broken by least-recently-practiced, then name
  out.sort((a, b) => a.mastery - b.mastery
    || (b.daysSince ?? 1e9) - (a.daysSince ?? 1e9)
    || a.topic.localeCompare(b.topic));
  return out;
}

// Pick the topics most in need of review, preferring weak-and-decaying ones.
// knownTopics: full catalogue of topic names from the bank — topics the student
// has NEVER practiced rank just below weak ones (they're unknowns, not zeros).
export function weakestTopics(masteryRows, knownTopics, count = 3) {
  const rows = masteryRows || [];
  const weak = rows.filter(r => r.weak);
  const practiced = new Set(rows.map(r => r.topic));
  const unpracticed = (knownTopics || []).filter(t => !practiced.has(t));
  const strong = rows.filter(r => !r.weak);
  return [...weak, ...unpracticed.map(t => ({ topic: t, mastery: null, runs: 0, daysSince: null, weak: false, unpracticed: true })), ...strong]
    .slice(0, count);
}
