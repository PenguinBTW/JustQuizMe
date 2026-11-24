import test from 'node:test';
import assert from 'node:assert/strict';
import { dueReview, daysUntilDue } from '../public/shared/js/dueReview.js';
import { WEAK_THRESHOLD } from '../public/shared/js/mastery.js';

test('strong mastery projects due date in the future', () => {
  const d = daysUntilDue(0.9);
  assert.ok(d > 7 && d < 10, `0.9 → ${d}`);
});

test('mastery at threshold is due today, below is overdue', () => {
  assert.ok(Math.abs(daysUntilDue(WEAK_THRESHOLD)) < 1e-9 || daysUntilDue(WEAK_THRESHOLD) <= 0);
  assert.ok(daysUntilDue(0.3) < 0);
});

test('zero/null mastery never becomes due', () => {
  assert.equal(daysUntilDue(0), null);
  assert.equal(daysUntilDue(null), null);
});

test('dueReview orders overdue-first then due-soonest, excludes far-future and unmeasured', () => {
  const rows = [
    { topic: 'strong', mastery: 0.95 },
    { topic: 'weak', mastery: 0.3 },
    { topic: 'borderline', mastery: 0.62 },
    { topic: 'unmeasured', mastery: null },
    { topic: 'veryweak', mastery: 0.2 },
  ];
  const out = dueReview(rows);
  const topics = out.map(o => o.topic);
  assert.equal(topics[0], 'veryweak');
  assert.ok(topics.indexOf('weak') < topics.indexOf('borderline'));
  assert.ok(!topics.includes('unmeasured'));
  assert.ok(!topics.includes('strong')); // 0.95 not due within 7d
  assert.ok(out.find(o => o.topic === 'weak').overdue);
  assert.ok(!out.find(o => o.topic === 'borderline').overdue);
});

test('labels are honest: overdue Nd / due today / due in Nd', () => {
  const out = dueReview([{ topic: 'x', mastery: 0.3 }, { topic: 'y', mastery: 0.62 }]);
  assert.match(out.find(o => o.topic === 'x').label, /^overdue \d+d$|^due today$/);
  assert.match(out.find(o => o.topic === 'y').label, /^due in \d+d$|^due today$/);
});
