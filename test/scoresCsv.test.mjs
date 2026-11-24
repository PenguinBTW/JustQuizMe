import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScoresCsv, csvField, csvDate, CSV_HEADERS } from '../public/shared/js/scoresCsv.js';

const HEADERS = 'date,portal,quizTitle,topic,score,maxScore,pct,mode,durationSec';

test('headers match the contract column order', () => {
  assert.deepEqual(CSV_HEADERS, HEADERS.split(','));
  const csv = buildScoresCsv([], { portal: 'cs' });
  assert.equal(csv, `${HEADERS}\r\n`);
});

test('csvField quotes and escapes per RFC-4180', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('line\nbreak'), '"line\nbreak"');
  assert.equal(csvField('cr\rreturn'), '"cr\rreturn"');
  assert.equal(csvField(''), '');
  assert.equal(csvField(null), '');
  assert.equal(csvField(undefined), '');
  assert.equal(csvField(42), '42');
});

test('csvDate normalizes to ISO and survives malformed input', () => {
  assert.equal(csvDate('2026-01-02T03:04:05.000Z'), '2026-01-02T03:04:05.000Z');
  assert.equal(csvDate(new Date('2026-06-30T00:00:00.000Z')), '2026-06-30T00:00:00.000Z');
  assert.equal(csvDate('not a date'), 'not a date');
  assert.equal(csvDate(null), '');
  assert.equal(csvDate({}), '');
});

test('buildScoresCsv maps the score entry shape', () => {
  const runs = [{
    date: '2026-11-24T10:00:00.000Z',
    quizUuid: 'u1',
    quizTitle: 'Data Structures',
    topics: ['Trees', 'Hashing'],
    score: 14,
    total: 20,
    seconds: 612,
    exam: true
  }];
  const csv = buildScoresCsv(runs, { portal: 'cs' });
  const rows = csv.trim().split('\r\n');
  assert.equal(rows.length, 2);
  assert.equal(
    rows[1],
    '2026-11-24T10:00:00.000Z,cs,Data Structures,Trees; Hashing,14,20,70,exam,612'
  );
});

test('pct math rounds to one decimal and guards zero totals', () => {
  const csv = buildScoresCsv(
    [
      { date: '2026-01-01T00:00:00.000Z', quizTitle: 'A', score: 1, total: 3, seconds: 10 },
      { date: '2026-01-02T00:00:00.000Z', quizTitle: 'B', score: 0, total: 0, seconds: 5 }
    ],
    { portal: 'maths' }
  );
  const rows = csv.trim().split('\r\n');
  assert.equal(rows[1].split(',')[6], '33.3');
  assert.equal(rows[2].split(',')[6], '0');
});

test('mode derives from the exam flag', () => {
  const csv = buildScoresCsv(
    [{ date: '2026-01-01T00:00:00.000Z', quizTitle: 'A', score: 1, total: 1, exam: false }],
    { portal: 'physics' }
  );
  assert.equal(csv.trim().split('\r\n')[1].split(',')[7], 'quiz');
});

test('uuidIndex topics fill the topic cell when entry has none', () => {
  const csv = buildScoresCsv(
    [{ date: '2026-01-01T00:00:00.000Z', quizUuid: 'u9', quizTitle: '', score: 2, total: 4 }],
    { portal: 'cs', uuidIndex: { u9: ['Graphs'] } }
  );
  assert.equal(csv.trim().split('\r\n')[1].split(',')[3], 'Graphs');
});

test('malformed rows are skipped, not fatal', () => {
  const csv = buildScoresCsv([null, 'junk', { score: 5, total: 5, quizTitle: 'ok' }], { portal: 'cs' });
  const rows = csv.trim().split('\r\n');
  assert.equal(rows.length, 2);
});
