import assert from 'node:assert/strict';
import { test } from 'node:test';
import { topicAccuracy, pickWeakest } from '../public/shared/js/weakestTopics.js';

const TOPICS = {
  'quiz-a': ['Algebra, Polynomials & Proof', 'Trigonometry'],
  'quiz-b': ['Trigonometry'],
  'quiz-c': ['Mechanics']
};

test('topicAccuracy attributes attempt marks to every covered topic', () => {
  const rows = topicAccuracy(
    [
      { quizUuid: 'quiz-a', score: 3, total: 10 },
      { quizUuid: 'quiz-b', score: 8, total: 10 }
    ],
    TOPICS
  );
  const alg = rows.find(r => r.topic === 'Algebra, Polynomials & Proof');
  const trig = rows.find(r => r.topic === 'Trigonometry');
  const mech = rows.find(r => r.topic === 'Mechanics');
  assert.equal(alg.attempts, 1);
  assert.equal(alg.accuracy, 0.3);
  assert.equal(trig.scored, 11);
  assert.equal(trig.total, 20);
  assert.equal(mech, undefined); // no attempts → absent, not 0%
});

test('pickWeakest returns bottom topics weakest-first', () => {
  const rows = topicAccuracy(
    [
      { quizUuid: 'quiz-a', score: 2, total: 10 },
      { quizUuid: 'quiz-b', score: 9, total: 10 },
      { quizUuid: 'quiz-c', score: 5, total: 10 }
    ],
    TOPICS
  );
  const weak = pickWeakest(rows, 3);
  assert.deepEqual(weak.map(r => r.topic), [
    'Algebra, Polynomials & Proof',
    'Mechanics',
    'Trigonometry'
  ]);
});

test('non-numeric and zero-total entries are ignored, not counted as 0%', () => {
  const rows = topicAccuracy(
    [
      { quizUuid: 'quiz-a', score: 0, total: 0 },
      { quizUuid: 'quiz-a' },
      null,
      { quizUuid: 'quiz-a', score: 5, total: 10 }
    ],
    TOPICS
  );
  const alg = rows.find(r => r.topic === 'Algebra, Polynomials & Proof');
  assert.equal(alg.attempts, 1);
  assert.equal(alg.accuracy, 0.5);
});

test('scores on quizzes with no topic mapping are skipped', () => {
  const rows = topicAccuracy([{ quizUuid: 'unknown', score: 1, total: 5 }], TOPICS);
  assert.deepEqual(rows, []);
  assert.deepEqual(topicAccuracy([{ quizUuid: 'quiz-a', score: 1, total: 5 }], {}), []);
  assert.deepEqual(topicAccuracy(null, TOPICS), []);
});

test('pickWeakest respects n and minAttempts', () => {
  const rows = [
    { topic: 'a', scored: 1, total: 10, attempts: 1, accuracy: 0.1 },
    { topic: 'b', scored: 2, total: 10, attempts: 3, accuracy: 0.2 },
    { topic: 'c', scored: 3, total: 10, attempts: 1, accuracy: 0.3 }
  ];
  assert.deepEqual(pickWeakest(rows, 2).map(r => r.topic), ['a', 'b']);
  assert.deepEqual(pickWeakest(rows, 5, { minAttempts: 2 }).map(r => r.topic), ['b']);
});
