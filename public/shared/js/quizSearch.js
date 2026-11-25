// Pure quiz-search helpers — no DOM. Used by the maths portal picker
// (views/past.js); terms match a row's haystack (title + topic) case-
// insensitively, multi-word queries AND together.

export function parseTerms(query) {
  return (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchQuiz(haystack, terms) {
  const h = (haystack || '').toLowerCase();
  return terms.every(t => h.includes(t.toLowerCase()));
}

export function countLabel(shown, total) {
  return `${shown} of ${total} quizzes`;
}

export function emptyMessage(terms) {
  return terms.length ? 'No quizzes match your search.' : '';
}
