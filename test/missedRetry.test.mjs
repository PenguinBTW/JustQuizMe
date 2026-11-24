import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { missedQuestionIds, buildRetrySpec, resolveSpecQuestions } from '../public/shared/js/missedRetry.js';

const ak = (q) => q.key ?? q.id;
const q = (id, marks) => ({ id, key: id, marks });

const questions = [q('a', 3), q('b', 2), q('c', 4), q('d', 1)];

describe('missedQuestionIds', () => {
  test('wrong, partial, and unanswered all count as missed', () => {
    const answers = { a: { score: 3 }, b: { score: 1 }, c: { score: 0 } }; // d unanswered
    assert.deepEqual(missedQuestionIds(answers, questions, ak), ['b', 'c', 'd']);
  });

  test('full marks are not missed; empty answers → all missed', () => {
    const answers = { a: { score: 3 }, b: { score: 2 }, c: { score: 4 }, d: { score: 1 } };
    assert.deepEqual(missedQuestionIds(answers, questions, ak), []);
    assert.equal(missedQuestionIds({}, questions, ak).length, 4);
  });
});

describe('buildRetrySpec', () => {
  test('spec keeps run order, sums marks, carries provenance', () => {
    const spec = buildRetrySpec(questions, { a: { score: 1 }, b: { score: 2 }, c: { score: 0 }, d: { score: 1 } }, ak,
      { uuid: 'u1', version: 2, category: 'past-paper', file: 'june' });
    assert.equal(spec.kind, 'qs');
    assert.deepEqual(spec.ids, ['a', 'c']);
    assert.equal(spec.count, 2);
    assert.equal(spec.marks, 7);
    assert.match(spec.title, /2Q.*7m/);
    assert.equal(spec.from.uuid, 'u1');
  });

  test('returns null when nothing was missed', () => {
    const answers = { a: { score: 3 }, b: { score: 2 }, c: { score: 4 }, d: { score: 1 } };
    assert.equal(buildRetrySpec(questions, answers, ak), null);
  });
});

describe('resolveSpecQuestions', () => {
  test('resolves ids back to question objects, skipping unknowns', () => {
    const spec = { kind: 'qs', ids: ['b', 'zzz', 'd'] };
    assert.deepEqual(resolveSpecQuestions(spec, questions, ak).map((x) => x.id), ['b', 'd']);
  });

  test('null/bad spec resolves to empty', () => {
    assert.deepEqual(resolveSpecQuestions(null, questions, ak), []);
    assert.deepEqual(resolveSpecQuestions({ kind: 'qs' }, questions, ak), []);
  });
});
