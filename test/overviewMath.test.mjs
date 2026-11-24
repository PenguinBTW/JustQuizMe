import test from 'node:test';
import assert from 'node:assert/strict';
import { subjectSummary, attentionList, recentActivity } from '../public/shared/js/overviewMath.js';

const now = Date.now();
const iso = new Date(now - 86400000).toISOString();
const pq = (topic, score, marks) => ({ topic, score, marks, attempted: true });

test('subjectSummary: mean mastery, weak count, attempted questions', () => {
  const scores = [
    { date: iso, score: 3, total: 10, topics: ['WeakT'], perQuestion: [pq('WeakT', 3, 10)] },
    { date: iso, score: 9, total: 10, topics: ['StrongT'], perQuestion: [pq('StrongT', 9, 10)] },
  ];
  const s = subjectSummary(scores, now);
  assert.ok(Math.abs(s.meanMastery - 0.6) < 0.01);
  assert.equal(s.weakCount, 1);
  assert.equal(s.questionsAttempted, 2);
  assert.equal(s.runs, 2);
});

test('subjectSummary: empty history degrades to nulls/zeros, never throws', () => {
  const s = subjectSummary([], now);
  assert.equal(s.meanMastery, null);
  assert.equal(s.weakCount, 0);
  assert.equal(s.runs, 0);
  assert.equal(s.lastActive, null);
});

test('attentionList: weakest-first across subjects, unpracticed excluded', () => {
  const bySubject = {
    cs: [{ date: iso, score: 2, total: 10, topics: ['CSWeak'], perQuestion: [pq('CSWeak', 2, 10)] }],
    maths: [{ date: iso, score: 9, total: 10, topics: ['MathStrong'], perQuestion: [pq('MathStrong', 9, 10)] }],
  };
  const att = attentionList(bySubject, now);
  assert.equal(att[0].topic, 'CSWeak');
  assert.equal(att[0].subject, 'cs');
  assert.ok(att.every(a => a.mastery != null));
});

test('recentActivity: cross-subject newest-first, flashcard labeled, malformed dropped', () => {
  const bySubject = {
    cs: [
      { date: iso, title: 'Old run', score: 5, total: 10 },
      { date: new Date(now).toISOString(), title: 'Cards', score: 2, total: 5, flashcard: true },
    ],
    maths: [{ date: 'garbage', title: 'Bad' }, null],
  };
  const rec = recentActivity(bySubject);
  assert.equal(rec.length, 2);
  assert.equal(rec[0].title, 'Cards');
  assert.equal(rec[0].flashcard, true);
});
