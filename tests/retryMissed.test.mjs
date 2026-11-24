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

test('resolveSpec maps ids back to questions and drops unknown keys', () => {
  const spec = { kind: 'qs', ids: ['c', 'zz', 'a'] };
  assert.deepEqual(resolveSpec(spec, Q, keyOf).map((q) => q.id), ['c', 'a']);
  assert.deepEqual(resolveSpec(spec, [], keyOf), []);
  assert.deepEqual(resolveSpec(null, Q, keyOf), []);
  assert.deepEqual(resolveSpec({ kind: 'qs' }, Q, keyOf), []);
});
