import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timerSpec, tick, mmss, parseChromeCount, parseRemaining } from '../public/shared/js/examTimer.js';

test('timerSpec: total/per-question seconds', () => {
  const s = timerSpec({ totalMin: 30, questionCount: 12 });
  assert.equal(s.totalSec, 1800);
  assert.equal(s.perQSec, 150);
  assert.equal(timerSpec({ totalMin: 0, questionCount: 0 }).perQSec, 0);
});

test('tick: pace at 0% elapsed is on', () => {
  const spec = timerSpec({ totalMin: 10, questionCount: 10 });
  const t = tick({ remainingSec: 600, questionIndex: 1 }, spec);
  assert.equal(t.remainingSec, 600);
  assert.equal(t.pace, 'on');
  assert.ok(Math.abs(t.paceQ - 1) < 1e-9);
});

test('tick: 50% elapsed paces question ~5.5', () => {
  const spec = timerSpec({ totalMin: 10, questionCount: 10 });
  const t = tick({ remainingSec: 300, questionIndex: 6 }, spec);
  assert.equal(t.pace, 'on');
  assert.ok(t.paceQ > 5.9 && t.paceQ <= 6);
});

test('tick: behind when below pace, ahead when above', () => {
  const spec = timerSpec({ totalMin: 10, questionCount: 10 });
  assert.equal(tick({ remainingSec: 300, questionIndex: 3 }, spec).pace, 'behind');
  assert.equal(tick({ remainingSec: 300, questionIndex: 9 }, spec).pace, 'ahead');
});

test('tick: 100% elapsed clamps remaining at 0', () => {
  const spec = timerSpec({ totalMin: 10, questionCount: 10 });
  const t = tick({ elapsedSec: 999, questionIndex: 10 }, spec);
  assert.equal(t.remainingSec, 0);
  assert.equal(t.paceQ > 10, true);
});

test('tick: at time-up a low index is behind', () => {
  const spec = timerSpec({ totalMin: 10, questionCount: 10 });
  assert.equal(tick({ remainingSec: 0, questionIndex: 4 }, spec).pace, 'behind');
});

test('mmss formats', () => {
  assert.equal(mmss(0), '00:00');
  assert.equal(mmss(65), '01:05');
  assert.equal(mmss(601), '10:01');
  assert.equal(mmss(-5), '00:00');
});

test('parseChromeCount: all portal formats', () => {
  assert.deepEqual(parseChromeCount('Question 3 of 12 · 4 marks'), { index: 3, count: 12 });
  assert.deepEqual(parseChromeCount('Q7 of 20'), { index: 7, count: 20 });
  assert.equal(parseChromeCount('nothing'), null);
});

test('parseRemaining: clock text', () => {
  assert.equal(parseRemaining('Q2 of 9 · ⏱ 12:34 left'), 754);
  assert.equal(parseRemaining('⏱ 0:05 left'), 5);
  assert.equal(parseRemaining('⏱ 12:34'), null);
});
