import test from 'node:test';
import assert from 'node:assert';
import { matchMistakes, feedbackHtml } from '../public/shared/js/answerFeedback.js';
import { readFileSync } from 'node:fs';

const csBank = JSON.parse(readFileSync(new URL('./fixtures/mistakes-cs.json', import.meta.url)));
const mathsBank = JSON.parse(readFileSync(new URL('./fixtures/mistakes-maths.json', import.meta.url)));

test('MCQ: distractor-specific feedback matches the picked option', () => {
  const q = csBank.questions[0];
  const hits = matchMistakes(q, 0);
  assert.equal(hits.length, 1);
  assert.match(hits[0].misconception, /Harvard/);
  assert.equal(matchMistakes(q, 1).length, 0); // correct answer — no misconception feedback
});

test('written: substring pattern matches student answer case-insensitively', () => {
  const q = mathsBank.questions[0];
  const hits = matchMistakes(q, 'Because the graph crosses twice');
  assert.equal(hits.length, 1);
  assert.match(hits[0].correction, /b²−4ac/);
});

test('banks without mistakes[] yield empty feedback — backward compatible', () => {
  assert.deepEqual(matchMistakes({ type: 'multiple-choice', options: ['a'] }, 0), []);
  assert.deepEqual(matchMistakes(null, 0), []);
  assert.deepEqual(matchMistakes({ type: 'written' }, 'some answer'), []);
});

test('feedbackHtml renders misconception + correction, escapes markup', () => {
  const html = feedbackHtml([{ misconception: '<b>wrong</b>', correction: 'fix it' }], s => s.replace(/</g, '&lt;'));
  assert.match(html, /misconception/);
  assert.match(html, /fix it/);
  assert.ok(!html.includes('<b>wrong</b>'));
});
