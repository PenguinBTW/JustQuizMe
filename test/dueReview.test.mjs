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

test('aging topics: retention projection uses daysSince — fresh strong topic not due, same mastery aged becomes due', async () => {
  const { dueReview } = await import('../public/shared/js/dueReview.js');
  const fresh = [{ topic: 'T', mastery: 0.9, daysSince: 0 }];
  const aged = [{ topic: 'T', mastery: 0.9, daysSince: 42 }];
  // fresh: 0.9 retention — weeks from weak; aged 42d: 0.9 * 2^-3 = 0.11 — overdue
  const freshDue = dueReview(fresh, { dueWithinDays: 7 });
  const agedDue = dueReview(aged, { dueWithinDays: 7 });
  if (freshDue.length) throw new Error('fresh topic wrongly due: ' + JSON.stringify(freshDue));
  if (!agedDue.length || !agedDue[0].overdue) throw new Error('aged topic should be overdue: ' + JSON.stringify(agedDue));
});
