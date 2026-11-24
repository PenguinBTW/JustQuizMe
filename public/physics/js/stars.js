// Starred questions — pure helpers (no DOM, no fetch; loadQuiz is injected).
// A star's identity is `category|file|qid` — the category prefix keeps a
// normal set and a past paper that share a filename from colliding, and
// file:qid still pins the question inside its source quiz, matching
// taxonomy's `_key` convention. A question is the same star whether it
// appears in a file quiz, a mixed set, or an explore run.

export function starKey(ref) {
  return `${ref && ref.category ? ref.category : ''}|${ref && ref.file ? ref.file : ''}|${ref && ref.qid ? ref.qid : ''}`;
}

// q: question object (may carry _srcFile in topic-pool runs);
// meta: S.quizMeta ({category, file, title?}); index: position in the run.
export function makeStarRef(q, meta, index) {
  const file = q._srcFile || (meta && meta.file) || '';
  const category = q._srcCat || (meta && meta.category) || '';
  return {
    key: starKey({ category, file, qid: q.id }),
    qid: q.id,
    file,
    category,
    index: Number.isInteger(index) ? index : null,
    topic: q.topic || '',
    subtopic: q.subtopic || q.section || '',
    title: (meta && meta.title) || ''
  };
}

export function isStarred(stars, ref) {
  const k = starKey(ref);
  return (stars || []).some(s => s && s.key === k);
}

// Dedupe by key (first wins) and order newest-first so a stale/duplicated
// store still renders sanely.
export function normalizeStars(list) {
  const seen = new Set();
  const out = [];
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || !s.qid) continue;
    const key = starKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...s, key });
  }
  out.sort((a, b) => String(b.starredAt || '').localeCompare(String(a.starredAt || '')));
  return out;
}

// Resolve each star to its question object. loadQuiz(category, file) is
// injected (browser passes api('/api/quiz?...'), tests pass a stub) and each
// distinct quiz is fetched once. Stars whose quiz or question is gone are
// dropped; the stored index is honoured only when the id still matches.
export async function resolveStarred(stars, loadQuiz) {
  const cache = new Map();
  const out = [];
  for (const s of stars || []) {
    if (!s || !s.file || !s.qid) continue;
    const ck = `${s.category}|${s.file}`;
    if (!cache.has(ck)) cache.set(ck, await loadQuiz(s.category, s.file).catch(() => null));
    const quiz = cache.get(ck);
    if (!quiz) continue;
    const qs = quiz.questions || [];
    const q = qs[s.index] && qs[s.index].id === s.qid ? qs[s.index] : qs.find(x => x.id === s.qid);
    if (q) out.push({ ...q, _srcFile: q._srcFile || s.file, _srcCat: q._srcCat || s.category });
  }
  return out;
}
