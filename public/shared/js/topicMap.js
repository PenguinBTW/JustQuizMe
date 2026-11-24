// JustQuizMe mistake heatmap — pure helpers. No DOM, no fetch.
// Groups stored attempts by topic and returns weakest-first rows with a
// min-attempt gate so one lucky/unlucky run doesn't paint a topic.

const MIN_N = 2;

function cleanTopic(t) {
  if (typeof t !== 'string' && typeof t !== 'number') return null;
  let s = '';
  try { s = String(t).trim(); } catch { return null; }
  return s || null;
}

// Which topics an attempt covered: uuidIndex (uuid -> topics[] from the quiz
// list) wins, then the saved quizTitle ("<topic> · N-mark quiz"), else 'Mixed'.
export function topicsFor(attempt, uuidIndex = {}) {
  const idx = attempt ? uuidIndex[attempt.quizUuid] : undefined;
  if (Array.isArray(idx)) {
    const t = idx.map(cleanTopic).filter(Boolean);
    if (t.length) return t;
  }
  const titled = String(attempt?.quizTitle || '').split('·')[0].trim();
  if (titled && !/^mixed/i.test(titled)) return [titled];
  return ['Mixed practice'];
}

// accuracy color: red (0%) -> amber -> green (100%), fixed-point hue.
export function topicColor(accuracy) {
  const a = Math.max(0, Math.min(1, Number(accuracy) || 0));
  return `hsl(${Math.round(a * 120)}, 62%, 42%)`;
}

// attempts: [{quizUuid, quizTitle, score, total, ...}]
// uuidIndex: { quizUuid: [topics] } built from /<portal>/api/quizzes
// -> [{topic, accuracy, n, color}] sorted weakest-first (ties: more attempts first)
export function topicMapModel(attempts = [], uuidIndex = {}, { minN = MIN_N } = {}) {
  const buckets = new Map();
  for (const a of attempts || []) {
    const score = Number(a?.score), total = Number(a?.total);
    if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) continue;
    for (const topic of topicsFor(a, uuidIndex)) {
      const b = buckets.get(topic) || { got: 0, out: 0, n: 0 };
      b.got += score; b.out += total; b.n += 1;
      buckets.set(topic, b);
    }
  }
  const rows = [];
  for (const [topic, b] of buckets) {
    if (b.n < minN) continue;
    const accuracy = b.out > 0 ? b.got / b.out : 0;
    rows.push({ topic, accuracy, n: b.n, color: topicColor(accuracy) });
  }
  rows.sort((x, y) => x.accuracy - y.accuracy || y.n - x.n || x.topic.localeCompare(y.topic));
  return rows;
}
