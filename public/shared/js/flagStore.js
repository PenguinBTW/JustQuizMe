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

// Identity of a stored flag — `id` (assigned at POST) when present, else the
// field tuple serialized as JSON (a plain concatenation collides:
// fileBase 'paper1'+questionId '23' === 'paper12'+'3'). `at` discriminates
// repeat flags of the same question (POST intentionally doesn't dedupe).
export function flagKey(f) {
  return f.id
    ? `id:${f.id}`
    : JSON.stringify([f.portal, f.fileBase, f.questionId, f.at]
        .map((v) => String(v ?? '')));
}

// Mirrors the DELETE handler: a selector carrying `id` matches ONLY that id
// (the server never falls back to fields for id-bearing selectors); a
// selector without `id` matches the full field tuple for legacy rows.
export function sameFlag(sel, f) {
  if (sel.id) return f.id === sel.id;
  return (
    sel.portal === f.portal &&
    sel.fileBase === f.fileBase &&
    String(sel.questionId) === String(f.questionId) &&
    sel.at === f.at
  );
}

// Remove the first flag matching the selector; returns { flags, removed }.
export function removeFlag(flags, sel) {
  const i = flags.findIndex((f) => sameFlag(sel, f));
  if (i < 0) return { flags, removed: false };
  return { flags: flags.slice(0, i).concat(flags.slice(i + 1)), removed: true };
}

// Flags bucketed {portal: [...]}, preserving within-portal order.
export function groupByPortal(flags) {
  const out = {};
  flags.forEach((f) => { (out[f.portal] ||= []).push(f); });
  return out;
}
