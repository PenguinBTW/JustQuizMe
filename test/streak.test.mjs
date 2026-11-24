import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakModel, toStreakText } from '../public/shared/js/streak.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();
const NOW = new Date(2026, 10, 24, 15, 0); // Tue Nov 24 2026, 3pm local

test('same-day dupes count once', () => {
  const m = streakModel([D(2026, 11, 24, 9), D(2026, 11, 24, 21), D(2026, 11, 23)], NOW);
  assert.equal(m.current, 2);
  assert.equal(m.best, 2);
  assert.equal(m.lastDay, '2026-11-24');
});

test('midnight straddle keeps the streak alive', () => {
  const m = streakModel([D(2026, 11, 23, 23), D(2026, 11, 24, 1)], NOW);
  assert.equal(m.current, 2);
});

test('gap before yesterday resets current but best survives', () => {
  const m = streakModel([D(2026, 11, 20), D(2026, 11, 21), D(2026, 11, 22), D(2026, 11, 24)], NOW);
  assert.equal(m.current, 1);
  assert.equal(m.best, 3);
});

test('today-pending: no run today does not break the streak', () => {
  const m = streakModel([D(2026, 11, 22), D(2026, 11, 23)], NOW);
  assert.equal(m.current, 2);
  assert.equal(m.lastDay, '2026-11-23');
});

test('yesterday-with-no-run breaks it', () => {
  const m = streakModel([D(2026, 11, 21), D(2026, 11, 22)], NOW);
  assert.equal(m.current, 0);
  assert.equal(m.best, 2);
});

test('empty and malformed input is safe', () => {
  assert.deepEqual(streakModel([], NOW), { current: 0, best: 0, lastDay: null });
  assert.deepEqual(streakModel([null, 'not-a-date', {}], NOW).current, 0);
});

test('object entries with date fields are read', () => {
  const m = streakModel([{ date: D(2026, 11, 23) }, { date: D(2026, 11, 24) }], NOW);
  assert.equal(m.current, 2);
});

test('consecutive calendar days across a DST shift stay consecutive', () => {
  // US spring-forward 2026-03-08: local midnights are 23h apart.
  // Run with TZ=America/New_York to exercise the 23-hour day.
  const days = [D(2026, 3, 6), D(2026, 3, 7), D(2026, 3, 8), D(2026, 3, 9), D(2026, 3, 10)];
  const m = streakModel(days, new Date(2026, 2, 10, 15, 0));
  assert.equal(m.best, 5);
  assert.equal(m.current, 5);
});

test('toStreakText renders copy only when alive', () => {
  assert.equal(toStreakText({ current: 3 }), '3-day streak');
  assert.equal(toStreakText({ current: 1 }), '1-day streak');
  assert.equal(toStreakText({ current: 0 }), '');
  assert.equal(toStreakText(null), '');
});
