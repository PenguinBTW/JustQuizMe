// Pure flag-store model — shared shape for the flags list, no DOM.
// Used by the launchpad flags page and (via require'less duplication)
// mirrors the identity a DELETE /api/flags call targets.

const REASON_IDS = new Set(['wrong-answer', 'broken-figure', 'typo', 'other']);

// Coerce an arbitrary reason string to a known id; unknown → 'other'.
export function normalizeReason(reason) {
  return REASON_IDS.has(reason) ? reason : 'other';
}

export function sanitizeNote(note) {
  if (typeof note !== 'string') return '';
  return note.trim().slice(0, 2000);
}

// Identity of a stored flag — the timestamp discriminates repeat flags of
// the same question (POST intentionally doesn't dedupe).
export function flagKey(f) {
  return [f.portal, f.fileBase, f.questionId, f.at].map((v) => String(v ?? '')).join('');
}

export function sameFlag(a, b) {
  return (
    a.portal === b.portal &&
    a.fileBase === b.fileBase &&
    String(a.questionId) === String(b.questionId) &&
    a.at === b.at
  );
}

// Remove the first flag matching the selector; returns { flags, removed }.
export function removeFlag(flags, sel) {
  const i = flags.findIndex((f) => sameFlag(f, sel));
  if (i < 0) return { flags, removed: false };
  return { flags: flags.slice(0, i).concat(flags.slice(i + 1)), removed: true };
}

// Newest-first list, grouped {portal: [...]}, preserving within-portal order.
export function groupByPortal(flags) {
  const out = {};
  flags.forEach((f) => { (out[f.portal] ||= []).push(f); });
  return out;
}
