import test from 'node:test';
import assert from 'node:assert';
import { generatePlan, sessionDone, planProgress, topicWeight, dayKey, daysBetween, loadExamDates, saveExamDate, SPACING_LADDER } from '../public/shared/js/studyPlanner.js';

const inDays = n => new Date(Date.now() + n * 86400000);

test('weakest topics get more sessions than strong ones', () => {
  const plan = generatePlan({
    examDate: inDays(20),
    topics: [{ topic: 'weak', mastery: 0.1 }, { topic: 'strong', mastery: 0.95 }],
  });
  const counts = {};
  plan.days.forEach(d => d.sessions.forEach(s => counts[s.topic] = (counts[s.topic] || 0) + 1));
  assert.ok(counts.weak > counts.strong, `weak ${counts.weak} should exceed strong ${counts.strong}`);
  assert.ok(counts.strong >= 1, 'even strong topics get maintenance');
});

test('unpractised topics count as weakest', () => {
  assert.strictEqual(topicWeight(null), topicWeight(0));
  assert.ok(topicWeight(null) > topicWeight(0.8));
});

test('total sessions never exceed slots; every day within range', () => {
  const plan = generatePlan({
    examDate: inDays(10),
    topics: [{ topic: 'a', mastery: 0.5 }, { topic: 'b', mastery: 0.5 }, { topic: 'c', mastery: 0.5 }],
    sessionsPerDay: 2,
  });
  assert.strictEqual(plan.days.length, 10);
  const total = plan.days.reduce((s, d) => s + d.sessions.length, 0);
  assert.ok(total <= 20, `${total} exceeds 20 slots`);
  for (const d of plan.days) assert.ok(d.sessions.length <= 3, 'spill is bounded');
});

test('due topics front-load their first session', () => {
  const plan = generatePlan({
    examDate: inDays(15),
    topics: [{ topic: 'due', mastery: 0.5, dueInDays: 1 }, { topic: 'fresh', mastery: 0.5 }],
  });
  const firstDue = plan.days.findIndex(d => d.sessions.some(s => s.topic === 'due'));
  assert.ok(firstDue <= 1, `due topic first session at day ${firstDue}`);
});

test('spaced repetition: repeated sessions spread over multiple days', () => {
  const plan = generatePlan({
    examDate: inDays(25),
    topics: [{ topic: 'only', mastery: 0.3 }],
    sessionsPerDay: 1,
  });
  const days = plan.days.map((d, i) => d.sessions.some(s => s.topic === 'only') ? i : -1).filter(i => i >= 0);
  assert.ok(days.length >= 3, 'topic repeats');
  const gaps = days.slice(1).map((d, i) => d - days[i]);
  assert.ok(gaps.some(g => g >= 2), `some gaps widen (spacing) — gaps ${gaps}`);
});

test('flashcard days interleave for repeated topics', () => {
  const plan = generatePlan({
    examDate: inDays(30),
    topics: [{ topic: 'x', mastery: 0.2 }],
    sessionsPerDay: 1,
  });
  assert.ok(plan.days.some(d => d.sessions.some(s => s.kind === 'flashcards')), 'flashcard sessions exist');
  assert.ok(plan.days.some(d => d.sessions.some(s => s.kind === 'quiz')), 'quiz sessions exist');
});

test('exam in the past or tomorrow → honest truncation', () => {
  const past = generatePlan({ examDate: inDays(-2), topics: [{ topic: 'a', mastery: 0.5 }] });
  assert.strictEqual(past.days.length, 0);
  assert.strictEqual(past.truncated, true);
});

test('session completion matches topic+day, flashcard-aware', () => {
  const today = dayKey(new Date());
  const entries = [
    { date: new Date().toISOString(), topics: ['algebra'] },
    { date: new Date().toISOString(), flashcard: true, topics: ['algebra'] },
  ];
  assert.strictEqual(sessionDone({ topic: 'algebra', kind: 'quiz' }, today, entries), true);
  assert.strictEqual(sessionDone({ topic: 'algebra', kind: 'flashcards' }, today, entries), true);
  assert.strictEqual(sessionDone({ topic: 'geometry', kind: 'quiz' }, today, entries), false);
  const yesterday = dayKey(inDays(-1));
  assert.strictEqual(sessionDone({ topic: 'algebra', kind: 'quiz' }, yesterday, entries), false);
});

test('planProgress tallies done vs total per day', () => {
  const today = dayKey(new Date());
  const plan = { days: [{ date: today, sessions: [{ topic: 'a', kind: 'quiz', round: 1 }, { topic: 'b', kind: 'quiz', round: 1 }] }] };
  const entries = [{ date: new Date().toISOString(), topics: ['a'] }];
  const prog = planProgress(plan, entries);
  assert.strictEqual(prog.done, 1);
  assert.strictEqual(prog.total, 2);
  assert.strictEqual(prog.perDay[0].sessions[0].done, true);
  assert.strictEqual(prog.perDay[0].sessions[1].done, false);
});

test('day arithmetic is timezone-honest', () => {
  assert.strictEqual(daysBetween('2026-01-01', '2026-01-08'), 7);
  assert.strictEqual(daysBetween('2026-03-08', '2026-03-09'), 1); // DST boundary US
  assert.strictEqual(dayKey('2026-01-05T23:30:00'), '2026-01-05');
});

test('exam date store round-trips per subject', () => {
  const mem = {};
  const storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  saveExamDate('cs', '2026-06-01', storage);
  saveExamDate('maths', '2026-06-10', storage);
  const all = loadExamDates(storage);
  assert.strictEqual(all.cs, '2026-06-01');
  assert.strictEqual(all.maths, '2026-06-10');
  saveExamDate('cs', null, storage);
  assert.strictEqual(loadExamDates(storage).cs, undefined);
});

test('spacing ladder is widening', () => {
  for (let i = 1; i < SPACING_LADDER.length; i++) assert.ok(SPACING_LADDER[i] >= SPACING_LADDER[i - 1]);
});

test('final week includes review sessions for studied topics', () => {
  const plan = generatePlan({
    examDate: inDays(30),
    topics: [{ topic: 'a', mastery: 0.3 }, { topic: 'b', mastery: 0.7 }],
    sessionsPerDay: 2,
  });
  const reviews = [];
  plan.days.forEach((d, i) => d.sessions.forEach(s => { if (s.kind === 'review') reviews.push({ i, topic: s.topic }); }));
  assert.ok(reviews.length >= 2, 'review sessions exist');
  for (const r of reviews) assert.ok(plan.days.length - r.i <= 7, `review lands in final week (day ${r.i} of ${plan.days.length})`);
});
