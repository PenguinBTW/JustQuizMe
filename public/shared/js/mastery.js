// Mastery dashboard aggregation — pure functions over stored score entries.
// Kept DOM-free so portals and node-level tests can exercise it directly.
//
// Score entry shape (identical across maths / cs / physics finish flows):
//   { date, quizUuid, quizFile, quizTitle, score, total, minutes, seconds, exam, breakdown }
// Manifest shape (GET /{subject}/api/quizzes):
//   { normal: [{ file, title, topics: [...], ... }], 'past-paper': [...] }

export const MIXED_TOPIC = 'Mixed / Custom Papers';

// uuid -> topics[] and file -> topics[] for every quiz the subject knows
// about. Scores carry quizUuid, so match on it first: a filename can exist in
// both the normal and past-paper categories, where file-only lookup would
// silently credit the wrong quiz's topics.
export function indexQuizzes(manifests) {
  const byUuid = new Map();
  const byFile = new Map();
  for (const cat of ['normal', 'past-paper']) {
    for (const m of manifests?.[cat] || []) {
      if (!m) continue;
      const topics = Array.isArray(m.topics) ? m.topics : [];
      if (m.uuid) byUuid.set(m.uuid, topics);
      if (m.file && !byFile.has(m.file)) byFile.set(m.file, topics);
    }
  }
  return { byUuid, byFile };
}

// A score matching no manifest entry (synthesized papers, deleted files)
// lands in a catch-all bucket rather than being dropped silently.
export function topicsForScore(score, quizIndex) {
  if (!score) return [MIXED_TOPIC];
  const topics =
    (score.quizUuid && quizIndex.byUuid.get(score.quizUuid)) ||
    (score.quizFile && quizIndex.byFile.get(score.quizFile));
  return topics && topics.length ? topics : [MIXED_TOPIC];
}

// Marks-weighted mastery per topic. A paper covering several topics credits
// its whole mark total to each — per-question topic attribution isn't stored.
export function aggregateMastery(scores, quizIndex) {
  const stats = new Map();
  for (const s of scores || []) {
    const earned = Number(s && s.score) || 0;
    const total = Number(s && s.total) || 0;
    for (const topic of topicsForScore(s, quizIndex)) {
      const g = stats.get(topic) || { earned: 0, total: 0, attempts: 0 };
      g.earned += earned;
      g.total += total;
      g.attempts += 1;
      stats.set(topic, g);
    }
  }
  return [...stats.entries()].map(([topic, g]) => ({
    topic,
    ...g,
    pct: g.total > 0 ? Math.round((g.earned / g.total) * 100) : 0,
  }));
}

// Lowest-mastery topics with at least one attempt; ties broken by marks seen.
export function weakestTopics(stats, n = 3) {
  return stats
    .filter(s => s.attempts > 0)
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, n);
}

// Recent score% points, chronological. Scores are stored newest-first.
export function recentTrend(scores, n = 10) {
  return (scores || []).slice(0, n).reverse().map(s => ({
    pct: Math.round(((Number(s.score) || 0) / (Number(s.total) || 1)) * 100),
    date: s.date,
    exam: !!s.exam,
  }));
}
