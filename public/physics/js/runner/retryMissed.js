// Physics "Retry missed" — thin wiring over the shared spec builder.
import { S, MIXED_UUID } from '../state.js';
import { ak, orderTypeShuffled } from '../utils.js';
import { beginRun } from './assessment.js';
import { missedQuestions, buildMissedSpec, resolveSpec } from '../../../shared/js/retryMissed.js';

export function missedCount() {
  return missedQuestions(S.quiz?.questions || [], S.answers || {}, ak).length;
}

export function startQuestionsRun(qs, spec, shuffle = false) {
  if (!qs.length) return false;
  const tot = qs.reduce((s, q) => s + (+q.marks || 0), 0);
  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `${spec?.title || 'Retry missed'} (${qs.length}Q)`,
      timeLimitMinutes: null,
      exam: false,
      questions: shuffle ? orderTypeShuffled(qs) : qs,
    },
    meta: { category: 'past-paper', file: 'mixed', virtual: true },
    retrySpec: spec || { kind: 'qs', ids: qs.map(ak), count: qs.length, marks: tot },
  });
  return true;
}

// Results-view button: re-run only the questions scored below full marks.
export function retryMissed() {
  const spec = buildMissedSpec(S.quiz?.questions || [], S.answers || {}, ak);
  if (!spec) return false;
  const qs = missedQuestions(S.quiz.questions, S.answers, ak);
  return startQuestionsRun(qs, spec);
}

// 'qs' kind for retryRun — resolves spec ids against the still-loaded
// previous run's questions and gives them the fresh shuffle.
export function retrySpecRun(r) {
  const qs = resolveSpec(r, S.quiz?.questions || [], ak);
  if (!qs.length) return false;
  return startQuestionsRun(qs, r, true);
}
