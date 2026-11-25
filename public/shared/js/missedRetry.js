// Pure helpers for "Retry missed questions" — no DOM, no portal imports.

// collectMissed(questions, answers, keyOf) → ordered refs for every question
// whose awarded score is below its available marks. Partial credit and
// unattempted (score 0, including entries the finish screen synthesizes)
// both count. `answers` maps keyOf(q) → {score, ...} as the results screen
// stores it; missing entries count as 0 awarded.
export function collectMissed(questions, answers, keyOf) {
  const refs = [];
  (questions || []).forEach((q, i) => {
    const available = typeof q?.marks === 'number' ? q.marks : 0;
    const awarded = answers?.[keyOf(q)]?.score ?? 0;
    if (awarded < available) {
      refs.push({ index: i, id: keyOf(q), available, awarded });
    }
  });
  return refs;
}

// buildRetrySpec(refs, sourceTitle) → a retry-spec record in the same
// { kind, ... } envelope retryRun() dispatches on for saved/retry runs.
// Kind 'missed' is intentionally NOT fed back into S.retrySpec: it is only
// rebuildable while the finished run's question objects are still in memory,
// so the missed-retry run carries the ORIGINAL retrySpec forward (its
// results screen's generic "try again" replays the source run). This spec
// is the provenance record — title + which refs were collected.
export function buildRetrySpec(refs, sourceTitle = '') {
  return {
    kind: 'missed',
    title: `Retry missed · ${sourceTitle}`,
    refs: (refs || []).map(r => ({ id: r.id, available: r.available, awarded: r.awarded })),
  };
}

// questionsFromRefs(questions, refs) → the question objects for a retry run,
// in original question order.
export function questionsFromRefs(questions, refs) {
  return (refs || []).map(r => questions[r.index]).filter(Boolean);
}
