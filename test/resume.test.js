import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveAnchor, loadAnchor, clearAnchor, resumeHref, RESUME_TTL_MS } from '../public/shared/js/resume.js';

class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

const base = () => ({
  portal: 'maths',
  kind: 'virtual',
  category: 'past-paper',
  quizFile: 'mixed',
  quizUuid: 'q-1',
  title: 'Mixed set',
  qIndex: 4,
  total: 12,
  mode: 'quiz',
  order: ['a', 'b', 'c'],
  answers: { a: { locked: true } },
  elapsed: 95,
  startedAt: '2026-11-24T10:00:00Z',
  spec: { kind: 'mixed' },
  questions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
});

test('save → load round-trips a valid anchor', () => {
  const s = new MemStore();
  const a = saveAnchor(base(), s);
  assert.equal(a.v, 1);
  const got = loadAnchor('maths', s);
  assert.equal(got.quizUuid, 'q-1');
  assert.equal(got.qIndex, 4);
  assert.equal(got.total, 12);
  assert.equal(got.order.length, 3);
});

test('anchors are namespaced per portal', () => {
  const s = new MemStore();
  saveAnchor({ ...base(), portal: 'cs' }, s);
  assert.equal(loadAnchor('maths', s), null);
  assert.equal(loadAnchor('cs', s).quizUuid, 'q-1');
});

test('clearAnchor removes only that portal', () => {
  const s = new MemStore();
  saveAnchor({ ...base(), portal: 'maths' }, s);
  saveAnchor({ ...base(), portal: 'cs' }, s);
  clearAnchor('maths', s);
  assert.equal(loadAnchor('maths', s), null);
  assert.notEqual(loadAnchor('cs', s), null);
});

test('tampered anchors are rejected', () => {
  const s = new MemStore();
  saveAnchor(base(), s);
  const tamper = (fn) => {
    const a = JSON.parse(s.getItem('jqm.resume.v1.maths'));
    fn(a);
    s.setItem('jqm.resume.v1.maths', JSON.stringify(a));
    assert.equal(loadAnchor('maths', s), null);
    saveAnchor(base(), s); // restore for next case
  };
  tamper((a) => { a.qIndex = 'four'; });
  tamper((a) => { delete a.quizUuid; });
  tamper((a) => { a.qIndex = 99; }); // past the end
  tamper((a) => { a.order = 'not-array'; });
  tamper((a) => { a.questions = []; });
  tamper((a) => { a.mode = 'driveby'; });
  s.setItem('jqm.resume.v1.maths', 'not-json{{{');
  assert.equal(loadAnchor('maths', s), null);
});

test('stale anchor (>7d) is treated as expired', () => {
  const s = new MemStore();
  const a = saveAnchor(base(), s);
  const old = JSON.parse(s.getItem('jqm.resume.v1.maths'));
  old.savedAt = a.savedAt - RESUME_TTL_MS - 1000;
  s.setItem('jqm.resume.v1.maths', JSON.stringify(old));
  assert.equal(loadAnchor('maths', s), null);
});

test('explore-mode runs are never offered for resume', () => {
  const s = new MemStore();
  assert.equal(saveAnchor({ ...base(), mode: 'explore' }, s), null);
  assert.equal(loadAnchor('maths', s), null);
  assert.equal(resumeHref(base()), null); // no deep-link routing today
});
