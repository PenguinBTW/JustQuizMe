// Mode badges — pure model for per-portal engagement-mix chips.
// badgeModel() takes counts of each run kind and returns at most the top-2
// badges plus a "+n more" remainder. All-zero input falls back to 'new' —
// honest for a portal with no recorded runs.

const ICONS = { quiz: '📝', exam: '⏱', practice: '✍️', retry: '⟳' };
// display priority when counts tie
const ORDER = ['exam', 'quiz', 'practice', 'retry'];

export function badgeModel({ quizCount = 0, examCount = 0, practiceCount = 0, retryCount = 0 } = {}) {
  const counts = { quiz: quizCount, exam: examCount, practice: practiceCount, retry: retryCount };
  const kinds = ORDER.filter((k) => counts[k] > 0)
    .sort((a, b) => counts[b] - counts[a] || ORDER.indexOf(a) - ORDER.indexOf(b));
  if (kinds.length === 0) {
    return { badges: [{ kind: 'new', count: 0, icon: '🌱' }], extra: 0 };
  }
  const shown = kinds.slice(0, 2).map((kind) => ({ kind, count: counts[kind], icon: ICONS[kind] }));
  return { badges: shown, extra: kinds.length - shown.length };
}

// Count run kinds from a portal's scores array. The stores only mark `exam`
// today; practice/retry fields are read defensively so older entries that
// lack them simply count as quiz — never invented.
export function countsFromScores(scores = []) {
  const c = { quizCount: 0, examCount: 0, practiceCount: 0, retryCount: 0 };
  for (const s of scores || []) {
    if (s == null || typeof s !== 'object') continue;
    if (s.practice === true || s.mode === 'practice') c.practiceCount++;
    else if (s.retry === true || (s.spec && s.spec.kind === 'missed')) c.retryCount++;
    else if (s.exam === true) c.examCount++;
    else c.quizCount++;
  }
  return c;
}
