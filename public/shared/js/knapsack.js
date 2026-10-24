// JustQuizMe Knapsack & Exact-Fit Question Sampling Engine
import { shuffle } from './utils.js';

/**
 * Exact-fit picker: samples questions from pool totalling `target` marks when possible.
 * Falls back to largest total under target.
 */
export function pickExact(pool, target) {
  if (!pool || !pool.length) return [];
  const sh = shuffle(pool);
  let best = [];
  let bestSum = 0;

  for (let pass = 0; pass < 35; pass++) {
    const p = pass === 0 ? sh : shuffle(pool);
    const cur = [];
    let sum = 0;
    for (const q of p) {
      const m = Number(q.marks) || 1;
      if (sum + m <= target) {
        cur.push(q);
        sum += m;
        if (sum === target) break;
      }
    }
    if (sum === target) return cur;
    if (sum > bestSum) {
      bestSum = sum;
      best = cur;
    }
  }
  return best;
}

export function pickForMode(pool, mode, target) {
  const chosen = pickExact(pool, target);
  return mode === 'random' ? shuffle(chosen) : chosen;
}

/**
 * Groups raw question pool by canonical topic taxonomy
 */
export function buildTopicTaxonomy(rawQuizzes, topicSpecs) {
  const topicMap = new Map();
  topicSpecs.forEach(spec => {
    topicMap.set(spec.topic, {
      topic: spec.topic,
      name: spec.topic,
      subs: []
    });
  });

  rawQuizzes.forEach(quiz => {
    (quiz.questions || []).forEach(q => {
      const t = q.topic || quiz.title || 'General';
      if (!topicMap.has(t)) {
        topicMap.set(t, { topic: t, name: t, subs: [] });
      }
      const entry = topicMap.get(t);
      const subName = q.subtopic || 'General';
      let subGroup = entry.subs.find(s => s.name === subName);
      if (!subGroup) {
        subGroup = { name: subName, questions: [] };
        entry.subs.push(subGroup);
      }
      subGroup.questions.push(q);
    });
  });

  return Array.from(topicMap.values());
}
