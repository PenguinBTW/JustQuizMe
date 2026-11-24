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

// --- resumeTick: autosave ownership across tabs (mount-level guard) ----------

test('resumeTick: idle second tab cannot clobber a different quiz\'s anchor', async () => {
  const { resumeTick } = await import('../public/shared/js/mountResume.js');
  const s = new MemStore();
  // Tab A is working quiz q-1.
  const mineA = { savedAt: 0, sig: null };
  const snapA = () => base();
  resumeTick({ portal: 'maths', snapshot: snapA, isDone: () => null, store: s, mine: mineA });
  assert.equal(loadAnchor('maths', s).quizUuid, 'q-1');
  // Tab B idles on an older different quiz — foreign save must stand.
  const mineB = { savedAt: 0, sig: null };
  const snapB = () => ({ ...base(), quizUuid: 'q-0', elapsed: 20 });
  resumeTick({ portal: 'maths', snapshot: snapB, isDone: () => null, store: s, mine: mineB });
  resumeTick({ portal: 'maths', snapshot: snapB, isDone: () => null, store: s, mine: mineB });
  assert.equal(loadAnchor('maths', s).quizUuid, 'q-1', 'idle tab overwrote a newer anchor');
  // ...but real new progress in tab B does take over.
  resumeTick({ portal: 'maths', snapshot: () => ({ ...snapB(), qIndex: 2 }), isDone: () => null, store: s, mine: mineB });
  assert.equal(loadAnchor('maths', s).quizUuid, 'q-0');
});

test('resumeTick: a stale relaunch of the same set cannot erase progress', async () => {
  const { resumeTick } = await import('../public/shared/js/mountResume.js');
  const s = new MemStore();
  const mineA = { savedAt: 0, sig: null };
  resumeTick({ portal: 'maths', snapshot: () => base(), isDone: () => null, store: s, mine: mineA });
  // A relaunched copy of the same question set restarts at low elapsed.
  const mineR = { savedAt: 0, sig: null };
  const fresh = () => ({ ...base(), qIndex: 0, answers: {}, elapsed: 3 });
  resumeTick({ portal: 'maths', snapshot: fresh, isDone: () => null, store: s, mine: mineR });
  assert.equal(loadAnchor('maths', s).qIndex, 4, 'relaunch erased the further-along save');
  // A deliberate restart doing real work (typing a draft) does save.
  resumeTick({ portal: 'maths', snapshot: () => ({ ...fresh(), answers: { a: { locked: false, value: 'x' } }, elapsed: 12 }), isDone: () => null, store: s, mine: mineR });
  assert.equal(loadAnchor('maths', s).qIndex, 0, 'deliberate restart could not save its own work');
  assert.deepEqual(loadAnchor('maths', s).answers, { a: { locked: false, value: 'x' } });
});

test('resumeTick: a different question set under the same uuid is a new quiz', async () => {
  const { resumeTick } = await import('../public/shared/js/mountResume.js');
  const s = new MemStore();
  const mineA = { savedAt: 0, sig: null };
  resumeTick({ portal: 'maths', snapshot: () => base(), isDone: () => null, store: s, mine: mineA });
  // Same uuid, different order → a re-generated quiz, not a relaunch.
  const mineN = { savedAt: 0, sig: null };
  resumeTick({ portal: 'maths', snapshot: () => ({ ...base(), qIndex: 0, order: ['x', 'y'], answers: {}, elapsed: 2 }), isDone: () => null, store: s, mine: mineN });
  assert.equal(loadAnchor('maths', s).qIndex, 0, 'new generated quiz was blocked as a relaunch');
});

test('resumeTick: a finishing run cannot overwrite a foreign anchor', async () => {
  const { resumeTick } = await import('../public/shared/js/mountResume.js');
  const s = new MemStore();
  // Another tab owns the anchor for quiz q-2.
  const mineA = { savedAt: 0, sig: null };
  resumeTick({ portal: 'maths', snapshot: () => ({ ...base(), quizUuid: 'q-2' }), isDone: () => null, store: s, mine: mineA });
  // This tab's exam for q-9 finishes while grading mutates its snapshot.
  const mineE = { savedAt: 0, sig: null };
  resumeTick({ portal: 'maths', snapshot: () => ({ ...base(), quizUuid: 'q-9', answers: { a: { locked: true }, b: { locked: true } }, elapsed: 300 }), isDone: () => 'q-9', store: s, mine: mineE });
  assert.equal(loadAnchor('maths', s)?.quizUuid, 'q-2', 'finishing exam clobbered a foreign save');
});
