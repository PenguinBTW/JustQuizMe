import test from 'node:test';
import assert from 'node:assert/strict';
import { cardFromQuestion, deckFromQuestions, orderDeckByMastery } from '../public/shared/js/flashcards.js';

test('mcq card: stem front, correct option back', () => {
  const c = cardFromQuestion({ type: 'multiple-choice', prompt: 'What?', options: ['A', 'B'], correctIndex: 1, marks: 1, topic: 'T' });
  assert.equal(c.front, 'What?\nA. A\nB. B');
  assert.equal(c.back, 'B');
  assert.equal(c.marks, 1);
});

test('written card: mark scheme bullet points', () => {
  const c = cardFromQuestion({ type: 'written', prompt: 'Explain X', markScheme: ['point one', 'point two'], marks: 4 });
  assert.equal(c.back, '• point one\n• point two');
});

test('unsuitable types and empty schemes produce no card', () => {
  assert.equal(cardFromQuestion({ type: 'code-requirement', prompt: 'Write code' }), null);
  assert.equal(cardFromQuestion({ type: 'lmc', prompt: 'LMC' }), null);
  assert.equal(cardFromQuestion({ type: 'written', prompt: 'X', markScheme: [] }), null);
  assert.equal(cardFromQuestion({ type: 'multiple-choice', prompt: 'X', options: [], correctIndex: 0 }), null);
  assert.equal(cardFromQuestion(null), null);
  assert.equal(cardFromQuestion({ type: 'written', markScheme: ['x'] }), null); // no prompt
});

test('deckFromQuestions filters unsuitable', () => {
  const deck = deckFromQuestions([
    { type: 'multiple-choice', prompt: 'Q1', options: ['a'], correctIndex: 0 },
    { type: 'lmc', prompt: 'Q2' },
    { type: 'written', prompt: 'Q3', markScheme: ['x'] },
  ]);
  assert.equal(deck.length, 2);
});

test('mastery ordering: weak first, unpracticed middle, strong last; stable within bands', () => {
  const cards = [
    { front: 'strong1', topic: 'Strong' },
    { front: 'weak1', topic: 'Weak' },
    { front: 'new1', topic: 'New' },
    { front: 'weak2', topic: 'Weak' },
  ];
  const rows = [
    { topic: 'Strong', mastery: 0.9, weak: false },
    { topic: 'Weak', mastery: 0.3, weak: true },
  ];
  const ordered = orderDeckByMastery(cards, rows);
  assert.deepEqual(ordered.map(c => c.front), ['weak1', 'weak2', 'new1', 'strong1']);
});

test('ordering with no mastery data preserves input order', () => {
  const cards = [{ front: 'a', topic: 'X' }, { front: 'b', topic: 'Y' }];
  assert.deepEqual(orderDeckByMastery(cards, []).map(c => c.front), ['a', 'b']);
});
