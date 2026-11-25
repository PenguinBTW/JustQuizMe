import test from 'node:test';
import assert from 'node:assert';
import { paperPrintDoc, markSchemePrintDoc, questionBlockHtml, workingLines } from '../public/shared/js/printPaper.js';

const mcq = { type: 'multiple-choice', marks: 2, prompt: 'Pick one', options: ['alpha', 'beta'], correctIndex: 1 };
const written = { type: 'written', marks: 4, prompt: 'Explain', markScheme: [{ text: 'point A', marks: 2 }, { text: 'point B', marks: 2 }], mistakes: [{ misconception: 'confuses X', correction: 'X is Y' }] };

test('paper doc: header, numbering, marks, no scheme leakage', () => {
  const d = paperPrintDoc({ title: 'P1', portal: 'CS', timeMinutes: 30, questions: [mcq, written] });
  assert.match(d, /Time allowed: 30 minutes/);
  assert.match(d, /Total: 6 marks/);
  assert.match(d, /Question/);
  assert.ok(!d.includes('point A'), 'student paper must not contain mark scheme');
  assert.ok(!d.includes('Teacher copy'));
  assert.match(d, /Name:/);
});

test('mark scheme doc: criteria, correct answer, mistakes, teacher banner', () => {
  const d = markSchemePrintDoc({ title: 'P1', portal: 'CS', questions: [mcq, written] });
  assert.match(d, /Teacher copy/);
  assert.match(d, /point A/);
  assert.match(d, /Correct answer: <strong>B<\/strong>/);
  assert.match(d, /confuses X/);
  assert.match(d, /X is Y/);
  assert.ok(!d.includes('<div class="pq-line"><\/div>'), 'scheme has no working space lines');
});

test('working space proportional to marks, type-aware', () => {
  assert.strictEqual(workingLines({ type: 'written', marks: 4 }), 8);
  assert.strictEqual(workingLines({ type: 'multiple-choice', marks: 4 }), 0);
  assert.strictEqual(workingLines({ type: 'extended-response', marks: 8 }), 20); // capped
  assert.strictEqual(workingLines({ type: 'written', marks: 1 }), 3); // floor
});

test('page-break protection + untimed honesty', () => {
  const d = paperPrintDoc({ title: 'P', questions: [mcq] });
  assert.match(d, /break-inside: avoid/);
  assert.match(d, /No time limit/);
});

test('object-form MCQ options render their text', () => {
  const q = { type: 'multiple-choice', marks: 1, prompt: 'p', options: [{ text: 'obj-opt' }], correctIndex: 0 };
  assert.ok(questionBlockHtml(q, 1).includes('obj-opt'));
});

test('blank tables: truth-table inputs print as givens (incl. zero) without leaking outputs', () => {
  const tt = { type: 'truth-table', marks: 3, prompt: 'complete', inputs: ['A', 'B'], outputs: ['Q'], rows: [{ inputs: [0, 0], expected: [1] }, { inputs: [1, 1], expected: [0] }] };
  const d = paperPrintDoc({ title: 'P', portal: 'CS', questions: [tt] });
  assert.match(d, /<th>A<\/th>/);
  assert.match(d, /<th>Q<\/th>/);
  assert.ok(d.includes('>0</td>'), 'zero-valued input givens must print');
  const nbspRowEnds = (d.match(/<td>&nbsp;<\/td><\/tr>/g) || []).length;
  assert.strictEqual(nbspRowEnds, 2, 'every output-column cell is blank — no expected outputs leak');
  const s2 = markSchemePrintDoc({ title: 'P', portal: 'CS', questions: [tt] });
  assert.ok(s2.length > 0);
});

test('blank tables: trace tables print starting state filled, answer rows empty', () => {
  const tr = { type: 'trace-table', marks: 4, prompt: 'trace', columns: ['i', 'sum'], initialRows: [['-', '0']], expectedRows: [['0', '3'], ['1', '4']] };
  const d = paperPrintDoc({ title: 'P', portal: 'CS', questions: [tr] });
  assert.ok(d.includes('>-</td>'), 'initial row marker prints as a given');
  assert.ok(d.includes('<td>0</td>'), 'initial state values print');
  // answer rows must be empty cells
  assert.ok(d.includes('<td>&nbsp;</td>'), 'blank writable rows present');
  assert.ok(!/<td>3<\/td>/.test(d), 'expected trace values must not leak onto the student paper');
});
