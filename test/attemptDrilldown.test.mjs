import test from 'node:test';
import assert from 'node:assert';
import { filterAttempts, compareAttempts, drilldownHtml } from '../public/shared/js/attemptDrilldown.js';

const mk = (over = {}) => ({
  quizUuid: 'q1', quizTitle: 'Paper A', score: 8, total: 10, date: '2026-11-01T10:00:00Z', minutes: 30, ...over,
});

test('filterAttempts: mode, topic, search, date range', () => {
  const list = [
    mk({ exam: true, topics: ['Logic'] }),
    mk({ quizUuid: 'q2', exam: false, topics: ['Data structures'], quizTitle: 'Trees quiz', date: '2026-11-10T10:00:00Z' }),
    mk({ quizUuid: 'q3', flashcard: true, type: 'flashcards', topics: ['Logic'], date: '2026-11-20T10:00:00Z' }),
  ];
  assert.equal(filterAttempts(list, { mode: 'exam' }).length, 1);
  assert.equal(filterAttempts(list, { mode: 'flashcards' }).length, 1);
  assert.equal(filterAttempts(list, { topic: 'logic' }).length, 2);
  assert.equal(filterAttempts(list, { search: 'trees' }).length, 1);
  assert.equal(filterAttempts(list, { from: '2026-11-05', to: '2026-11-15' }).length, 1);
});

test('compareAttempts: per-topic deltas newest vs previous, null without repeats', () => {
  const base = {
    quizUuid: 'q1', score: 5, total: 10, date: '2026-11-01T10:00:00Z',
    perQuestion: [{ topic: 'A', score: 3, marks: 5, attempted: true }, { topic: 'B', score: 2, marks: 5, attempted: true }],
  };
  const second = {
    quizUuid: 'q1', score: 8, total: 10, date: '2026-11-08T10:00:00Z',
    perQuestion: [{ topic: 'A', score: 5, marks: 5, attempted: true }, { topic: 'B', score: 3, marks: 5, attempted: true }],
  };
  const cmp = compareAttempts([base, second], 'q1');
  assert.ok(cmp);
  const a = cmp.deltas.find(d => d.topic === 'A');
  assert.ok(Math.abs(a.delta - 0.4) < 1e-9);
  assert.ok(cmp.totalDelta > 0);
  assert.equal(compareAttempts([base], 'q1'), null);
});

test('drilldownHtml: per-question rows when recorded, honest legacy label when not', () => {
  const withPq = mk({ perQuestion: [{ topic: 'A', subtopic: 'Gates', type: 'multiple-choice', score: 1, marks: 1, attempted: true }] });
  const html = drilldownHtml(withPq);
  assert.match(html, /Gates/);
  assert.match(html, /1\/1/);
  const legacy = drilldownHtml(mk({ topics: ['Logic'] }));
  assert.match(legacy, /summary-only record/);
});

test('compareAttempts does not compare synthesized mocks that share a uuid but differ in content', async () => {
  const { compareAttempts } = await import('../public/shared/js/attemptDrilldown.js');
  const mk = (ids, date, score) => ({
    quizUuid: 'mixed', quizFile: null, date, score, total: 10,
    perQuestion: ids.map(id => ({ id, topic: 'T', marks: 5, score: id === 'a' ? score : 0 })),
  });
  // same uuid, different questions → not retakes
  const mixed = [mk(['a', 'b'], '2024-01-01', 5), mk(['c', 'd'], '2024-01-02', 8)];
  assert.equal(compareAttempts(mixed, 'mixed', '2024-01-02'), null);
  // same uuid, same questions → comparable retakes
  const same = [mk(['a', 'b'], '2024-01-01', 5), mk(['a', 'b'], '2024-01-02', 8)];
  assert.ok(compareAttempts(same, 'mixed', '2024-01-02'));
});

test('same bare ids from different bank contexts do not compare as retakes', async () => {
  const { compareAttempts } = await import('../public/shared/js/attemptDrilldown.js');
  const mk = (topic, date, score) => ({
    quizUuid: 'mixed', quizFile: null, date, score, total: 10,
    perQuestion: [{ id: 'q1', topic, marks: 5, score }],
  });
  const runs = [mk('Algebra', '2024-01-01', 3), mk('Statistics', '2024-01-02', 5)];
  assert.equal(compareAttempts(runs, 'mixed', '2024-01-02'), null);
  const same = [mk('Algebra', '2024-01-01', 3), mk('Algebra', '2024-01-02', 5)];
  assert.ok(compareAttempts(same, 'mixed', '2024-01-02'));
});
