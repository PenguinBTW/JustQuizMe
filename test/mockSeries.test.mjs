import test from 'node:test';
import assert from 'node:assert';
import { createSeries, recordPaperResult, recordBreak, seriesProgress, seriesSummary, gradeFor, breakScreenHtml, seriesFinishHtml, fmtClock } from '../public/shared/js/mockSeries.js';

function makeSeries() {
  return createSeries([
    { key: 'comp01', title: 'Mock · Component 01 (70 marks)', totalMarks: 70, timeLimitMinutes: 75 },
    { key: 'comp02', title: 'Mock · Component 02 (70 marks)', totalMarks: 70, timeLimitMinutes: 75 },
  ], { breakMinutes: 10 });
}

test('series lifecycle: progress, results, completion', () => {
  const s = makeSeries();
  assert.deepStrictEqual(seriesProgress(s), { done: 0, total: 2, complete: false, currentIndex: 0 });
  recordPaperResult(s, { score: 50, total: 70, seconds: 3600 });
  assert.strictEqual(seriesProgress(s).done, 1);
  assert.strictEqual(seriesProgress(s).complete, false);
  assert.strictEqual(s.index, 1);
  recordPaperResult(s, { score: 60, total: 70, seconds: 3500 });
  assert.strictEqual(seriesProgress(s).complete, true);
});

test('series summary: combined score, per-paper breakdown, total time', () => {
  const s = makeSeries();
  recordPaperResult(s, { score: 50, total: 70, seconds: 3600 });
  recordPaperResult(s, { score: 60, total: 70, seconds: 3500 });
  const sum = seriesSummary(s);
  assert.strictEqual(sum.totalScore, 110);
  assert.strictEqual(sum.totalMarks, 140);
  assert.strictEqual(sum.pct, 79);
  assert.strictEqual(sum.totalSeconds, 7100);
  assert.strictEqual(sum.papers.length, 2);
  assert.strictEqual(sum.papers[0].pct, 71);
});

test('break recording: skipped breaks are honestly flagged', () => {
  const s = makeSeries();
  recordPaperResult(s, { score: 1, total: 70, seconds: 60 });
  recordBreak(s, { skipped: true, minutes: 0 });
  assert.strictEqual(s.breaks.length, 1);
  assert.strictEqual(s.breaks[0].skipped, true);
  const html = seriesFinishHtml(s, { portal: 'X' });
  assert.match(html, /1 break skipped/);
});

test('grade boundaries: applied when present, null otherwise', () => {
  assert.strictEqual(gradeFor(75, { 'A*': 80, A: 70, B: 60 }), 'A');
  assert.strictEqual(gradeFor(85, { 'A*': 80, A: 70 }), 'A*');
  assert.strictEqual(gradeFor(50, null), null);
  assert.strictEqual(gradeFor(10, { E: 40 }), 'U');
});

test('intermission screen: progress, next paper, honest expiry note', () => {
  const s = makeSeries();
  recordPaperResult(s, { score: 50, total: 70, seconds: 100 });
  const html = breakScreenHtml(s, { paperTitle: 'P1', score: 50, total: 70, nextTitle: 'P2', expired: true });
  assert.match(html, /paper 1 of 2 complete/);
  assert.match(html, /P2/);
  assert.match(html, /time expired/);
  assert.match(html, /skip break \(recorded\)/);
});

test('fmtClock formats honestly', () => {
  assert.strictEqual(fmtClock(600), '10m 0s');
  assert.strictEqual(fmtClock(0), '0m 0s');
  assert.strictEqual(fmtClock(-5), '0m 0s');
});

test('series finish: per-paper rows + total exam time', () => {
  const s = makeSeries();
  recordPaperResult(s, { score: 50, total: 70, seconds: 3600 });
  recordPaperResult(s, { score: 60, total: 70, seconds: 3500 });
  const html = seriesFinishHtml(s, { portal: 'CS' });
  assert.match(html, /110 \/ 140/);
  assert.match(html, /total exam time/);
  assert.match(html, /Component 01/);
});
