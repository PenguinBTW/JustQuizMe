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

test('partly-filled trace table keeps row positions (blank rows preserved)', () => {
  const q = { id: 't1', type: 'trace-table', prompt: 'trace', markScheme: [{ text: 'rows', marks: 2 }] };
  const rows = [['', '', ''], ['x', '5', 'y']];
  const h = reviewWalkHtml([q], { t1: { rows } });
  const m = h.match(/YOUR ANSWER<\/span><div[^>]*>([\s\S]*?)<\/div>/);
  const body = m ? m[1] : '';
  // exact positional check: line 0 is the blank first row, line 1 the filled second
  const lines = body.split('\n');
  assert.strictEqual(lines[0], ' |  | ', 'blank first row preserved verbatim at position 0');
  assert.strictEqual(lines[1], 'x | 5 | y', 'filled row at its original position 1');
});

test('fully cleared trace table renders as unattempted', () => {
  const q = { id: 't2', type: 'trace-table', prompt: 'trace', markScheme: [] };
  const h = reviewWalkHtml([q], { t2: { rows: [['', '', '']] } });
  assert.ok(h.includes('unattempted'), 'cleared table is unattempted');
});

test('shared question ids across banks never borrow answers', () => {
  // two banks carry a question with the same bare id; only bank A's copy was
  // answered — bank B's copy must render unattempted, not borrow A's answer
  const qA = { id: 'q1', _key: 'bankA.json:q1', type: 'written', prompt: 'p', markScheme: [] };
  const qB = { id: 'q1', _key: 'bankB.json:q1', type: 'written', prompt: 'p', markScheme: [] };
  const answers = { 'bankA.json:q1': { text: 'student answer for A' } };
  const html = reviewWalkHtml([qA, qB], answers);
  // per-position assertions: bank A's entry carries the answer, bank B's
  // entry carries 'unattempted' — a swapped borrowing must fail this test
  const items = html.split('<details class="rw-item"').slice(1);
  assert.equal(items.length, 2, 'two review entries rendered');
  assert.match(items[0], /student answer for A/, 'bank A entry shows its own answer');
  assert.match(items[1], /unattempted/, 'bank B entry renders unattempted');
  assert.ok(!items[1].includes('student answer for A'), 'bank B never borrows bank A answer');
});

test('ambiguous suffix matches render unattempted', () => {
  // both banks answered — an unkeyed question with the same bare id cannot
  // tell which answer is its own, so it must not borrow either
  const qX = { id: 'q1', type: 'written', prompt: 'p', markScheme: [] };
  const answers = {
    'bankA.json:q1': { text: 'answer A' },
    'bankB.json:q1': { text: 'answer B' }
  };
  const html = reviewWalkHtml([qX], answers);
  assert.match(html, /unattempted/);
  assert.ok(!html.includes('YOUR ANSWER'), 'no answer block rendered for ambiguous question');
});
