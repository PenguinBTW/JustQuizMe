// Practice mode — pure spec model for the low-stakes self-check runner.
// Practice runs are never scored into stats: spec.stats === 'skip' marks the
// run so callers/tests can assert stats exclusion explicitly.

export const PRACTICE_KIND = 'practice';
export const PRACTICE_STATS = 'skip';

export function practiceSpec(questions) {
  const items = (questions || []).map(q => ({ q, shown: false, got: null }));
  return {
    kind: PRACTICE_KIND,
    stats: PRACTICE_STATS,
    items,
    idx: 0,
    done: items.length === 0
  };
}

export function reveal(spec) {
  if (spec.done || !spec.items[spec.idx] || spec.items[spec.idx].shown) return spec;
  const items = spec.items.slice();
  items[spec.idx] = { ...items[spec.idx], shown: true };
  return { ...spec, items };
}

export function mark(spec, gotIt) {
  const cur = spec.items[spec.idx];
  if (spec.done || !cur || !cur.shown) return spec;
  const items = spec.items.slice();
  items[spec.idx] = { ...cur, got: !!gotIt };
  const idx = spec.idx + 1;
  return { ...spec, items, idx, done: idx >= items.length };
}

export function summary(spec) {
  const got = spec.items.filter(i => i.got === true).length;
  const missed = spec.items.filter(i => i.got === false).length;
  return { got, missed, total: spec.items.length, kind: spec.kind, stats: spec.stats };
}

// Field guesses shared by the mount and tests: portals store question text,
// options and answers under differing keys.
export function questionText(q) {
  return q.prompt || q.question || q.text || q.q || q.stem || '';
}
export function questionOptions(q) {
  const o = q.options || q.choices;
  return Array.isArray(o) ? o : null;
}
export function questionAnswer(q) {
  const a = q.answer ?? q.correct ?? q.markscheme ?? q.markScheme ?? q.model ?? q.solution;
  if (a == null) return 'No answer recorded.';
  if (typeof a === 'string') return a;
  if (Array.isArray(a)) return a.map(String).join(' · ');
  try { return JSON.stringify(a); } catch { return String(a); }
}
