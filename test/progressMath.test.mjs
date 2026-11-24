import test from 'node:test';
import assert from 'node:assert/strict';
import { accuracySeries, rollingAccuracy, questionStats, masteryTrend } from '../public/shared/js/progressMath.js';
import { computeMastery } from '../public/shared/js/mastery.js';

const DAY = 86400000;
const NOW = new Date('2026-01-30T12:00:00Z');
const iso = d => new Date(NOW - d * DAY).toISOString();
const resolve = s => s.topics || [];

test('accuracySeries is chronological and clamps to [0,1]', () => {
  const s = accuracySeries([
    { date: iso(0), score: 8, total: 10 },
    { date: iso(5), score: 15, total: 10 },
    { date: iso(2), score: -3, total: 10 }
  ]);
  assert.equal(s.length, 3);
  assert.ok(s[0].t < s[1].t && s[1].t < s[2].t);
  assert.equal(s[0].pct, 1);   // clamped over-100%
  assert.equal(s[1].pct, 0);   // clamped negative
  assert.ok(Math.abs(s[2].pct - 0.8) < 1e-9);
});

test('accuracySeries skips malformed entries without throwing', () => {
  const s = accuracySeries([
    { date: 'garbage', score: 1, total: 2 },
    { score: 1, total: 2 },
    { date: iso(0), score: 5, total: 0 },
    null,
    { date: iso(0), score: 1, total: 2 }
  ]);
  assert.equal(s.length, 1);
});

test('rollingAccuracy smooths with the trailing window', () => {
  const series = [
    { t: new Date(iso(3)), pct: 0 },
    { t: new Date(iso(2)), pct: 1 },
    { t: new Date(iso(1)), pct: 0 },
    { t: new Date(iso(0)), pct: 1 }
  ];
  const r = rollingAccuracy(series, 3);
  assert.equal(r[0].pct, 0);
  assert.ok(Math.abs(r[2].pct - 1 / 3) < 1e-9);
  assert.ok(Math.abs(r[3].pct - 2 / 3) < 1e-9);
});

test('questionStats counts per-question records and flags legacy runs', () => {
  const q = questionStats([
    { perQuestion: [{ attempted: true }, { attempted: false }, { attempted: true }] },
    { score: 5, total: 10 }
  ]);
  assert.equal(q.recorded, 3);
  assert.equal(q.attempted, 2);
  assert.equal(q.legacyRuns, 1);
  assert.equal(q.exact, false);
  assert.equal(questionStats([]).exact, true);
});

test('masteryTrend yields weekly snapshots, null before any history', () => {
  const scores = [{ date: iso(3), score: 8, total: 10, topics: ['Logic'] }];
  const t = masteryTrend(scores, resolve, computeMastery, 4, NOW);
  assert.equal(t.length, 4);
  assert.equal(t[0].mastery, null);          // 3 weeks ago — no entries yet
  assert.equal(t[1].mastery, null);          // 2 weeks ago — entry is 3 days old
  assert.ok(Math.abs(t[3].mastery - 0.8) < 1e-9);  // this week — 80%
});
