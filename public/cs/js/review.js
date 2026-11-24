// Review Queue — aggregates per-question outcomes recorded in score
// entries into a focused retry list, and resolves queued keys back into
// question objects for a retry-spec run.
import { S } from './state.js';
import { stampPool } from './utils.js';

export const REVIEW_DECK_CAP = 24;

const fileBase = (f) => String(f || '').replace(/\.json$/i, '');

// Question keys are namespaced to `<fileBase>:<questionId>` — pool-run
// keys already carry the prefix, file-run keys get their attempt's file.
// Lowercased so keys match however the source quiz cased them.
export function normalizeKey(key, quizFile) {
  const k = String(key || '').toLowerCase();
  return k.includes(':') ? k : `${fileBase(quizFile).toLowerCase()}:${k}`;
}

// Scores are stored newest-first: the most recent outcome for a question
// decides — a later full-marks attempt clears it from the queue.
export function reviewQueue(scores = S.scores) {
  const status = new Map();
  const detail = new Map();
  const order = [];
  const mark = (key, isWeak, e, w) => {
    if (!status.has(key)) {
      status.set(key, isWeak ? 'weak' : 'strong');
      if (isWeak) {
        detail.set(key, {
          key,
          misses: 1,
          got: w?.got ?? 0,
          marks: w?.marks ?? null,
          lost: w?.marks != null ? w.marks - (w.got ?? 0) : null,
          quizTitle: e?.quizTitle || '',
          quizFile: e?.quizFile || '',
          date: e?.date || ''
        });
        order.push(key);
      }
      return;
    }
    if (isWeak && status.get(key) === 'weak') detail.get(key).misses++;
  };
  for (const e of scores || []) {
    const file = e?.quizFile || '';
    for (const k of e?.strong || []) mark(normalizeKey(k, file), false, e);
    for (const w of e?.weak || []) mark(normalizeKey(w?.k, file), true, e, w);
  }
  return order.filter((k) => status.get(k) === 'weak').map((k) => detail.get(k));
}

// Queue items -> fetch refs { category, file, keys: [questionId] } for a
// retry spec, prioritised by repeat misses then marks lost, deck-capped.
export function planReviewRefs(items, quizzes) {
  // Keys are lowercase; restore each file's real name from quiz metadata so
  // fetches work on case-sensitive filesystems (`Mock2024.json`).
  const meta = new Map();
  for (const [category, list] of [['normal', quizzes?.normal], ['past-paper', quizzes?.['past-paper']]]) {
    for (const m of list || []) meta.set(String(m.file).toLowerCase(), { file: m.file, category });
  }
  const byFile = new Map();
  for (const it of [...items].sort((a, b) => (b.misses - a.misses) || ((b.lost ?? 0) - (a.lost ?? 0)))) {
    const sep = it.key.indexOf(':');
    const lower = `${it.key.slice(0, sep)}.json`;
    const hit = meta.get(lower);
    const ref = byFile.get(lower) || { category: hit?.category || 'past-paper', file: hit?.file || lower, keys: [] };
    ref.keys.push(it.key.slice(sep + 1));
    byFile.set(lower, ref);
  }
  return [...byFile.values()];
}

// Resolves refs into pool-stamped questions (`<fileBase>:<id>` keys) via
// an injected fetcher so this stays free of the api module.
export async function resolveReviewDeck(refs, fetchQuiz, cap = REVIEW_DECK_CAP) {
  const set = [];
  let tot = 0;
  for (const ref of refs || []) {
    if (set.length >= cap) break;
    let quiz;
    try {
      quiz = await fetchQuiz(ref.category, ref.file);
    } catch {
      continue;
    }
    if (!quiz) continue;
    const wanted = new Set((ref.keys || []).map((k) => String(k).toLowerCase()));
    for (const q of stampPool(quiz, ref.file)) {
      if (set.length >= cap) break;
      if (wanted.has(String(q.id).toLowerCase())) {
        set.push(q);
        tot += q.marks || 0;
      }
    }
  }
  return { set, tot };
}
