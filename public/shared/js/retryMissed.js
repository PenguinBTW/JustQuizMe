// Retry-missed spec builder — pure, DOM-free, unit-testable.
// A question counts as "missed" when the recorded score is below its mark
// total (covers incorrect answers, partial credit, and unanswered/'none').
// keyOf is injected (the portals' `ak`) so the module stays DOM/state-free.

export function missedQuestions(questions, answers, keyOf) {
  return (questions || []).filter((q) => {
    const a = answers?.[keyOf(q)] || {};
    return (a.score ?? 0) < (+q.marks || 0);
  });
}

// A retry spec naming the missed question keys, in the run's original order.
export function buildMissedSpec(questions, answers, keyOf) {
  const qs = missedQuestions(questions, answers, keyOf);
  if (!qs.length) return null;
  const marks = qs.reduce((s, q) => s + (+q.marks || 0), 0);
  return {
    kind: 'qs',
    ids: qs.map(keyOf),
    count: qs.length,
    marks,
    title: `Retry missed · ${qs.length}Q · ${marks}m`,
  };
}

// Resolve a 'qs' spec's ids back to question objects from a pool
// (the previous run's question list is still in state on the results view).
export function resolveSpec(spec, pool, keyOf) {
  if (!spec || !Array.isArray(spec.ids)) return [];
  const byKey = new Map((pool || []).map((q) => [keyOf(q), q]));
  return spec.ids.map((id) => byKey.get(id)).filter(Boolean);
}
