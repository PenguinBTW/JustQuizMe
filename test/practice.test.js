import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceSpec, reveal, mark, summary, questionText, questionOptions, questionAnswer, PRACTICE_STATS } from '../public/shared/js/practice.js';

const qs = [
  { prompt: 'Q1?', options: ['a', 'b'], answer: 'a' },
  { question: 'Q2?', markScheme: ['step', 'result'] },
  { text: 'Q3?' }
];

test('practiceSpec builds hidden items, done only when empty', () => {
  const s = practiceSpec(qs);
  assert.equal(s.kind, 'practice');
  assert.equal(s.stats, 'skip');
  assert.equal(s.items.length, 3);
  assert.equal(s.done, false);
  assert.equal(practiceSpec([]).done, true);
});

test('mark before reveal is a no-op', () => {
  const s = practiceSpec(qs);
  assert.equal(mark(s, true), s);
});

test('reveal → mark advances and finishes', () => {
  let s = practiceSpec(qs);
  s = mark(reveal(s), true);
  s = mark(reveal(s), false);
  assert.equal(s.idx, 2);
  assert.equal(s.items[0].got, true);
  assert.equal(s.items[1].got, false);
  s = mark(reveal(s), true);
  assert.equal(s.done, true);
  const sum = summary(s);
  assert.deepEqual([sum.got, sum.missed, sum.total], [2, 1, 3]);
  assert.equal(sum.stats, PRACTICE_STATS, 'practice runs carry the stats-skip marker');
});

test('field guesses cover differing portal shapes', () => {
  assert.equal(questionText(qs[0]), 'Q1?');
  assert.equal(questionText(qs[1]), 'Q2?');
  assert.equal(questionText(qs[2]), 'Q3?');
  assert.deepEqual(questionOptions(qs[0]), ['a', 'b']);
  assert.equal(questionOptions(qs[1]), null);
  assert.equal(questionAnswer(qs[0]), 'a');
  assert.equal(questionAnswer(qs[1]), 'step · result');
  assert.equal(questionAnswer(qs[2]), 'No answer recorded.');
});

test('spec is immutable across transitions', () => {
  const s0 = practiceSpec(qs);
  const s1 = reveal(s0);
  assert.equal(s0.items[0].shown, false);
  assert.equal(s1.items[0].shown, true);
});
