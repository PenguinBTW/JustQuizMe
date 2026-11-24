import test from 'node:test';
import assert from 'node:assert';
import { reviewWalkHtml } from '../public/shared/js/reviewWalk.js';
import { readFileSync } from 'node:fs';

const csBank = JSON.parse(readFileSync(new URL('./fixtures/mistakes-cs.json', import.meta.url)));
const mathsBank = JSON.parse(readFileSync(new URL('./fixtures/mistakes-maths.json', import.meta.url)));

test('review walk renders per-question entries with mark scheme + feedback', () => {
  const qs = [csBank.questions[0], mathsBank.questions[0]];
  qs[0].id = 'q1'; qs[1].id = 'q2';
  const html = reviewWalkHtml(qs, { q1: { selected: 0 }, q2: { text: 'because reasons' } });
  assert.match(html, /Q1/);
  assert.match(html, /Q2/);
  assert.match(html, /Harvard/);       // distractor feedback
  assert.match(html, /YOUR ANSWER/);
  assert.match(html, /MARK SCHEME/);
  assert.match(html, /misconception/i);
});

test('correct answers render no misconception feedback', () => {
  const q = { ...csBank.questions[0], id: 'q1' };
  const html = reviewWalkHtml([q], { q1: { selected: 1 } });
  assert.ok(!html.includes('Harvard architecture — separate'));
});

test('missing answers render unattempted without crashing', () => {
  const q = { ...csBank.questions[0], id: 'q1' };
  const html = reviewWalkHtml([q], {});
  assert.match(html, /unattempted/);
});
