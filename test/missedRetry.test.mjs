// Tests for the pure retry-missed helpers (no DOM needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectMissed, buildRetrySpec, questionsFromRefs } from '../public/shared/js/missedRetry.js';

const ak = (q) => q._key || q.id;

const QUESTIONS = [
  { id: 'q1', marks: 4 },
  { id: 'q2', marks: 6 },
  { id: 'q3', marks: 2 },
  { id: 'q4', marks: 5 },
];

test('collectMissed picks up partial credit, zero scores and unattempted, in order', () => {
  const answers = {
    q1: { score: 4 },            // full marks — not missed
    q2: { score: 3 },            // partial credit — missed
    // q3 absent — unattempted — missed
    q4: { score: 0 },            // attempted but scored 0 — missed
  };
  const refs = collectMissed(QUESTIONS, answers, ak);
  assert.deepEqual(refs.map(r => r.id), ['q2', 'q3', 'q4']);
  assert.deepEqual(refs.map(r => r.index), [1, 2, 3]);
  assert.equal(refs[0].available, 6);
  assert.equal(refs[0].awarded, 3);
  assert.equal(refs[2].awarded, 0);
});

test('collectMissed returns empty when everything scored full marks', () => {
  const answers = { q1: { score: 4 }, q2: { score: 6 }, q3: { score: 2 }, q4: { score: 5 } };
  assert.deepEqual(collectMissed(QUESTIONS, answers, ak), []);
});

test('collectMissed handles empty/null input safely', () => {
  assert.deepEqual(collectMissed([], {}, ak), []);
  assert.deepEqual(collectMissed(null, null, ak), []);
});

test('collectMissed uses _key when present (keyOf behaviour)', () => {
  const qs = [{ _key: 'k9', id: 'qx', marks: 3 }];
  const refs = collectMissed(qs, { k9: { score: 1 } }, ak);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].id, 'k9');
});

test('buildRetrySpec produces the kind/title/refs envelope', () => {
  const refs = collectMissed(QUESTIONS, { q1: { score: 4 }, q2: { score: 1 }, q3: { score: 0 } }, ak);
  const spec = buildRetrySpec(refs, 'Paper Two');
  assert.equal(spec.kind, 'missed');
  assert.equal(spec.title, 'Retry missed · Paper Two');
  assert.deepEqual(spec.refs, [
    { id: 'q2', available: 6, awarded: 1 },
    { id: 'q3', available: 2, awarded: 0 },
    { id: 'q4', available: 5, awarded: 0 },
  ]);
});

test('questionsFromRefs returns the question objects in original order', () => {
  const refs = collectMissed(QUESTIONS, { q1: { score: 4 }, q3: { score: 2 }, q4: { score: 2 }, q2: { score: 0 } }, ak);
  const qs = questionsFromRefs(QUESTIONS, refs);
  assert.deepEqual(qs.map(q => q.id), ['q2', 'q4']);
  assert.deepEqual(questionsFromRefs(QUESTIONS, []), []);
});
