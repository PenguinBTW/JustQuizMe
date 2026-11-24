import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetModel, sheetHTML, trimText, verdict } from '../public/shared/js/print-sheet.js';

const run = (questions = []) => ({
  title: 'Programming Basics Quiz',
  mode: 'quiz',
  date: '24 Nov 2026',
  durationSeconds: 325,
  questions,
});

test('rows: per-question ref/score/marks/verdict', () => {
  const m = sheetModel(run([
    { text: 'Define an algorithm', marks: 2, score: 2 },
    { text: 'Write a loop', marks: 4, score: 1 },
    { text: 'Trace this program', marks: 4, score: 0 },
  ]));
  assert.equal(m.rows.length, 3);
  assert.equal(m.rows[0].ref, 'Q1');
  assert.equal(m.rows[0].verdict, 'full');
  assert.equal(m.rows[1].verdict, 'partial');
  assert.equal(m.rows[2].verdict, 'none');
});

test('totals: earned/total/pct', () => {
  const m = sheetModel(run([
    { text: 'a', marks: 2, score: 2 },
    { text: 'b', marks: 4, score: 1 },
    { text: 'c', marks: 4, score: 0 },
  ]));
  assert.deepEqual(m.totals, { earned: 3, total: 10, pct: 30 });
});

test('score clamps to [0, marks]', () => {
  const m = sheetModel(run([{ text: 'a', marks: 3, score: 9 }]));
  assert.equal(m.rows[0].score, 3);
  assert.equal(m.rows[0].verdict, 'full');
});

test('empty run produces zero totals and no rows', () => {
  const m = sheetModel(run());
  assert.equal(m.rows.length, 0);
  assert.deepEqual(m.totals, { earned: 0, total: 0, pct: 0 });
});

test('trimText strips html/latex/code and truncates', () => {
  assert.equal(trimText('<p>What is <b>abstraction</b>?</p>'), 'What is abstraction?');
  assert.equal(trimText('Compute $x^2$ now'), 'Compute (math) now');
  assert.equal(trimText('Show that \\(x^2 > 0\\) holds'), 'Show that (math) holds');
  assert.equal(trimText('a < b and c > d'), 'a < b and c > d');
  const long = 'x'.repeat(200);
  assert.equal(trimText(long).length, 140);
  assert.ok(trimText(long).endsWith('…'));
});

test('verdict mapping incl. zero-mark questions', () => {
  assert.equal(verdict(2, 2), 'full');
  assert.equal(verdict(1, 2), 'partial');
  assert.equal(verdict(0, 2), 'none');
  assert.equal(verdict(0, 0), 'none');
});

test('sheetHTML escapes question text and includes totals footer', () => {
  const m = sheetModel(run([{ text: 'A <script> tag & "quotes"', marks: 1, score: 1 }]));
  const html = sheetHTML(m);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&#38;')); // the & is entity-escaped
  assert.ok(html.includes('Total 1 / 1'));
  assert.ok(html.includes('Programming Basics Quiz'));
  assert.ok(html.includes('5m 25s'));
});
