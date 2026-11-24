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
  const from = spec?.from || {};
  // beginRun resolves dependsOn against run questions + S._pastAll only, so a
  // missed follow-up would lose a linked stem that wasn't itself missed —
  // fold the spec's embedded dep stems in for the resolve, then restore.
  const prevAll = S._pastAll;
  if (spec?.deps?.length) {
    S._pastAll = { ...(prevAll || {}), ...Object.fromEntries(spec.deps.map((q) => [ak(q), q])) };
  }
  try {
    S.returnRoom = 'past';
    beginRun({
      mode: 'quiz',
      quizLike: {
        uuid: from.uuid || MIXED_UUID,
        version: 1,
        title: `${spec?.title || 'Retry missed'} (${qs.length}Q)`,
        timeLimitMinutes: null,
        exam: false,
        questions: shuffle ? orderTypeShuffled(qs) : qs,
      },
      meta: { category: from.category || 'past-paper', file: from.file || 'mixed', virtual: true },
      retrySpec: spec || { kind: 'qs', ids: qs.map(ak), count: qs.length },
    });
  } finally {
    if (spec?.deps?.length) S._pastAll = prevAll;
  }
  return true;
}

// Results-view button: re-run only the questions scored below full marks.
export function retryMissed() {
  const spec = buildMissedSpec(S.quiz?.questions || [], S.answers || {}, ak, {
    uuid: S.quiz?.uuid,
    category: S.quizMeta?.category,
    file: S.quizMeta?.file,
  });
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
