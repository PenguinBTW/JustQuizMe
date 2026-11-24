import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReason, sanitizeNote, flagKey, sameFlag, removeFlag, groupByPortal,
} from '../public/shared/js/flagStore.js';

const F = (over = {}) => ({
  portal: 'cs', fileBase: 'paper1', questionId: 'q3', reason: 'typo',
  note: 'ans says B', at: '2026-01-02T03:04:05.000Z', ...over,
});

test('normalizeReason keeps known ids, coerces unknown to other', () => {
  assert.equal(normalizeReason('typo'), 'typo');
  assert.equal(normalizeReason('wrong-answer'), 'wrong-answer');
  assert.equal(normalizeReason('bogus'), 'other');
  assert.equal(normalizeReason(''), 'other');
  assert.equal(normalizeReason(undefined), 'other');
});

test('sanitizeNote trims, bounds length, coerces non-strings', () => {
  assert.equal(sanitizeNote('  hi  '), 'hi');
  assert.equal(sanitizeNote(42), '');
  assert.equal(sanitizeNote(undefined), '');
  assert.equal(sanitizeNote('x'.repeat(3000)).length, 2000);
});

test('flagKey / sameFlag identity is (portal, fileBase, questionId, at)', () => {
  const a = F();
  assert.equal(flagKey(a), flagKey(F()));
  assert.ok(sameFlag(a, F()));
  assert.ok(!sameFlag(a, F({ at: '2026-01-03T00:00:00.000Z' })));
  assert.ok(!sameFlag(a, F({ questionId: 'q4' })));
  // questionId comparison is string-coerced (number vs string rows)
  assert.ok(sameFlag(F({ questionId: 7 }), F({ questionId: '7' })));
});

test('flagKey does not collide on concatenated field boundaries', () => {
  const k1 = flagKey(F({ fileBase: 'paper1', questionId: '23' }));
  const k2 = flagKey(F({ fileBase: 'paper12', questionId: '3' }));
  assert.notEqual(k1, k2);
});

test('sameFlag with an id selector matches only that id', () => {
  // The server never field-matches an id-bearing selector: a stored legacy
  // row with identical fields but no id must NOT match (the twin-collision
  // bug the id exists to prevent).
  const legacyTwin = F({ questionId: 'q3' }); // no id, same fields
  const sel = { ...F(), id: 'b2' };
  assert.ok(!sameFlag(sel, legacyTwin));
  assert.ok(sameFlag(sel, { ...F({ questionId: 'other' }), id: 'b2' }));
});

test('removeFlag removes only the first matching row', () => {
  const target = F();
  const flags = [F({ questionId: 'q1' }), target, F({ questionId: 'q3' })];
  const { flags: out, removed } = removeFlag(flags, target);
  assert.ok(removed);
  assert.equal(out.length, 2);
  assert.ok(!out.some((f) => f === target));
  // repeat flag of the same question survives via distinct `at`
  assert.ok(out.some((f) => f.questionId === 'q3'));
});

test('removeFlag is a no-op when nothing matches', () => {
  const flags = [F({ questionId: 'q1' })];
  const { flags: out, removed } = removeFlag(flags, F({ at: '2020-01-01T00:00:00.000Z' }));
  assert.equal(removed, false);
  assert.equal(out, flags);
});

test('groupByPortal buckets preserving order', () => {
  const groups = groupByPortal([F({ portal: 'cs' }), F({ portal: 'maths' }), F({ portal: 'cs', questionId: 'q9' })]);
  assert.deepEqual(Object.keys(groups).sort(), ['cs', 'maths']);
  assert.equal(groups.cs.length, 2);
  assert.equal(groups.cs[1].questionId, 'q9');
});
