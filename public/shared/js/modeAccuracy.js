// Per-mode accuracy helpers for quiz cards (DOM-free).
// Maths score entries carry `exam: boolean` (see maths/js/runner/finish.js):
// scored modes are 'quiz' (exam=false) and 'exam' (exam=true). Explore runs
// are unscored by design and never land in the scores feed, so they can't
// have an accuracy line.

export const ACCURACY_MODES = ['quiz', 'exam'];

export function modeOfScore(score) {
  return score && score.exam ? 'exam' : 'quiz';
}

// Best attempt per scored mode for one quiz — best = highest score/total
// fraction; equal fractions prefer the larger denominator (more marks shown).
export function bestPerMode(scores, quizUuid) {
  const out = {};
  for (const s of scores || []) {
    if (!s || s.quizUuid !== quizUuid) continue;
    if (typeof s.score !== 'number' || typeof s.total !== 'number' || s.total <= 0) continue;
    const mode = modeOfScore(s);
    const cur = out[mode];
    if (
      !cur ||
      s.score / s.total > cur.score / cur.total ||
      (s.score / s.total === cur.score / cur.total && s.total > cur.total)
    ) {
      out[mode] = { score: s.score, total: s.total };
    }
  }
  return out;
}

// "quiz 3/5 · exam 4/5" — empty string when the quiz has no scored attempts.
export function modeAccuracyLine(scores, quizUuid) {
  const per = bestPerMode(scores, quizUuid);
  return ACCURACY_MODES
    .filter((m) => per[m])
    .map((m) => `${m} ${per[m].score}/${per[m].total}`)
    .join(' · ');
}
