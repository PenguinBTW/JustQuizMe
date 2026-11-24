import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lastNDays,
  dailyRuns,
  runsInWindow,
  accuracy,
  weeklySummary,
} from '../public/shared/js/weeklyStats.js';

// Tests pin "now" so day buckets are deterministic.
const NOW = new Date('2026-11-24T15:30:00');
const day = (offset) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offset);
  return d.toISOString();
};

test('lastNDays returns n keys ending today, oldest first', () => {
  const keys = lastNDays(7, NOW);
  assert.equal(keys.length, 7);
  assert.equal(keys[keys.length - 1], '2026-11-24');
  assert.equal(keys[0], '2026-11-18');
});

test('lastNDays rolls across month boundaries', () => {
  const keys = lastNDays(3, new Date('2026-11-01T10:00:00'));
  assert.deepEqual(keys, ['2026-10-30', '2026-10-31', '2026-11-01']);
});

test('dailyRuns buckets per day and ignores garbage dates', () => {
  const days = lastNDays(7, NOW);
  const scores = [
    { date: day(0) }, { date: day(0) }, { date: day(3) },
    { date: 'not-a-date' }, { date: null }, {},
  ];
  assert.deepEqual(dailyRuns(scores, days), [0, 0, 0, 1, 0, 0, 2]);
});

test('runsInWindow keeps only entries inside the window', () => {
  const days = lastNDays(7, NOW);
  const scores = [{ date: day(0) }, { date: day(6) }, { date: day(7) }, { date: day(30) }];
  assert.equal(runsInWindow(scores, days).length, 2);
});

test('accuracy aggregates score/total with a rounded pct', () => {
  const a = accuracy([{ score: 3, total: 4 }, { score: 7, total: 10 }, { score: 0, total: 5 }]);
  assert.deepEqual(a, { correct: 10, attempted: 19, pct: 52.6 });
  assert.deepEqual(accuracy([]), { correct: 0, attempted: 0, pct: 0 });
});

test('weeklySummary totals, per-portal rows, and streak leader', () => {
  const portals = [
    { id: 'cs', scores: [{ date: day(0), score: 4, total: 5 }, { date: day(1), score: 3, total: 5 }] },
    { id: 'maths', scores: [{ date: day(0), score: 8, total: 10 }, { date: day(2), score: 2, total: 5 }, { date: day(1), score: 5, total: 5 }] },
    { id: 'physics', scores: [{ date: day(40), score: 5, total: 5 }] },
  ];
  const s = weeklySummary(portals, { now: NOW });
  assert.equal(s.runs, 5);                    // physics run is outside the week
  assert.equal(s.correct, 22);
  assert.equal(s.attempted, 30);
  assert.equal(s.pct, 73.3);
  assert.deepEqual(s.daily, [0, 0, 0, 0, 1, 2, 2]);
  assert.equal(s.portals.length, 3);
  const cs = s.portals.find(p => p.id === 'cs');
  assert.equal(cs.runs, 2);
  assert.equal(cs.pct, 70);
  assert.equal(cs.streak, 2);
  const maths = s.portals.find(p => p.id === 'maths');
  assert.equal(maths.streak, 3);              // ran each of the last 3 days
});

test('weeklySummary picks the streak leader across portals', () => {
  const portals = [
    { id: 'cs', scores: [{ date: day(0) }, { date: day(1) }, { date: day(2) }] },
    { id: 'maths', scores: [{ date: day(0) }] },
  ];
  const s = weeklySummary(portals, { now: NOW });
  assert.deepEqual(s.streakLeader, { id: 'cs', streak: 3 });
});

test('weeklySummary emits a 7-point sparkline scaled to the week peak', () => {
  const portals = [{ id: 'cs', scores: [{ date: day(0) }, { date: day(0) }, { date: day(6) }] }];
  const s = weeklySummary(portals, { now: NOW });
  const pts = s.spark.trim().split(/\s+/);
  assert.equal(pts.length, 7);
});

test('weeklySummary is safe on empty and malformed input', () => {
  const s = weeklySummary([], { now: NOW });
  assert.equal(s.runs, 0);
  assert.equal(s.streakLeader, null);
  assert.deepEqual(s.daily, [0, 0, 0, 0, 0, 0, 0]);
  assert.doesNotThrow(() => weeklySummary([{ id: 'x', scores: [{ date: 'junk' }, null, {}] }], { now: NOW }));
});
