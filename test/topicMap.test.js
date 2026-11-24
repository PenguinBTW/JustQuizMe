import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicMapModel, topicsFor, topicColor } from '../public/shared/js/topicMap.js';

const A = (quizUuid, score, total, quizTitle = '') => ({ quizUuid, score, total, quizTitle });

test('groups attempts by topic via the quiz uuid index', () => {
  const idx = { q1: ['Algebra', 'Proof'], q2: ['Algebra'] };
  const rows = topicMapModel([
    A('q1', 3, 10), A('q1', 5, 10), A('q2', 8, 10), A('q2', 8, 10),
  ], idx);
  const alg = rows.find((r) => r.topic === 'Algebra');
  const proof = rows.find((r) => r.topic === 'Proof');
  assert.equal(alg.n, 4);            // both q1 attempts count fully toward Algebra
  assert.equal(alg.accuracy, 24 / 40);
  assert.equal(proof.n, 2);
  assert.equal(proof.accuracy, 8 / 20);
});

test('sorted weakest-first, ties break on attempt count', () => {
  const idx = { w: ['Weak'], m: ['Mid'], s: ['Strong'] };
  const rows = topicMapModel([
    A('w', 1, 10), A('w', 2, 10),
    A('m', 5, 10), A('m', 5, 10),
    A('s', 9, 10), A('s', 10, 10),
  ], idx);
  assert.deepEqual(rows.map((r) => r.topic), ['Weak', 'Mid', 'Strong']);
});

test('min-count gate skips topics with fewer than 2 attempts', () => {
  const idx = { a: ['Once'], b: ['Twice'] };
  const rows = topicMapModel([A('a', 0, 10), A('b', 5, 10), A('b', 5, 10)], idx);
  assert.deepEqual(rows.map((r) => r.topic), ['Twice']);
});

test('falls back to quizTitle then Mixed practice; empty stays empty', () => {
  assert.deepEqual(topicsFor(A('x', 1, 1, 'Trig · 8-mark quiz'), {}), ['Trig']);
  assert.deepEqual(topicsFor(A('x', 1, 1), {}), ['Mixed practice']);
  assert.deepEqual(topicsFor(A('x', 1, 1, 'Mixed pack'), {}), ['Mixed practice']);
  assert.deepEqual(topicMapModel([], {}), []);
  assert.deepEqual(topicMapModel([A('a', 0, 10)], {}), []); // gated -> hidden
});

test('malformed attempts are skipped, never throw', () => {
  const rows = topicMapModel([
    { quizUuid: 'b' }, { score: 'x', total: 10 }, { score: 5, total: 0 },
    A('b', 4, 10), A('b', 4, 10),
  ], { b: ['Calc'] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].n, 2);
});

test('color ramps red->green with accuracy', () => {
  assert.equal(topicColor(0), 'hsl(0, 62%, 42%)');
  assert.equal(topicColor(1), 'hsl(120, 62%, 42%)');
  assert.equal(topicColor(-1), 'hsl(0, 62%, 42%)');
  assert.equal(topicColor(2), 'hsl(120, 62%, 42%)');
});
