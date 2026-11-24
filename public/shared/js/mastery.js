// Mastery dashboard aggregation — pure functions over stored score entries.
// Kept DOM-free so portals and node-level tests can exercise it directly.
//
// Score entry shape (identical across maths / cs / physics finish flows):
//   { date, quizUuid, quizFile, quizTitle, score, total, minutes, seconds, exam, breakdown }
// Manifest shape (GET /{subject}/api/quizzes):
//   { normal: [{ file, title, topics: [...], ... }], 'past-paper': [...] }

export const MIXED_TOPIC = 'Mixed / Custom Papers';

// file -> topics[] for every quiz the subject knows about.
export function indexQuizzes(manifests) {
  const map = new Map();
  for (const cat of ['normal', 'past-paper']) {
    for (const m of manifests?.[cat] || []) {
      if (m && m.file) map.set(m.file, Array.isArray(m.topics) ? m.topics : []);
    }
  }
  return map;
}

// A score whose quizFile no manifest lists (synthesized papers, deleted files)
// lands in a catch-all bucket rather than being dropped silently.
export function topicsForScore(score, quizIndex) {
  const topics = score && score.quizFile ? quizIndex.get(score.quizFile) : null;
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
