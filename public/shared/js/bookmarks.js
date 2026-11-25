// Question bookmarks — pure helpers (no DOM, no fetch; callers inject storage).
// A bookmark's identity is `category|file|qid` — the category prefix keeps a
// normal set and a past paper sharing a filename from colliding, matching the
// `_key`/`_srcFile` conventions used by taxonomy and stars.

export function bookmarkKey(ref) {
  return `${ref && ref.category ? ref.category : ''}|${ref && ref.file ? ref.file : ''}|${ref && ref.qid ? ref.qid : ''}`;
}

// q: question object; meta: run meta ({category, file, title?});
// index: position inside the source quiz (recovery hint).
export function makeBookmark(q, meta, index) {
  const qid = q._origQid || q.id;
  const file = q._srcFile || (meta && meta.file) || '';
  const category = q._srcCat || (meta && meta.category) || '';
  const snippet = stripTags(q.promptHtml || q.prompt || q.question || '').slice(0, 90);
  return {
    key: bookmarkKey({ category, file, qid }),
    qid,
    file,
    category,
    index: Number.isInteger(index) ? index : null,
    quizUuid: (meta && meta.uuid) || '',
    quizTitle: (meta && meta.title) || '',
    topic: q.topic || q.subtopic || q.section || '',
    snippet,
    addedAt: new Date().toISOString()
  };
}

export function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dedupe by key (first wins), newest-first.
export function normalizeBookmarks(list) {
  const seen = new Set();
  const out = [];
  for (const b of Array.isArray(list) ? list : []) {
    if (!b || !b.qid || !b.file) continue;
    const key = bookmarkKey(b);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...b, key });
  }
  out.sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
  return out;
}

export function isBookmarked(list, ref) {
  const k = bookmarkKey(ref);
  return (list || []).some(b => b && b.key === k);
}

// Build a single-question quizLike for beginRun. `quiz` is the full source
// quiz payload ({uuid, version, title, questions}); the bookmark's stored
// index is honoured only when the id still matches, else we search by id.
export function scopedQuizLike(bookmark, quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) return null;
  const qs = quiz.questions;
  const q =
    (Number.isInteger(bookmark.index) && qs[bookmark.index] && qs[bookmark.index].id === bookmark.qid
      ? qs[bookmark.index]
      : qs.find(x => x.id === bookmark.qid)) || null;
  if (!q) return null;
  return {
    uuid: quiz.uuid,
    version: quiz.version,
    title: `Bookmarked — ${quiz.title || bookmark.quizTitle || 'Question'}`,
    timeLimitMinutes: null,
    questions: [{ ...q, _srcFile: q._srcFile || bookmark.file, _srcCat: q._srcCat || bookmark.category }]
  };
}
