// Retry-missed spec builder — pure, DOM-free, unit-testable.
// A question counts as "missed" when the recorded score is below its mark
// total (covers wrong answers, partial credit, and unanswered questions).
// `keyOf` is injected (the portals' answer-key fn, e.g. maths `ak`) so the
// module stays state/DOM-free.

export function missedQuestionIds(answers, questions, keyOf) {
  return (questions || [])
    .filter((q) => ((answers?.[keyOf(q)]?.score ?? 0) < (+q.marks || 0)))
    .map(keyOf);
}

// Retry spec naming the missed question keys, in the run's original order —
// kind 'qs' mirrors the physics retryMissed spec shape so a shared launcher
// can read either. `from` carries the source run's provenance
// ({uuid, version, category, file}) so the retry lands in the same history
// bucket as its parent run.
export function buildRetrySpec(questions, answers, keyOf, from) {
  const ids = missedQuestionIds(answers, questions, keyOf);
  if (!ids.length) return null;
  const byKey = new Map((questions || []).map((q) => [keyOf(q), q]));
  const marks = ids.reduce((s, id) => s + (+byKey.get(id)?.marks || 0), 0);
  const spec = {
    kind: 'qs',
    ids,
    count: ids.length,
    marks,
    title: `Retry missed · ${ids.length}Q · ${marks}m`,
  };
  if (from && typeof from === 'object') spec.from = from;
  return spec;
}

// Resolve a 'qs' spec's ids back to question objects from a pool — the
// finished run's question list is still in state on the results view.
export function resolveSpecQuestions(spec, pool, keyOf) {
  if (!spec || !Array.isArray(spec.ids)) return [];
  const byKey = new Map((pool || []).map((q) => [keyOf(q), q]));
  return spec.ids.map((id) => byKey.get(id)).filter(Boolean);
}
