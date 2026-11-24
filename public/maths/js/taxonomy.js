// Maths Specification Taxonomy & Knapsack Picker
import { S, OCR_MATHS_TOPIC_SPECS } from './state.js';
import { api } from './api.js';
import { normT, stampPool, shuffle, orderTypeShuffled } from './utils.js';

export async function ensurePastFull() {
  for (const m of S.quizzes['past-paper']) {
    if (!S.pastFull[m.file]) {
      try {
        S.pastFull[m.file] = await api(`/api/quiz?category=past-paper&file=${encodeURIComponent(m.file)}`);
      } catch {
        /* skip */
      }
    }
  }
  const all = {};
  for (const m of S.quizzes['past-paper']) {
    const quiz = S.pastFull[m.file];
    if (!quiz) continue;
    for (const q of stampPool(quiz, m.file)) all[q._key] = q;
  }
  S._pastAll = all;
}

export function topicData() {
  return OCR_MATHS_TOPIC_SPECS.map(spec => {
    const topic = spec.topic;
    const subs = new Map();
    let quizCount = 0;

    for (const m of S.quizzes['past-paper']) {
      const quiz = S.pastFull[m.file];
      if (!quiz) continue;
      if (!(quiz.topics || []).some(t => normT(t) === normT(topic))) continue;
      quizCount++;

      for (const q of quiz.questions || []) {
        const name = (q.subtopic || 'General').trim() || 'General';
        if (!subs.has(name)) subs.set(name, { name, questions: [], srcs: [] });
        const g = subs.get(name);
        g.questions.push({ ...q, _key: `${m.file.replace(/\.json$/i, '')}:${q.id}`, _imgBase: quiz.imageFolder || '', _src: quiz.title, _srcFile: m.file });
        if (!g.srcs.find(s => s.file === m.file)) g.srcs.push({ file: m.file, title: quiz.title });
      }
    }
    const qcount = [...subs.values()].reduce((s, g) => s + g.questions.length, 0);
    const mmarks = [...subs.values()].reduce((s, g) => s + g.questions.reduce((a, q) => a + (+q.marks || 0), 0), 0);
    return { ...spec, quizCount, qcount, mmarks, subs: [...subs.values()] };
  });
}

export function buildCaches() {
  const data = topicData();
  S._topicData = data;
  S._subCache = new Map();
  data.forEach(t => t.subs.forEach((g, gi) => S._subCache.set(`${t.topic}|${gi}`, { topic: t.topic, sub: g })));
  data.forEach((t, ti) => S._topicCache.set('t' + ti, { t, all: topicAllQs(t) }));
}

export function topicDraft(topic, mmarks) {
  const d = (S.topicDrafts[topic] ||= { marks: Math.min(15, Math.max(1, mmarks)), mode: 'standard' });
  d.marks = Math.max(1, Math.min(mmarks, d.marks));
  return d;
}

export function topicAllQs(t) {
  return t.subs.flatMap(g => g.questions.map(q => ({ ...q, _sub: g.name })));
}

export function pickExact(pool, target) {
  target = Math.max(1, Math.round(target));
  const dp = Array(target + 1).fill(null);
  dp[0] = [];
  for (const q of pool) {
    const m = +q.marks || 0;
    if (m <= 0 || m > target) continue;
    for (let s = target - m; s >= 0; s--) {
      if (dp[s] && !dp[s + m]) dp[s + m] = [...dp[s], q];
    }
  }
  for (let s = target; s >= 0; s--) {
    if (dp[s] && dp[s].length) return { set: dp[s], tot: s };
  }
  // No subset sums to <= target: every question overshoots, so offer the
  // smallest-marked one as the closest available fit.
  const smallest = pool.filter(q => (+q.marks || 0) > 0).sort((a, b) => (+a.marks || 0) - (+b.marks || 0))[0];
  return { set: smallest ? [smallest] : [], tot: smallest ? (+smallest.marks || 0) : 0 };
}

export function pickForMode(pool, mode, target) {
  const shuffled = shuffle(pool);
  const { set, tot } = pickExact(shuffled, target);
  return { set: mode === 'random' ? shuffle(set) : orderTypeShuffled(set), tot };
}

export function mixedPool() {
  const out = [];
  const seen = new Set();
  const cache = S._subCache || new Map();
  for (const key of S.mixed.subs) {
    const c = cache.get(key);
    if (!c || !S.mixed.topics.has(c.topic)) continue;
    for (const q of c.sub.questions) {
      const k = q._key || q.id;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...q, _sub: c.sub.name, _topic: c.topic });
    }
  }
  return out;
}
