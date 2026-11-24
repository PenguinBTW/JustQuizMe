// node --test for the daily-question pure lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dailySeed, pickDailyId, dailyKey, loadDaily, saveDaily, recordDay,
  recordFor, isTodayDone, todayStr, dailyStreak
} from '../public/shared/js/daily.js';

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

const IDS = ['p1.q3', 'p1.q1', 'p2.q10', 'p1.q2', 'p2.q1'];

test('same day → same pick regardless of id order', () => {
  const a = pickDailyId(IDS, '2026-11-24');
  const b = pickDailyId([...IDS].reverse(), '2026-11-24');
  const c = pickDailyId(['p1.q2', 'p2.q1', 'p1.q1', 'p2.q10', 'p1.q3'], '2026-11-24');
  assert.equal(a, b);
  assert.equal(a, c);
  assert.ok(IDS.includes(a));
});

test('different days pick different questions across a bank (or degrade gracefully)', () => {
  const picks = new Set();
  for (let d = 1; d <= 30; d++) picks.add(pickDailyId(IDS, `2026-11-${String(d).padStart(2, '0')}`));
  assert.ok(picks.size > 1, 'a month should not pick one question every day');
  // degenerate bank: single question always returns it
  assert.equal(pickDailyId(['only.q'], '2026-11-24'), 'only.q');
  assert.equal(pickDailyId([], '2026-11-24'), null);
});

test('seed is stable and unsigned', () => {
  assert.equal(dailySeed('2026-11-24'), dailySeed('2026-11-24'));
  assert.ok(dailySeed('x') >= 0);
});

test('record round-trip + per-portal namespace', () => {
  const store = memStore();
  assert.equal(dailyKey('cs'), 'jqm.daily.v1.cs');
  recordDay(store, 'cs', '2026-11-24', 'p1.q1', true);
  const rec = loadDaily(store, 'cs');
  assert.deepEqual(recordFor(rec, '2026-11-24'), { date: '2026-11-24', questionId: 'p1.q1', got: true });
  assert.ok(isTodayDone(rec, '2026-11-24'));
  // another portal's namespace is untouched
  assert.deepEqual(loadDaily(store, 'maths'), { days: {} });
  // malformed storage degrades to empty
  store.setItem(dailyKey('physics'), '{oops');
  assert.deepEqual(loadDaily(store, 'physics'), { days: {} });
});

test('streak counts consecutive answered days, tolerating an open today', () => {
  const store = memStore();
  recordDay(store, 'cs', '2026-11-21', 'a', true);
  recordDay(store, 'cs', '2026-11-22', 'b', false); // missed still counts as answered
  recordDay(store, 'cs', '2026-11-23', 'c', true);
  assert.equal(dailyStreak(loadDaily(store, 'cs'), '2026-11-24'), 3); // today open → counts through yesterday
  recordDay(store, 'cs', '2026-11-24', 'd', true);
  assert.equal(dailyStreak(loadDaily(store, 'cs'), '2026-11-24'), 4);
  // gap resets
  const s2 = memStore();
  recordDay(s2, 'cs', '2026-11-20', 'a', true);
  recordDay(s2, 'cs', '2026-11-23', 'b', true);
  assert.equal(dailyStreak(loadDaily(s2, 'cs'), '2026-11-23'), 1);
});

test('todayStr formats local date', () => {
  assert.equal(todayStr(new Date(2026, 10, 24, 9, 30)), '2026-11-24');
});
