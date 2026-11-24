import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport } from '../public/shared/js/attemptExport.js';

const keyOf = (q) => q._key || q.id;

const quiz = {
  uuid: 'quiz-uuid-1',
  title: 'Mechanics — Momentum',
  exam: false,
  questions: [
    { _key: 'q1', type: 'multiple-choice', section: 'Q1', marks: 1, prompt: '  Which quantity is conserved? ', options: ['Kinetic energy', 'Momentum', 'Power'], correctIndex: 1 },
    { _key: 'q2', type: 'written', section: 'Q2', marks: 4, prompt: 'Explain recoil.' },
    { _key: 'q3', type: 'calculation', section: 'Q3', marks: 3, prompt: 'Find v.', unit: 'm s⁻¹' },
  ],
};

const run = {
  portal: 'physics',
  quiz,
  quizMeta: { file: 'momentum.json' },
  keyOf,
  startedAt: '2026-11-24T06:00:00.000Z',
  finishedAt: '2026-11-24T06:20:00.000Z',
  elapsedSeconds: 1190,
  answers: {
    q1: { locked: true, picked: 1, correct: true, score: 1 },
    q2: { locked: true, text: '  momentum is conserved ', ticks: [true, false, true], score: 2 },
    q3: { locked: true, finalValue: '4.2', attempts: 1, soloCorrect: true, score: 3 },
  },
};

test('rows map each question: ref, trimmed text, answer, marks, verdict', () => {
  const { json } = buildExport(run);
  const rows = json.attempt.questions;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { ref: 'q1', position: 1, section: 'Q1', text: 'Which quantity is conserved?', type: 'multiple-choice', answer: 'B: Momentum', marks: { earned: 1, total: 1 }, verdict: 'correct' });
  assert.equal(rows[1].answer, '2 mark-scheme ticks — "momentum is conserved"');
  assert.equal(rows[1].verdict, 'partial');
  assert.equal(rows[2].answer, '4.2 m s⁻¹');
});

test('verdicts: correct / partial / incorrect / helped', () => {
  const mk = (score, extra = {}) => ({ quiz: { questions: [{ _key: 'q', type: 'calculation', marks: 5, prompt: 'x' }] }, answers: { q: { score, ...extra } }, keyOf });
  assert.equal(buildExport(mk(5)).json.attempt.questions[0].verdict, 'correct');
  assert.equal(buildExport(mk(2)).json.attempt.questions[0].verdict, 'partial');
  assert.equal(buildExport(mk(0)).json.attempt.questions[0].verdict, 'incorrect');
  assert.equal(buildExport(mk(0, { helped: true })).json.attempt.questions[0].verdict, 'helped');
  assert.equal(buildExport(mk(0, { helped: true, finalValue: '4.2' })).json.attempt.questions[0].answer, 'helped (steps used, last entry 4.2)');
});

test('filename is portal-slug-quiz-date.json and special chars are slugged', () => {
  const { filename } = buildExport(run);
  assert.equal(filename, 'physics-mechanics-momentum-2026-11-24.json');
  assert.equal(buildExport({ ...run, quiz: { ...quiz, title: 'A & B!!' } }).filename, 'physics-a-b-2026-11-24.json');
  assert.equal(buildExport({ portal: 'cs', quiz: { questions: [], title: '' } }).filename.startsWith('cs-attempt-'), true);
});

test('totals, percentage, timestamps, attempt id', () => {
  const { json } = buildExport(run);
  const a = json.attempt;
  assert.equal(a.id, 'quiz-uuid-1@2026-11-24T06:20:00.000Z');
  assert.equal(a.score, 6);
  assert.equal(a.totalMarks, 8);
  assert.equal(a.percentage, 75);
  assert.equal(a.timeUsedSeconds, 1190);
  assert.equal(a.startedAt, '2026-11-24T06:00:00.000Z');
  assert.equal(a.quiz.file, 'momentum.json');
});

test('empty attempt exports cleanly', () => {
  const { json, filename } = buildExport({ portal: 'physics', quiz: { questions: [] }, keyOf });
  assert.deepEqual(json.attempt.questions, []);
  assert.equal(json.attempt.percentage, 0);
  assert.match(filename, /^physics-attempt-\d{4}-\d{2}-\d{2}\.json$/);
});
