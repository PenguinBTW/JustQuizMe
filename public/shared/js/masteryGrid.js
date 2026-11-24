// JustQuizMe topic-mastery heatmap — pure helpers. No DOM, no fetch.
// Every function takes plain data and returns plain data/strings.

// Coerce a stored topic name — scores.json is user-writable via the API, so
// entries can be malformed (objects, nulls, huge strings). Never throw.
function cleanTopics(list) {
  const out = [];
  for (const t of list || []) {
    if (typeof t !== 'string' && typeof t !== 'number') continue;
    let s = '';
    try { s = String(t).trim(); } catch { continue; }
    if (s) out.push(s);
  }
  return out;
}

// Which topics an attempt covered: entry.topics[] wins, then the uuidIndex
// (uuid -> topics[] from the quiz list), then 'Mixed practice'.
export function topicsFor(attempt, uuidIndex = {}) {
  if (Array.isArray(attempt?.topics) && attempt.topics.length) {
    const t = cleanTopics(attempt.topics);
    if (t.length) return t;
  }
  const idx = attempt ? uuidIndex[attempt.quizUuid] : undefined;
  if (Array.isArray(idx) && idx.length) {
    const t = cleanTopics(idx);
    if (t.length) return t;
  }
  return ['Mixed practice'];
}

// Per-topic { correct, total, pct } buckets. A run covering several topics is
// attributed fully to each one (marks were spread across them).
export function topicAccuracy(attempts, uuidIndex = {}) {
  const groups = new Map();
  for (const a of attempts || []) {
    const score = Number(a?.score) || 0;
    const total = Number(a?.total) || 0;
    for (const topic of topicsFor(a, uuidIndex)) {
      const g = groups.get(topic) || { topic, correct: 0, total: 0, runs: 0 };
      g.correct += score;
      g.total += total;
      g.runs += 1;
      groups.set(topic, g);
    }
  }
  const out = {};
  for (const [topic, g] of groups) {
    out[topic] = {
      correct: g.correct,
      total: g.total,
      runs: g.runs,
      pct: g.total ? Math.round((g.correct / g.total) * 1000) / 10 : 0,
    };
  }
  return out;
}

// Cold→warm heat ramp. total=0 (topic exists but no attempts) is neutral grey.
// pct is clamped 0–100; hue runs 210 (cold blue) → 12 (warm red) through amber.
export function cellColor(pct, total) {
  if (!total || total <= 0) return 'var(--mastery-empty, #3a3f47)';
  const p = Math.max(0, Math.min(100, Number(pct) || 0)) / 100;
  // Three-stop ramp: blue → amber → green, so "mastery" reads warm, not alarmed.
  const stops = [
    [0.0, [74, 120, 214]],   // cold
    [0.55, [222, 160, 66]],  // mid amber
    [1.0, [62, 168, 108]],   // mastered green
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const span = hi[0] - lo[0] || 1;
  const f = Math.max(0, Math.min(1, (p - lo[0]) / span));
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Taxonomy order: topics as they first appear across the portal's quiz list
// (list is already in spec order), past-paper trailing topics appended last.
export function taxonomyOrder(quizzes) {
  const order = [];
  const seen = new Set();
  const push = q => {
    for (const t of cleanTopics(q?.topics)) {
      if (!seen.has(t)) { seen.add(t); order.push(t); }
    }
  };
  for (const q of quizzes?.normal || []) push(q);
  for (const q of quizzes?.['past-paper'] || []) push(q);
  return order;
}

// Ordered view model: every taxonomy topic (even unattempted → total 0), then
// any attempted topic outside the taxonomy (e.g. 'Mixed practice') appended.
export function gridModel(topics, accuracy = {}) {
  const used = new Set();
  const cells = [];
  for (const topic of topics || []) {
    const a = accuracy[topic] || { correct: 0, total: 0, runs: 0, pct: 0 };
    used.add(topic);
    cells.push({ topic, correct: a.correct, total: a.total, runs: a.runs || 0, pct: a.pct });
  }
  for (const topic of Object.keys(accuracy).sort()) {
    if (used.has(topic)) continue;
    const a = accuracy[topic];
    cells.push({ topic, correct: a.correct, total: a.total, runs: a.runs || 0, pct: a.pct });
  }
  return cells;
}
