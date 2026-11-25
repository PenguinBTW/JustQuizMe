import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTerms, matchQuiz, countLabel, emptyMessage } from '../public/shared/js/quizSearch.js';

test('parseTerms: trims, lowercases, splits on whitespace', () => {
  assert.deepEqual(parseTerms('  Pure  Integration '), ['pure', 'integration']);
  assert.deepEqual(parseTerms(''), []);
  assert.deepEqual(parseTerms('   '), []);
  assert.deepEqual(parseTerms(null), []);
});

test('matchQuiz: case-insensitive substring on title+topic haystack', () => {
  assert.ok(matchQuiz('Binomial Expansion Pure Mathematics', ['binomial']));
  assert.ok(matchQuiz('Binomial Expansion Pure Mathematics', ['PURE', 'expan']));
  assert.ok(!matchQuiz('Binomial Expansion Pure Mathematics', ['trig']));
  assert.ok(matchQuiz('anything', []));
});

test('matchQuiz: multi-word AND — every term must appear', () => {
  assert.ok(matchQuiz('Stats Hypothesis Testing Applied Statistics', ['stats', 'hypothesis']));
  assert.ok(!matchQuiz('Stats Hypothesis Testing Applied Statistics', ['stats', 'mechanics']));
});

test('countLabel', () => {
  assert.equal(countLabel(3, 12), '3 of 12 quizzes');
  assert.equal(countLabel(0, 12), '0 of 12 quizzes');
});

test('emptyMessage: only when a query is active', () => {
  assert.equal(emptyMessage(['x']), 'No quizzes match your search.');
  assert.equal(emptyMessage([]), '');
});
