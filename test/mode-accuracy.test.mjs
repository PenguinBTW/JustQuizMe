import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCURACY_MODES, bestPerMode, modeAccuracyLine, modeOfScore } from '../public/shared/js/modeAccuracy.js';

const s = (uuid, score, total, exam = false) => ({ quizUuid: uuid, score, total, exam });

test('modeOfScore maps the exam flag', () => {
  assert.equal(modeOfScore({ exam: false }), 'quiz');
  assert.equal(modeOfScore({ exam: true }), 'exam');
  assert.equal(modeOfScore({}), 'quiz');
});

test('bestPerMode keeps the best fraction per mode', () => {
  const scores = [
    s('q1', 3, 5), s('q1', 4, 5),          // quiz: best 4/5
    s('q1', 2, 5, true), s('q1', 4, 5, true), // exam: best 4/5
    s('q2', 5, 5)                           // other quiz ignored
  ];
  assert.deepEqual(bestPerMode(scores, 'q1'), {
    quiz: { score: 4, total: 5 },
    exam: { score: 4, total: 5 }
  });
});

test('bestPerMode tolerates missing and malformed entries', () => {
  const scores = [null, undefined, { quizUuid: 'q1' }, s('q1', 'x', 5), s('q1', 1, 0), s('q1', 2, 4)];
  assert.deepEqual(bestPerMode(scores, 'q1'), { quiz: { score: 2, total: 4 } });
  assert.deepEqual(bestPerMode([], 'q1'), {});
  assert.deepEqual(bestPerMode(null, 'q1'), {});
});

test('modeAccuracyLine formats "quiz 3/5 · exam 4/5" and omits absent modes', () => {
  assert.equal(modeAccuracyLine([s('q', 3, 5), s('q', 4, 5, true)], 'q'), 'quiz 3/5 · exam 4/5');
  assert.equal(modeAccuracyLine([s('q', 1, 2, true)], 'q'), 'exam 1/2');
  assert.equal(modeAccuracyLine([], 'q'), '');
});

test('ACCURACY_MODES only covers scored modes — explore never scores', () => {
  assert.deepEqual(ACCURACY_MODES, ['quiz', 'exam']);
});
