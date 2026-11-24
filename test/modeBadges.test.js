import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeModel, countsFromScores } from '../public/shared/js/modeBadges.js';

test('badgeModel: top-2 by count, tie breaks to exam first', () => {
  const m = badgeModel({ quizCount: 5, examCount: 9, practiceCount: 2, retryCount: 1 });
  assert.equal(m.badges.length, 2);
  assert.equal(m.badges[0].kind, 'exam');
  assert.equal(m.badges[0].count, 9);
  assert.equal(m.badges[1].kind, 'quiz');
  assert.equal(m.extra, 2);
});

test('badgeModel: fewer than 2 kinds → no extra chip', () => {
  const m = badgeModel({ quizCount: 3 });
  assert.equal(m.badges.length, 1);
  assert.equal(m.badges[0].kind, 'quiz');
  assert.equal(m.extra, 0);
});

test('badgeModel: zero counts → honest new fallback', () => {
  const m = badgeModel({ quizCount: 0, examCount: 0, practiceCount: 0, retryCount: 0 });
  assert.deepEqual(m.badges, [{ kind: 'new', count: 0, icon: '🌱' }]);
  assert.equal(m.extra, 0);
});

test('badgeModel: tie count prefers exam, then quiz', () => {
  const m = badgeModel({ quizCount: 4, examCount: 4, retryCount: 4 });
  assert.equal(m.badges[0].kind, 'exam');
  assert.equal(m.badges[1].kind, 'quiz');
  assert.equal(m.extra, 1);
});

test('countsFromScores: exam flag splits quiz/exam; legacy entries count as quiz', () => {
  const c = countsFromScores([
    { exam: true }, { exam: true }, { exam: false }, {},
    { practice: true }, { mode: 'practice' },
    { retry: true }, { spec: { kind: 'missed' } },
    null, 'bogus'
  ]);
  assert.deepEqual(c, { quizCount: 2, examCount: 2, practiceCount: 2, retryCount: 2 });
});

test('countsFromScores: empty/garbage input → zeros', () => {
  assert.deepEqual(countsFromScores(), { quizCount: 0, examCount: 0, practiceCount: 0, retryCount: 0 });
});
