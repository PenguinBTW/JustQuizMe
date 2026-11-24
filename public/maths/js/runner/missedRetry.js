// Maths "Retry missed" — thin wiring over the shared spec builder.
import { S, MIXED_UUID } from '../state.js';
import { ak } from '../utils.js';
import { beginRun } from './assessment.js';
import { buildRetrySpec, resolveSpecQuestions } from '../../../shared/js/missedRetry.js';

export function missedCount() {
  return (buildRetrySpec(S.quiz?.questions || [], S.answers || {}, ak) || { count: 0 }).count;
}

// Results-view button: re-run only the questions scored below full marks,
// same quiz-mode conventions as the original run (exam flag preserved; a
// timed exam keeps its per-mark allowance via the spec's marks).
export function retryMissed() {
  const spec = buildRetrySpec(S.quiz?.questions || [], S.answers || {}, ak, {
    uuid: S.quiz?.uuid,
    version: S.quiz?.version,
    category: S.quizMeta?.category,
    file: S.quizMeta?.file,
  });
  if (!spec) return false;
  const qs = resolveSpecQuestions(spec, S.quiz?.questions || [], ak);
  if (!qs.length) return false;
  const from = spec.from || {};
  S.returnRoom = 'past';
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: from.uuid || MIXED_UUID,
      version: from.version ?? 1,
      title: `${spec.title} (${qs.length}Q)`,
      timeLimitMinutes: S.quiz?.exam ? spec.marks * 1.5 : null,
      exam: !!S.quiz?.exam,
      questions: qs,
    },
    meta: { category: from.category || 'past-paper', file: from.file || 'mixed', virtual: true },
    retrySpec: spec,
  });
  return true;
}
