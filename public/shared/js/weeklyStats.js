// JustQuizMe "Your week" cross-portal aggregation — pure helpers.
// No DOM; every function takes plain data and returns plain data/strings.
// Reads the shared S.scores shape ({date, score, total, ...}) that every
// portal's /api/<portal>/scores endpoint serves.

import { streakDays, sparklinePoints } from './stats.js';

// Local-day key, matching stats.js streakDays bucketing.
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Coerce a stored date — scores.json is user-writable via the API, so a
// malformed entry must never throw. Returns null for unparseable input.
function parseDate(d) {
  try {
    const t = d instanceof Date ? d : new Date(d);
    return t instanceof Date && !Number.isNaN(t.getTime()) ? t : null;
  } catch {
    return null;
  }
}

// The last n calendar days ending today, oldest → newest, as day keys.
export function lastNDays(n = 7, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(day);
    d.setDate(d.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

// Runs-per-day counts over the window, oldest → newest.
export function dailyRuns(scores, days) {
  const idx = new Map((days || []).map((k, i) => [k, i]));
  const counts = new Array(idx.size).fill(0);
  for (const s of scores || []) {
    const t = parseDate(s?.date);
    if (!t) continue;
    const i = idx.get(dayKey(t));
    if (i !== undefined) counts[i] += 1;
  }
  return counts;
}

// Runs within the last n days (inclusive of today).
export function runsInWindow(scores, days) {
  const set = new Set(days || []);
  return (scores || []).filter(s => {
    const t = parseDate(s?.date);
    return t && set.has(dayKey(t));
  });
}

// Aggregate accuracy {correct, attempted, pct} over a score list.
export function accuracy(scores) {
  let correct = 0;
  let attempted = 0;
  for (const s of scores || []) {
    const c = Number(s?.score);
    const t = Number(s?.total);
    if (Number.isFinite(c) && c > 0) correct += c;
    if (Number.isFinite(t) && t > 0) attempted += t;
  }
  return { correct, attempted, pct: attempted ? Math.round((correct / attempted) * 1000) / 10 : 0 };
}

// Cross-portal "Your week" summary.
// `portals`: [{ id, scores }] — one entry per portal, scores newest-first as
// the APIs serve them (order doesn't matter; everything buckets by day).
// Returns totals, a 7-day daily-run sparkline (points string for an SVG
// polyline, scaled to the week's peak day), and per-portal rows with the
// streak leader flagged.
export function weeklySummary(portals, { now = new Date(), days = 7, w = 132, h = 30 } = {}) {
  const keys = lastNDays(days, now);
  const all = (portals || []).flatMap(p => p?.scores || []);
  const daily = dailyRuns(all, keys);
  const acc = accuracy(runsInWindow(all, keys));
  const perPortal = (portals || []).map(p => {
    const scores = p?.scores || [];
    const week = runsInWindow(scores, keys);
    const a = accuracy(week);
    return {
      id: p?.id ?? '',
      runs: week.length,
      correct: a.correct,
      attempted: a.attempted,
      pct: a.pct,
      streak: streakDays(scores.map(s => s?.date), now),
    };
  });
  const leader = perPortal.reduce((best, p) => (p.streak > (best?.streak ?? 0) ? p : best), null);
  const peak = Math.max(1, ...daily);
  return {
    days: keys,
    runs: daily.reduce((a, b) => a + b, 0),
    correct: acc.correct,
    attempted: acc.attempted,
    pct: acc.pct,
    daily,
    spark: sparklinePoints(daily.map(c => (c / peak) * 100), { w, h, n: days }),
    portals: perPortal,
    streakLeader: leader && leader.streak > 0 ? { id: leader.id, streak: leader.streak } : null,
  };
}
