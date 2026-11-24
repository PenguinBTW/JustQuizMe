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

// dependsOn entries may be plain ids or {id, showAnswer} objects.
function depIdsOf(q) {
  return (q.dependsOn || []).map((d) => (typeof d === 'string' ? d : d?.id)).filter(Boolean);
}

// A retry spec naming the missed question keys, in the run's original order.
// `from` carries the source run's provenance ({uuid, category, file}) so the
// retry attempt lands in the same history bucket as its parent run. `deps`
// embeds the linked context questions a missed follow-up needs that are not
// themselves missed — the retry runner re-merges them into the dep pool.
export function buildMissedSpec(questions, answers, keyOf, from) {
  const qs = missedQuestions(questions, answers, keyOf);
  if (!qs.length) return null;
  const missedKeys = new Set(qs.map(keyOf));
  const byId = new Map();
  for (const q of questions || []) if (q?.id) byId.set(q.id, q);
  const deps = [];
  const seenDeps = new Set();
  for (const q of qs) {
    for (const id of depIdsOf(q)) {
      const src = byId.get(id);
      if (src && !missedKeys.has(keyOf(src)) && !seenDeps.has(id)) {
        seenDeps.add(id);
        deps.push(src);
      }
    }
  }
  const marks = qs.reduce((s, q) => s + (+q.marks || 0), 0);
  const spec = {
    kind: 'qs',
    ids: qs.map(keyOf),
    count: qs.length,
    marks,
    title: `Retry missed · ${qs.length}Q · ${marks}m`,
  };
  if (deps.length) spec.deps = deps;
  if (from && typeof from === 'object') spec.from = from;
  return spec;
}

// Resolve a 'qs' spec's ids back to question objects from a pool
// (the previous run's question list is still in state on the results view).
export function resolveSpec(spec, pool, keyOf) {
  if (!spec || !Array.isArray(spec.ids)) return [];
  const byKey = new Map((pool || []).map((q) => [keyOf(q), q]));
  return spec.ids.map((id) => byKey.get(id)).filter(Boolean);
}
