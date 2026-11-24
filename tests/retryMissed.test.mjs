import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missedQuestions, buildMissedSpec, resolveSpec } from '../public/shared/js/retryMissed.js';

const keyOf = (q) => q.id;
const qs = (arr) => arr.map((id, i) => ({ id, marks: i + 1 }));

const Q = qs(['a', 'b', 'c', 'd']);           // marks 1,2,3,4
const fullMarks = { a: { score: 1 }, b: { score: 2 }, c: { score: 3 }, d: { score: 4 } };

test('empty missed → no spec, button disabled upstream', () => {
  assert.equal(missedQuestions(Q, fullMarks, keyOf).length, 0);
  assert.equal(buildMissedSpec(Q, fullMarks, keyOf), null);
});

test('zero-score and unanswered questions count as missed', () => {
  const answers = { a: { score: 0 }, b: { score: 2 }, d: { score: 0, locked: true } };
  const ids = missedQuestions(Q, answers, keyOf).map((q) => q.id);
  assert.deepEqual(ids, ['a', 'c', 'd']); // a wrong, c untouched, d locked-empty
});

test('partial credit counts as missed, order preserved', () => {
  const answers = { a: { score: 1 }, b: { score: 1 }, c: { score: 2 }, d: { score: 4 } };
  const ids = missedQuestions(Q, answers, keyOf).map((q) => q.id);
  assert.deepEqual(ids, ['b', 'c']); // original run order, not sorted
});

test('spec carries ids, count, marks and a title', () => {
  const spec = buildMissedSpec(Q, { a: { score: 0 }, b: { score: 2 }, d: { score: 2 } }, keyOf);
  assert.equal(spec.kind, 'qs');
  assert.deepEqual(spec.ids, ['a', 'c', 'd']);
  assert.equal(spec.count, 3);
  assert.equal(spec.marks, 8); // 1 + 3 + 4
  assert.match(spec.title, /Retry missed/);
});

test('spec embeds dep stems not in the missed set and echoes provenance', () => {
  const linked = [
    { id: 'stem', marks: 3 },
    { id: 'fup', marks: 2, dependsOn: [{ id: 'stem', showAnswer: true }] },
    { id: 'other', marks: 1 },
  ];
  const spec = buildMissedSpec(linked, { stem: { score: 3 }, fup: { score: 0 }, other: { score: 1 } }, keyOf, {
    uuid: 'set-uuid', category: 'normal', file: 'sets/x.json',
  });
  assert.deepEqual(spec.ids, ['fup']);
  assert.deepEqual(spec.deps.map((q) => q.id), ['stem']); // context survives the subset
  assert.deepEqual(spec.from, { uuid: 'set-uuid', category: 'normal', file: 'sets/x.json' });
  // deps on a missed source aren't embedded (already in the run), strings work too
  const spec2 = buildMissedSpec(
    [{ id: 'a', marks: 1 }, { id: 'b', marks: 1, dependsOn: ['a'] }],
    { a: { score: 0 }, b: { score: 0 } },
    keyOf,
  );
  assert.equal(spec2.deps, undefined);
});

test('resolveSpec maps ids back to questions and drops unknown keys', () => {
  const spec = { kind: 'qs', ids: ['c', 'zz', 'a'] };
  assert.deepEqual(resolveSpec(spec, Q, keyOf).map((q) => q.id), ['c', 'a']);
  assert.deepEqual(resolveSpec(spec, [], keyOf), []);
  assert.deepEqual(resolveSpec(null, Q, keyOf), []);
  assert.deepEqual(resolveSpec({ kind: 'qs' }, Q, keyOf), []);
});
