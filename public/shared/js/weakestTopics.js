// Weakest-topics accuracy ranking — pure, no DOM.
//
// Scores are stored per attempt ({ quizUuid, score, total, exam, date });
// unscored/explore runs never write a row, so absence = no data, never 0%.
// A quiz manifest lists the topics it covers (`m.topics`), so each attempt's
// marks count toward every topic that quiz covers.

/**
 * @param {Array<{quizUuid:string, score:number, total:number}>} scores
 * @param {Object<string, string[]>} quizTopics quizUuid -> topic names
 * @returns {Array<{topic:string, scored:number, total:number, attempts:number, accuracy:number}>}
 *   sorted weakest-first (accuracy asc, then more evidence first, then name)
 */
export function topicAccuracy(scores, quizTopics) {
  const acc = new Map();
  for (const s of scores || []) {
    if (!s || typeof s.score !== 'number' || typeof s.total !== 'number') continue;
    if (!(s.total > 0) || s.score < 0) continue;
    const topics = quizTopics ? quizTopics[s.quizUuid] : null;
    if (!Array.isArray(topics)) continue;
    for (const t of topics) {
      const topic = String(t || '').trim();
      if (!topic) continue;
      const e = acc.get(topic) || { topic, scored: 0, total: 0, attempts: 0 };
      e.scored += s.score;
      e.total += s.total;
      e.attempts += 1;
      acc.set(topic, e);
    }
  }
  return [...acc.values()]
    .map(e => ({ ...e, accuracy: e.total ? e.scored / e.total : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.topic.localeCompare(b.topic));
}

/**
 * The bottom `n` topics with at least `minAttempts` scored attempts.
 * Topics never attempted are absent — no data, not 0%.
 */
export function pickWeakest(rows, n = 5, { minAttempts = 1 } = {}) {
  return (rows || []).filter(r => r.attempts >= minAttempts).slice(0, n);
}
