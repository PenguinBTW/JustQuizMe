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
          cat: w?.cat || e?.category || null,
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

// Queue items -> fetch refs { category, file, keys: [{ id, r }] } for a
// retry spec, sorted by repeat misses then marks lost; r keeps each key's
// global rank so the deck fills in priority order across files.
export function planReviewRefs(items, quizzes) {
  // Keys are lowercase; restore each file's real name from quiz metadata so
  // fetches work on case-sensitive filesystems (`Mock2024.json`). A basename
  // can exist in both banks — prefer the bank the score entry was recorded
  // under (it.cat), and remember the other as `alt` for a fallback fetch.
  const meta = new Map();
  for (const [category, list] of [['normal', quizzes?.normal], ['past-paper', quizzes?.['past-paper']]]) {
    for (const m of list || []) {
      const lower = String(m.file).toLowerCase();
      const cands = meta.get(lower) || [];
      cands.push({ file: m.file, category });
      meta.set(lower, cands);
    }
  }
  const byBank = new Map();
  [...items]
    .sort((a, b) => (b.misses - a.misses) || ((b.lost ?? 0) - (a.lost ?? 0)))
    .forEach((it, r) => {
      const sep = it.key.indexOf(':');
      const lower = `${it.key.slice(0, sep)}.json`;
      const cands = meta.get(lower) || [];
      const hit = cands.find((c) => c.category === it.cat) || cands[0] || { file: lower, category: 'past-paper' };
      const alt = cands.find((c) => c !== hit) || null;
      const groupKey = `${hit.category}|${hit.file}`;
      const ref = byBank.get(groupKey) || { category: hit.category, file: hit.file, alt, keys: [] };
      ref.keys.push({ id: it.key.slice(sep + 1), r });
      byBank.set(groupKey, ref);
    });
  return [...byBank.values()];
}

// Resolves refs into pool-stamped questions (`<fileBase>:<id>` keys) via
// an injected fetcher so this stays free of the api module. The deck fills
// in queue-rank order — not file order — so high-priority misses always win
// slots over easier ones in other files.
export async function resolveReviewDeck(refs, fetchQuiz, cap = REVIEW_DECK_CAP) {
  const found = [];
  const worstKeptRank = () => (found.length < cap ? Infinity : found.map((x) => x.r).sort((a, b) => a - b)[cap - 1]);
  for (const ref of refs || []) {
    // Refs come out of planReviewRefs ordered by their best-ranked key, so
    // once the deck is full and every remaining key ranks worse, no later
    // fetch can change the outcome.
    if ((ref.keys || []).every((k) => k.r > worstKeptRank())) break;
    const wanted = new Map((ref.keys || []).map((k) => [String(k.id).toLowerCase(), k.r]));
    for (const bank of [ref, ref.alt].filter(Boolean)) {
      if (!wanted.size) break;
      let quiz;
      try {
        quiz = await fetchQuiz(bank.category, bank.file);
      } catch {
        continue;
      }
      if (!quiz) continue;
      for (const q of stampPool(quiz, ref.file, bank.category)) {
        const r = wanted.get(String(q.id).toLowerCase());
        if (r !== undefined) {
          wanted.delete(String(q.id).toLowerCase());
          found.push({ q, r });
        }
      }
    }
  }
  const set = found.sort((a, b) => a.r - b.r).slice(0, cap).map((x) => x.q);
  return { set, tot: set.reduce((s, q) => s + (q.marks || 0), 0) };
}
