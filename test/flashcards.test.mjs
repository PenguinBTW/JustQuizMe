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

test('buildSmartDeck: not-yet-due weak card outranks overdue strong card; most-overdue first within band', async () => {
  // shim browser globals for cardSchedule's localStorage/location access
  const store = {};
  globalThis.localStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  globalThis.location = { pathname: '/cs/' };
  const NOW = Date.now();
  // strong-topic card overdue since yesterday; weak-topic card due tomorrow
  store['jqm-card-schedule-v1'] = JSON.stringify({
    'cs:strong-card': { interval: 2, due: NOW - 86400000, reps: 3 },
    'cs:weak-card': { interval: 4, due: NOW + 86400000, reps: 2 },
  });
  const { buildSmartDeck } = await import('../public/shared/js/flashcardSession.js');
  const questions = [
    { id: 'weak-q', type: 'multiple-choice', topic: 'Weak', prompt: 'w', options: ['a', 'b'], correctIndex: 0, _key: 'weak-card', marks: 1 },
    { id: 'strong-q', type: 'multiple-choice', topic: 'Strong', prompt: 's', options: ['a', 'b'], correctIndex: 0, _key: 'strong-card', marks: 1 },
  ];
  const S = {
    scores: [
      { date: new Date().toISOString(), score: 2, total: 10, topics: ['Weak'], quizUuid: 'u1' },
      { date: new Date().toISOString(), score: 10, total: 10, topics: ['Strong'], quizUuid: 'u2' },
    ],
    quizzes: {},
  };
  const deck = buildSmartDeck(S, questions);
  if (!deck.length) throw new Error('empty deck');
  if (deck[0].key !== 'weak-card' && !(deck[0].front || '').includes('w')) {
    throw new Error('weak card should lead despite strong card being overdue: ' + JSON.stringify(deck.map(c => c.key)));
  }
});

test('buildSmartDeck: within one mastery band, most-overdue card precedes newer-due card', async () => {
  const store = {};
  globalThis.localStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  globalThis.location = { pathname: '/cs/' };
  const NOW = Date.now();
  store['jqm-card-schedule-v1'] = JSON.stringify({
    'cs:older-overdue': { interval: 2, due: NOW - 3 * 86400000, reps: 3 },
    'cs:newer-overdue': { interval: 2, due: NOW - 1 * 86400000, reps: 3 },
  });
  const { buildSmartDeck } = await import('../public/shared/js/flashcardSession.js');
  const questions = [
    { id: 'n', type: 'multiple-choice', topic: 'Weak', prompt: 'newer', options: ['a', 'b'], correctIndex: 0, _key: 'newer-overdue', marks: 1 },
    { id: 'o', type: 'multiple-choice', topic: 'Weak', prompt: 'older', options: ['a', 'b'], correctIndex: 0, _key: 'older-overdue', marks: 1 },
  ];
  const S = { scores: [{ date: new Date().toISOString(), score: 2, total: 10, topics: ['Weak'], quizUuid: 'u1' }], quizzes: {} };
  const deck = buildSmartDeck(S, questions);
  if (deck.length < 2) throw new Error('deck too small');
  if (deck[0].key !== 'older-overdue') throw new Error('most-overdue should lead within band: ' + JSON.stringify(deck.map(c => c.key)));
});
