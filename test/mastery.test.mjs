import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMastery, weakestTopics, HALF_LIFE_DAYS, WEAK_THRESHOLD } from '../public/shared/js/mastery.js';

const DAY = 86400000;
const NOW = new Date('2026-01-30T12:00:00Z');
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const resolve = (s) => s.topics || [];

test('empty history yields no mastery rows', () => {
  assert.deepEqual(computeMastery([], resolve), []);
  assert.deepEqual(computeMastery(null, resolve), []);
});

test('single run yields mastery equal to its percentage', () => {
  const rows = computeMastery([{ date: iso(0), score: 6, total: 10, topics: ['Logic'] }], resolve, NOW);
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].mastery - 0.6) < 1e-9);
  assert.equal(rows[0].runs, 1);
  assert.equal(rows[0].daysSince, 0);
});

test('recent runs dominate older ones', () => {
  // old run at 100%, yesterday's run at 0% — mastery must sit well below 50%
  const rows = computeMastery([
    { date: iso(28), score: 10, total: 10, topics: ['Logic'] },
    { date: iso(1), score: 0, total: 10, topics: ['Logic'] }
  ], resolve, NOW);
  const wOld = Math.pow(0.5, 28 / HALF_LIFE_DAYS);
  const wNew = Math.pow(0.5, 1 / HALF_LIFE_DAYS);
  const expected = (wOld * 1 + wNew * 0) / (wOld + wNew);
  assert.ok(Math.abs(rows[0].mastery - expected) < 1e-9);
  assert.ok(rows[0].mastery < 0.3, `expected ${rows[0].mastery} < 0.3`);
});

test('a topic untouched for a long time decays but does not vanish', () => {
  const rows = computeMastery([{ date: iso(56), score: 9, total: 10, topics: ['Logic'] }], resolve, NOW);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].mastery > 0.85); // single run — mean unaffected by decay
  assert.equal(rows[0].daysSince, 56);
});

test('mixed-paper run attributes its percentage to every covered topic', () => {
  const rows = computeMastery([{ date: iso(0), score: 4, total: 10, topics: ['Logic', 'Data structures'] }], resolve, NOW);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => Math.abs(r.mastery - 0.4) < 1e-9));
});

test('weak flag follows the threshold', () => {
  const rows = computeMastery([
    { date: iso(0), score: 5, total: 10, topics: ['Weak topic'] },
    { date: iso(0), score: 9, total: 10, topics: ['Strong topic'] }
  ], resolve, NOW);
  const weak = rows.find(r => r.topic === 'Weak topic');
  const strong = rows.find(r => r.topic === 'Strong topic');
  assert.equal(weak.weak, true);
  assert.equal(strong.weak, false);
  assert.equal(rows[0].topic, 'Weak topic'); // weakest first
});

test('malformed entries are skipped, never throw', () => {
  const rows = computeMastery([
    { date: 'not-a-date', score: 5, total: 10, topics: ['X'] },
    { date: iso(0), score: 5, total: 0, topics: ['X'] },       // zero total
    { score: 5, total: 10, topics: ['X'] },                     // no date
    null, undefined,
    { date: iso(0), score: 7, total: 10, topics: ['X'] }
  ], resolve, NOW);
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].mastery - 0.7) < 1e-9);
});

test('clamps out-of-range scores', () => {
  const rows = computeMastery([{ date: iso(0), score: 50, total: 10, topics: ['X'] }], resolve, NOW);
  assert.equal(rows[0].mastery, 1);
});

test('weakestTopics prefers weak practiced topics, then unpracticed catalogue topics', () => {
  const rows = computeMastery([
    { date: iso(0), score: 3, total: 10, topics: ['Weak'] },
    { date: iso(0), score: 9, total: 10, topics: ['Strong'] }
  ], resolve, NOW);
  const picks = weakestTopics(rows, ['Weak', 'Strong', 'Never tried'], 3);
  assert.equal(picks[0].topic, 'Weak');
  assert.equal(picks[1].topic, 'Never tried');
  assert.equal(picks[1].unpracticed, true);
  assert.equal(picks[2].topic, 'Strong');
});

test('weakestTopics with no history returns unpracticed catalogue topics, not zeros', () => {
  const picks = weakestTopics([], ['A', 'B', 'C'], 2);
  assert.equal(picks.length, 2);
  assert.ok(picks.every(p => p.unpracticed && p.mastery === null));
});

// --- per-question data path ---

test('per-question outcomes attribute marks to their own topics, not the whole paper', () => {
  // a mixed paper: 8/8 on Logic, 0/2 on Algorithms — aggregate would smear 80% over both
  const rows = computeMastery([{
    date: iso(0), score: 8, total: 10, topics: ['Logic', 'Algorithms'],
    perQuestion: [
      { id: 'q1', topic: 'Logic', score: 8, marks: 8, attempted: true },
      { id: 'q2', topic: 'Algorithms', score: 0, marks: 2, attempted: false }
    ]
  }], resolve, NOW);
  const logic = rows.find(r => r.topic === 'Logic');
  const algo = rows.find(r => r.topic === 'Algorithms');
  assert.ok(Math.abs(logic.mastery - 1) < 1e-9, `logic ${logic.mastery}`);
  assert.equal(algo.mastery, 0);
  assert.equal(algo.weak, true);
});

test('marks-weighting: heavy questions shape mastery more than light ones', () => {
  const rows = computeMastery([{
    date: iso(0), score: 1, total: 11, topics: ['Logic'],
    perQuestion: [
      { id: 'q1', topic: 'Logic', score: 1, marks: 1, attempted: true },   // tiny MCQ correct
      { id: 'q2', topic: 'Logic', score: 0, marks: 10, attempted: true }   // big question failed
    ]
  }], resolve, NOW);
  assert.ok(Math.abs(rows[0].mastery - 1 / 11) < 1e-9);
});

test('legacy entries without perQuestion still use aggregate attribution (backward compat)', () => {
  const rows = computeMastery([
    { date: iso(0), score: 4, total: 10, topics: ['Logic', 'Data'] }  // no perQuestion
  ], resolve, NOW);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => Math.abs(r.mastery - 0.4) < 1e-9));
});

test('mixed legacy + per-question history combines without throwing', () => {
  const rows = computeMastery([
    { date: iso(1), score: 10, total: 10, topics: ['Logic'] },  // legacy: 100%
    { date: iso(0), score: 0, total: 10, topics: ['Logic'],     // per-question: 0%
      perQuestion: [{ id: 'q', topic: 'Logic', score: 0, marks: 10, attempted: true }] }
  ], resolve, NOW);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].mastery > 0 && rows[0].mastery < 0.5, `mastery ${rows[0].mastery}`);
  assert.equal(rows[0].runs, 2);
});

test('per-question entries with missing/zero marks are skipped safely', () => {
  const rows = computeMastery([{
    date: iso(0), score: 5, total: 5, topics: ['Logic'],
    perQuestion: [
      { id: 'q1', topic: 'Logic', score: 5, marks: 0, attempted: true },   // zero marks
      { id: 'q2', topic: null, score: 3, marks: 3, attempted: true },      // no topic
      { topic: 'Logic', score: 5, marks: 5, attempted: true }
    ]
  }], resolve, NOW);
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].mastery - 1) < 1e-9);
});
