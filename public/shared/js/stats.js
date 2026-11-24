// JustQuizMe stats dashboard — pure helpers (group-by-topic, streaks, sparkline).
// No DOM; every function takes plain data and returns plain data/strings.

// Coerce a stored topic name — scores.json is user-writable via the API, so
// entries can be malformed (objects, nulls, huge strings). Never throw.
function cleanTopics(list) {
  const out = [];
  for (const t of list) {
    if (typeof t !== 'string' && typeof t !== 'number') continue;
    let s = '';
    try { s = String(t).trim(); } catch { continue; }
    if (s) out.push(s.slice(0, 80));
  }
  return out;
}

// Resolve which topics a score entry covered.
// Order: entry.topics[] → quizTitle prefix before ' · ' → uuidIndex fallback → 'Mixed practice'.
export function topicsFor(score, uuidIndex = {}) {
  if (Array.isArray(score?.topics) && score.topics.length) {
    const t = cleanTopics(score.topics);
    if (t.length) return t;
  }
  const idx = score ? uuidIndex[score.quizUuid] : undefined;
  if (Array.isArray(idx) && idx.length) {
    const t = cleanTopics(idx);
    if (t.length) return t;
  }
  const title = typeof score?.quizTitle === 'string' ? score.quizTitle : '';
  const head = title.split(' · ')[0].trim();
  if (head && !/^(mixed|custom|past paper)/i.test(head)) return [head.slice(0, 80)];
  return ['Mixed practice'];
}

// Per-topic { correct, attempted, pct } — a run covering multiple topics is
// attributed fully to each one (marks were spread across those topics).
export function groupByTopic(scores, uuidIndex = {}) {
  const groups = new Map();
  for (const s of scores || []) {
    const score = Number(s?.score) || 0;
    const total = Number(s?.total) || 0;
    for (const topic of topicsFor(s, uuidIndex)) {
      const g = groups.get(topic) || { topic, correct: 0, attempted: 0, runs: 0 };
      g.correct += score;
      g.attempted += total;
      g.runs += 1;
      groups.set(topic, g);
    }
  }
  const out = [...groups.values()].map(g => ({
    ...g,
    pct: g.attempted ? Math.round((g.correct / g.attempted) * 1000) / 10 : 0
  }));
  out.sort((a, b) => b.attempted - a.attempted || a.topic.localeCompare(b.topic));
  return out;
}

export function weakestTopic(groups, minAttempts = 1) {
  const eligible = (groups || []).filter(g => g.attempted >= minAttempts);
  if (!eligible.length) return null;
  return eligible.reduce((w, g) => (g.pct < w.pct ? g : w));
}

// Consecutive calendar days (ending today or yesterday) with >= 1 run.
// A run today or yesterday anchors the streak; an earlier gap resets it.
export function streakDays(dates, now = new Date()) {
  const days = new Set();
  for (const d of dates || []) {
    const t = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(t.getTime())) continue;
    days.add(
      `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    );
  }
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const key = dt =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  // Anchor: if today has no run, start from yesterday (streak is still alive).
  if (!days.has(key(day))) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(key(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

// Tiny SVG polyline points string for last-N run percentages (oldest → newest).
export function sparklinePoints(pcts, { w = 120, h = 28, pad = 2, n = 14 } = {}) {
  const vals = (pcts || []).slice(-n);
  if (!vals.length) return '';
  const inner = { w: Math.max(1, w - pad * 2), h: Math.max(1, h - pad * 2) };
  const x = i => pad + (vals.length === 1 ? inner.w / 2 : (i / (vals.length - 1)) * inner.w);
  const y = v => pad + inner.h - (Math.max(0, Math.min(100, v)) / 100) * inner.h;
  return vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}

// Last-N per-run percentages, oldest → newest.
export function recentPcts(scores, n = 14) {
  return (scores || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-n)
    .map(s => (Number(s?.total) ? Math.round((Number(s.score) / Number(s.total)) * 1000) / 10 : 0));
}
