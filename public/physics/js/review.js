// Review Queue — aggregates per-question outcomes recorded in score
// entries into a focused retry list, and resolves queued keys back into
// question objects for a retry-spec run.
import { S } from './state.js';
import { stampPool } from './utils.js';

export const REVIEW_DECK_CAP = 24;

const fileBase = (f) => String(f || '').replace(/\.json$/i, '');

// Question keys are namespaced to `<fileBase>:<questionId>` — pool-run
// keys already carry the prefix, file-run keys get their attempt's file.
// Lowercased so legacy uppercase `helped` entries match.
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
    // Entries recorded before weak/strong existed only kept helped ids —
    // a helped question scored 0, so it counts as weak.
    for (const h of e?.helped || []) mark(normalizeKey(h, file), true, e);
  }
  return order.filter((k) => status.get(k) === 'weak').map((k) => detail.get(k));
}

// Queue items -> fetch refs { category, file, keys: [questionId] } for a
// retry spec, prioritised by repeat misses then marks lost, deck-capped.
export function planReviewRefs(items, quizzes, cap = REVIEW_DECK_CAP) {
  const picked = [...items]
    .sort((a, b) => (b.misses - a.misses) || ((b.lost ?? 0) - (a.lost ?? 0)))
    .slice(0, cap);
  const byFile = new Map();
  for (const it of picked) {
    const sep = it.key.indexOf(':');
    const file = `${it.key.slice(0, sep)}.json`;
    const ref = byFile.get(file) || { file, keys: [] };
    ref.keys.push(it.key.slice(sep + 1));
    byFile.set(file, ref);
  }
  const normalFiles = new Set((quizzes?.normal || []).map((m) => String(m.file).toLowerCase()));
  return [...byFile.values()].map((r) => ({
    category: normalFiles.has(r.file.toLowerCase()) ? 'normal' : 'past-paper',
    ...r
  }));
}

// Resolves refs into pool-stamped questions (`<fileBase>:<id>` keys) via
// an injected fetcher so this stays free of the api module.
export async function resolveReviewDeck(refs, fetchQuiz) {
  const set = [];
  let tot = 0;
  for (const ref of refs || []) {
    let quiz;
    try {
      quiz = await fetchQuiz(ref.category, ref.file);
    } catch {
      continue;
    }
    if (!quiz) continue;
    const wanted = new Set((ref.keys || []).map((k) => String(k).toLowerCase()));
    for (const q of stampPool(quiz, ref.file)) {
      if (wanted.has(String(q.id).toLowerCase())) {
        set.push(q);
        tot += q.marks || 0;
      }
    }
  }
  return { set, tot };
}
