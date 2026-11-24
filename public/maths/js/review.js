// Review Queue — aggregates per-question outcomes recorded in score
// entries into a focused retry list, and resolves queued keys back into
// question objects for a retry-spec run.
import { S } from './state.js';
import { stampPool } from './utils.js';

export const REVIEW_DECK_CAP = 24;
// Distinct uuid for practice-only review decks so their score entries stay
// out of the past-paper history/stats (MIXED_UUID entries count there).
export const REVIEW_UUID = '00000000-0000-4000-a000-00000000f00d';

const fileBase = (f) => String(f || '').replace(/\.json$/i, '');

// Question keys are `<cat>|<fileBase>:<questionId>` lowercased, where cat is
// 'p' (past-paper) or 'n' (normal/practice). Pool-stamped keys (`base:id`)
// are always past-paper; bare ids take their attempt's category so two
// same-named files in different banks stay distinct. Lowercased so legacy
// uppercase `helped` entries still match.
export function normalizeKey(key, quizFile, category) {
  const k = String(key || '').toLowerCase();
  if (k.includes('|')) return k;
  if (k.includes(':')) return `p|${k}`;
  const cat = category === 'normal' ? 'n' : 'p';
  return `${cat}|${fileBase(quizFile).toLowerCase()}:${k}`;
}

const num = (v) => (Number.isFinite(+v) ? +v : 0);
const numOrNull = (v) => (v != null && Number.isFinite(+v) ? +v : null);

// Scores are stored newest-first: the most recent outcome for a question
// decides — a later full-marks attempt clears it from the queue.
export function reviewQueue(scores = S.scores, quizzes = S.quizzes) {
  const uuidCat = new Map();
  for (const m of quizzes?.normal || []) uuidCat.set(m.uuid, 'normal');
  for (const m of quizzes?.['past-paper'] || []) uuidCat.set(m.uuid, 'past-paper');

  const status = new Map();
  const detail = new Map();
  const order = [];
  const mark = (key, isWeak, e, w) => {
    if (!status.has(key)) {
      status.set(key, isWeak ? 'weak' : 'strong');
      if (isWeak) {
        const got = num(w?.got);
        const marks = numOrNull(w?.marks);
        detail.set(key, {
          key,
          cat: key.charAt(0) === 'n' ? 'normal' : 'past-paper',
          fileKey: key.slice(key.indexOf('|') + 1, key.lastIndexOf(':')),
          qid: key.slice(key.lastIndexOf(':') + 1),
          misses: 1,
          got,
          marks,
          lost: marks != null ? marks - got : null,
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
    const cat = uuidCat.get(e?.quizUuid) || 'past-paper';
    // One entry = one outcome per question: a helped question that also
    // landed in weak counts as a single miss.
    const seen = new Set();
    const once = (key, isWeak, w) => {
      const nk = normalizeKey(key, file, cat);
      if (seen.has(nk)) return;
      seen.add(nk);
      mark(nk, isWeak, e, w);
    };
    for (const k of e?.strong || []) once(k, false);
    for (const w of e?.weak || []) once(w?.k, true, w);
    // Entries recorded before weak/strong existed only kept helped ids —
    // a helped question scored 0, so it counts as weak.
    for (const h of e?.helped || []) once(h, true);
  }
  return order.filter((k) => status.get(k) === 'weak').map((k) => detail.get(k));
}

// Queue items -> fetch refs { category, file, keys: [questionId] } for a
// retry spec, prioritised by repeat misses then marks lost.
export function planReviewRefs(items, quizzes) {
  // Real file casing comes from the bank listing (keys are lowercased).
  const fileIndex = new Map();
  for (const [cat, metas] of [['normal', quizzes?.normal], ['past-paper', quizzes?.['past-paper']]]) {
    for (const m of metas || []) {
      fileIndex.set(`${cat}|${fileBase(m.file).toLowerCase()}`, m.file);
    }
  }
  const picked = [...items].sort((a, b) => (b.misses - a.misses) || ((b.lost ?? 0) - (a.lost ?? 0)));
  const byFile = new Map();
  picked.forEach((it, rank) => {
    const cat = it.cat || 'past-paper';
    const refKey = `${cat}|${it.fileKey}`;
    const ref = byFile.get(refKey) || { category: cat, file: fileIndex.get(refKey) || `${it.fileKey}.json`, keys: [], ranks: {} };
    ref.keys.push(it.qid);
    ref.ranks[it.qid] = rank;
    byFile.set(refKey, ref);
  });
  return [...byFile.values()];
}

// Resolves refs into pool-stamped questions via an injected fetcher so this
// stays free of the api module. Only a candidate ranked inside the cap can
// make the deck, so refs holding strictly lower ranks are fetched lazily —
// and only if the top ranks resolve short (missing/revised banks).
// `pool` carries every fetched question (past-paper stamps) for
// dependency lookups.
export async function resolveReviewDeck(refs, fetchQuiz, cap = REVIEW_DECK_CAP) {
  const candidates = [];
  const pool = [];
  const unfetched = [];
  const collect = async (ref) => {
    let quiz;
    try {
      quiz = await fetchQuiz(ref.category, ref.file);
    } catch {
      return;
    }
    if (!quiz) return;
    const wanted = new Map();
    (ref.keys || []).forEach((k, i) => wanted.set(String(k).toLowerCase(), ref.ranks?.[k] ?? i));
    for (const q of stampPool(quiz, ref.file)) {
      pool.push(q);
      const rank = wanted.get(String(q.id).toLowerCase());
      if (rank != null) {
        // Normal-bank questions get an 'n|' _key so outcomes recorded on the
        // review deck match the file-run keys for the same bank.
        candidates.push({ q: ref.category === 'normal' ? { ...q, _key: `n|${q._key.toLowerCase()}` } : q, rank });
      }
    }
  };
  for (const ref of refs || []) {
    const minRank = Math.min(...(ref.keys || []).map((k, i) => ref.ranks?.[k] ?? i), Infinity);
    if (minRank < cap) await collect(ref);
    else unfetched.push(ref);
  }
  // Global priority order, not file order — a repeat miss in a later file
  // still outranks a one-off in an earlier one.
  candidates.sort((a, b) => a.rank - b.rank);
  for (let i = 0; candidates.length < cap && i < unfetched.length; i++) {
    await collect(unfetched[i]);
    candidates.sort((a, b) => a.rank - b.rank);
  }
  const set = candidates.slice(0, cap).map((c) => c.q);
  const tot = set.reduce((s, q) => s + (q.marks || 0), 0);
  return { set, tot, pool };
}
