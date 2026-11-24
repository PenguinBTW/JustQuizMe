import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from '../public/shared/js/streak.js';

// Fixed clock: Friday 2026-11-20 at noon UTC.
const NOW = new Date('2026-11-20T12:00:00Z');

const day = (daysAgo, time = '10:00:00Z') => {
  const d = new Date(NOW.getTime() - daysAgo * 86400000);
  return `${d.toISOString().slice(0, 10)}T${time}`;
};

test('empty data → all zeros, seven-day strip', () => {
  const s = computeStreak([], NOW);
  assert.deepEqual(s, { current: 0, best: 0, last7: [0, 0, 0, 0, 0, 0, 0], last7Total: 0 });
});

test('consecutive days ending today → current streak counts back', () => {
  const s = computeStreak([day(0), day(1), day(2), day(4)], NOW);
  assert.equal(s.current, 3);
  assert.equal(s.best, 3);
});

test('streak survives a day with no attempt yet today', () => {
  const s = computeStreak([day(1), day(2), day(3)], NOW);
  assert.equal(s.current, 3); // streak still alive — today isn't over
});

test('a gap breaks the streak', () => {
  // Attempts 3 and 4 days ago are a closed 2-day run; only yesterday counts
  // for the current streak.
  const s = computeStreak([day(1), day(3), day(4)], NOW);
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
});

test('best streak can exceed the current streak', () => {
  const dates = [day(0), day(3), day(4), day(5), day(6), day(10)];
  const s = computeStreak(dates, NOW);
  assert.equal(s.current, 1);
  assert.equal(s.best, 4);
});

test('same-day duplicate attempts count once for the streak, twice for the strip', () => {
  const s = computeStreak([day(0, '08:00:00Z'), day(0, '20:00:00Z'), day(1)], NOW);
  assert.equal(s.current, 2);
  assert.equal(s.last7[6], 2); // today's slot in the strip
  assert.equal(s.last7Total, 3);
});

test('attempts straddling midnight land on different days', () => {
  // 23:59 yesterday + 00:01 today = 2-day streak, not 1.
  const s = computeStreak([day(1, '23:59:00Z'), day(0, '00:01:00Z')], NOW);
  assert.equal(s.current, 2);
});

test('last-7 strip counts attempts per day, oldest → today', () => {
  const s = computeStreak([day(0), day(0), day(2), day(6), day(6), day(6), day(9)], NOW);
  assert.deepEqual(s.last7, [3, 0, 0, 0, 1, 0, 2]);
  assert.equal(s.last7Total, 6);
});

test('unparseable dates are ignored', () => {
  const s = computeStreak(['not a date', null, undefined, day(0)], NOW);
  assert.equal(s.current, 1);
});
