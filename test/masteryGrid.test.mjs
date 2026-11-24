import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  topicAccuracy,
  cellColor,
  taxonomyOrder,
  gridModel,
  topicsFor,
} from '../public/shared/js/masteryGrid.js';

test('topicAccuracy buckets per topic, full attribution to multi-topic runs', () => {
  const acc = topicAccuracy([
    { topics: ['Algebra', 'Trigonometry'], score: 7, total: 10 },
    { topics: ['Algebra'], score: 3, total: 5 },
  ]);
  assert.equal(acc.Algebra.correct, 10);
  assert.equal(acc.Algebra.total, 15);
  assert.equal(acc.Algebra.pct, 66.7);
  assert.equal(acc.Trigonometry.total, 10);
});

test('topicAccuracy uses uuidIndex when entry.topics is absent', () => {
  const acc = topicAccuracy(
    [{ quizUuid: 'q1', score: 4, total: 8 }],
    { q1: ['Mechanics'] }
  );
  assert.deepEqual(acc.Mechanics, { correct: 4, total: 8, runs: 1, pct: 50 });
});

test('topicsFor falls back to Mixed practice and survives malformed input', () => {
  assert.deepEqual(topicsFor({}), ['Mixed practice']);
  assert.deepEqual(topicsFor({ topics: [null, {}, '  '] }), ['Mixed practice']);
  assert.deepEqual(topicsFor({ topics: ['', '  Calculus '] }), ['Calculus']);
  assert.doesNotThrow(() => topicsFor(null));
});

test('cellColor: grey when total=0, endpoints of the ramp, clamps out-of-range pct', () => {
  assert.equal(cellColor(80, 0), 'var(--mastery-empty, #3a3f47)');
  assert.equal(cellColor(0, 10), 'rgb(74, 120, 214)');
  assert.equal(cellColor(100, 10), 'rgb(62, 168, 108)');
  assert.equal(cellColor(150, 10), cellColor(100, 10));
  assert.equal(cellColor(-5, 10), cellColor(0, 10));
});

test('taxonomyOrder: first-appearance order across normal then past-paper', () => {
  const order = taxonomyOrder({
    normal: [{ topics: ['A', 'B'] }, { topics: ['B', 'C'] }],
    'past-paper': [{ topics: ['C', 'D'] }],
  });
  assert.deepEqual(order, ['A', 'B', 'C', 'D']);
});

test('gridModel: taxonomy order first, attempted extras appended, zero-attempt topics kept', () => {
  const acc = topicAccuracy([{ topics: ['Extra'], score: 2, total: 4 }]);
  const cells = gridModel(['A', 'B'], acc);
  assert.deepEqual(cells.map(c => c.topic), ['A', 'B', 'Extra']);
  assert.equal(cells[0].total, 0);
  assert.equal(cells[2].pct, 50);
});
