import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { topicCoverage, shares, rowHtml, coverageHtml } from '../public/shared/js/topicCoverage.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TOPICS = ['Waves', 'Mechanics'];
const QUIZZES = [
  { uuid: 'q1', topics: ['Waves'], questionCount: 10 },
  { uuid: 'q2', topics: ['Waves', 'Mechanics'], questionCount: 20 },
  { uuid: 'q3', topics: ['Mechanics'], questionCount: 5 },
];
const S = (uuid, score, total) => ({ quizUuid: uuid, score, total });

describe('topicCoverage', () => {
  it('empty scores → zeroed rows, banked counts only', () => {
    const rows = topicCoverage([], QUIZZES, TOPICS);
    assert.equal(rows.length, 2);
    assert.equal(rows.find(r => r.topic === 'Waves').banked, 30);
    assert.equal(rows.find(r => r.topic === 'Mechanics').banked, 25);
    assert.ok(rows.every(r => r.attempted === 0 && r.accuracy === null));
  });

  it('buckets attempts into correct/partial/incorrect per topic', () => {
    const rows = topicCoverage([
      S('q1', 9, 10),   // 90% correct → Waves
      S('q2', 10, 20),  // 50% partial → Waves + Mechanics
      S('q3', 1, 10),   // 10% incorrect → Mechanics
      S('nope', 5, 5),  // unknown quiz ignored
    ], QUIZZES, TOPICS);
    const waves = rows.find(r => r.topic === 'Waves');
    const mech = rows.find(r => r.topic === 'Mechanics');
    assert.deepEqual([waves.correct, waves.partial, waves.incorrect], [1, 1, 0]);
    assert.deepEqual([mech.correct, mech.partial, mech.incorrect], [0, 1, 1]);
    assert.equal(waves.attempted, 2);
  });

  it('sorts weakest-accuracy-first, unattempted last', () => {
    const rows = topicCoverage([S('q1', 9, 10), S('q3', 2, 10)], QUIZZES, ['Waves', 'Mechanics', 'Fields']);
    assert.equal(rows[0].topic, 'Mechanics');   // 20%
    assert.equal(rows[1].topic, 'Waves');       // 90%
    assert.equal(rows[2].topic, 'Fields');      // never attempted
  });

  it('scores with zero total count as incorrect (pct 0)', () => {
    const rows = topicCoverage([S('q1', 0, 0)], QUIZZES, TOPICS);
    assert.equal(rows.find(r => r.topic === 'Waves').incorrect, 1);
  });
});

describe('shares/rowHtml/coverageHtml', () => {
  it('shares sum to 100 and zero-fill when empty', () => {
    assert.deepEqual(shares({ correct: 2, partial: 1, incorrect: 1 }), [50, 25, 25]);
    assert.deepEqual(shares({ correct: 0, partial: 0, incorrect: 0 }), [0, 0, 0]);
  });
  it('rowHtml escapes the topic name and renders widths', () => {
    const html = rowHtml({ topic: 'A <b>', banked: 10, attempted: 4, correct: 2, partial: 1, incorrect: 1, accuracy: 0.5 }, esc);
    assert.match(html, /A &lt;b&gt;/);
    assert.match(html, /width:50%/);
    assert.match(html, /4\/10/);
  });
  it('coverageHtml shows the empty state only when nothing attempted', () => {
    assert.match(coverageHtml(topicCoverage([], QUIZZES, TOPICS), esc), /No scored attempts/);
    assert.match(coverageHtml(topicCoverage([S('q1', 5, 10)], QUIZZES, TOPICS), esc), /coverage-row/);
  });
});
