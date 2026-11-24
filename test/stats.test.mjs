import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
// shared/js/stats.js is a .js ESM file (browser module): Node treats .js as
// CJS and chokes on `export`, so load it via a data: URL like the other tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../public/shared/js/stats.js'), 'utf8');
const { topicsFor, groupByTopic, weakestTopic, streakDays, sparklinePoints, recentPcts } =
  await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));

const run = (over = {}) => ({ score: 6, total: 10, date: '2026-11-20T10:00:00Z', ...over });

describe('topicsFor', () => {
  test('prefers entry.topics, then uuid index, then title prefix', () => {
    assert.deepEqual(topicsFor(run({ topics: ['Algebra'] })), ['Algebra']);
    assert.deepEqual(topicsFor(run({ quizUuid: 'u1' }), { u1: ['Calculus'] }), ['Calculus']);
    assert.deepEqual(topicsFor(run({ quizTitle: 'Mechanics · 10-mark quiz' })), ['Mechanics']);
    assert.deepEqual(topicsFor(run({ quizTitle: 'Mixed · custom paper' })), ['Mixed practice']);
    assert.deepEqual(topicsFor(run({})), ['Mixed practice']);
  });
  test('malformed saved topics never throw or leak junk', () => {
    assert.deepEqual(topicsFor(run({ topics: [null, { bad: 1 }, ' Algebra '] })), ['Algebra']);
    assert.deepEqual(topicsFor(run({ topics: [null, undefined, {}] })), ['Mixed practice']);
    const long = 'x'.repeat(500);
    // Full name kept — truncating for identity would merge distinct topics.
    assert.equal(topicsFor(run({ topics: [long] }))[0], long);
    assert.deepEqual(topicsFor(run({ quizUuid: '__proto__' }), {}), ['Mixed practice']);
  });
});

describe('groupByTopic', () => {
  test('attributes a multi-topic run fully to each topic', () => {
    const g = groupByTopic([run({ topics: ['A', 'B'], score: 3, total: 10 })]);
    assert.equal(g.length, 2);
    assert.equal(g[0].attempted, 10);
    assert.equal(g[0].correct, 3);
    assert.equal(g[0].pct, 30);
  });
  test('sums across runs and orders by attempted', () => {
    const g = groupByTopic([
      run({ topics: ['Stats'], score: 8, total: 10 }),
      run({ topics: ['Stats'], score: 4, total: 10 }),
      run({ topics: ['Trig'], score: 5, total: 5 }),
    ]);
    assert.equal(g[0].topic, 'Stats');
    assert.equal(g[0].pct, 60);
    assert.equal(g[1].pct, 100);
  });
});

describe('weakestTopic', () => {
  test('lowest pct wins; honours min attempts', () => {
    const g = [
      { topic: 'A', correct: 1, attempted: 10, pct: 10, runs: 1 },
      { topic: 'B', correct: 9, attempted: 10, pct: 90, runs: 1 },
    ];
    assert.equal(weakestTopic(g).topic, 'A');
    assert.equal(weakestTopic([{ topic: 'X', correct: 0, attempted: 0, pct: 0, runs: 0 }]), null);
  });
});

describe('streakDays', () => {
  const at = (y, mo, d, h = 12) => new Date(y, mo - 1, d, h);
  const now = at(2026, 11, 24);
  test('today-only is a 1-day streak', () => {
    assert.equal(streakDays([at(2026, 11, 24)], now), 1);
  });
  test('a gap day resets the streak', () => {
    assert.equal(streakDays([at(2026, 11, 20), at(2026, 11, 21), at(2026, 11, 23), at(2026, 11, 24)], now), 2);
  });
  test('multiple runs on the same day count once', () => {
    assert.equal(streakDays([at(2026, 11, 23, 9), at(2026, 11, 23, 20), at(2026, 11, 24)], now), 2);
  });
  test('yesterday anchors when today has no run', () => {
    assert.equal(streakDays([at(2026, 11, 22), at(2026, 11, 23)], now), 2);
    assert.equal(streakDays([at(2026, 11, 21)], now), 0);
  });
  test('invalid dates are ignored', () => {
    assert.equal(streakDays(['not-a-date', at(2026, 11, 24)], now), 1);
  });
});

describe('sparklinePoints + recentPcts', () => {
  test('empty input gives an empty polyline', () => {
    assert.equal(sparklinePoints([], { w: 120, h: 28 }), '');
  });
  test('keeps last n and stays inside bounds', () => {
    const pcts = Array.from({ length: 20 }, (_, i) => i * 5);
    const pts = sparklinePoints(pcts, { w: 120, h: 28, pad: 2, n: 14 }).split(' ');
    assert.equal(pts.length, 14);
    for (const p of pts) {
      const [x, y] = p.split(',').map(Number);
      assert.ok(x >= 2 && x <= 118 && y >= 2 && y <= 26);
    }
    assert.deepEqual(recentPcts([run({ score: 5, total: 10 }), run({ score: 9, total: 10, date: '2026-11-21' })]), [50, 90]);
  });
  test('malformed dates sort to the front without throwing', () => {
    const runs = [
      run({ score: 8, total: 10, date: '2026-11-21' }),
      run({ score: 2, total: 10, date: 'not-a-date' }),
      run({ score: 6, total: 10, date: '2026-11-23' }),
    ];
    assert.deepEqual(recentPcts(runs), [20, 80, 60]);
    // at the cutoff the undated run is the one dropped
    assert.deepEqual(recentPcts(runs, 2), [80, 60]);
  });
});

test('groupByTopic per-question attribution: marks split across topics, run counted once per topic', () => {
  // A repeats twice in one paper — marks must sum and the run count stays 1
  const entries = [{
    quizUuid: 'q1', score: 8, total: 15,
    perQuestion: [
      { topic: 'A', score: 4, marks: 5 },
      { topic: 'A', score: 3, marks: 5 },
      { topic: 'B', score: 4, marks: 5 },
    ],
  }];
  const g = groupByTopic(entries, () => null);
  const a = g.find(x => x.topic === 'A');
  const b = g.find(x => x.topic === 'B');
  if (!a || !b) throw new Error('topics missing');
  if (a.correct !== 7 || a.attempted !== 10) throw new Error('repeated-topic marks not summed: ' + JSON.stringify(a));
  if (b.correct !== 4 || b.attempted !== 5) throw new Error('per-question marks not used: ' + JSON.stringify(b));
  if (a.runs !== 1 || b.runs !== 1) throw new Error('run should count once per topic');
});
