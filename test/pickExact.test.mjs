// pickExact exactness + fallback correctness across all three portals.
// The synthesized-paper builder is assessment-critical: a paper must hit the
// requested total exactly when the bank allows it, and overshoot as little as
// possible when it cannot.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const portals = [
  ['cs', '../public/cs/js/taxonomy.js'],
  ['maths', '../public/maths/js/taxonomy.js'],
  ['physics', '../public/physics/js/taxonomy.js'],
];

const q = (id, marks) => ({ id, marks, type: 'written' });

for (const [name, path] of portals) {
  const mod = await import(path);
  const { pickExact } = mod;

  test(`${name}: hits the exact target when a combination exists`, () => {
    const pool = [q('a', 3), q('b', 3), q('c', 3), q('d', 4), q('e', 2)];
    for (let i = 0; i < 20; i++) {
      const { set, tot } = pickExact(pool, 6);
      assert.equal(tot, 6);
      assert.equal(set.reduce((s, x) => s + x.marks, 0), 6);
    }
  });

  test(`${name}: largest exact total under target when exact is impossible`, () => {
    const pool = [q('a', 4), q('b', 4), q('c', 4)];
    const { tot } = pickExact(pool, 5);
    assert.equal(tot, 4);
  });

  test(`${name}: fallback picks the SMALLEST question, not a random one`, () => {
    // nothing fits a 5-mark target; old behavior returned pool[0] — with a
    // shuffled pool that was as often the 20-mark question as the 8-mark one,
    // overshooting the requested paper by 15 marks instead of 3
    const pool = [q('big', 20), q('mid', 12), q('small', 8)];
    for (let i = 0; i < 10; i++) {
      const { set, tot } = pickExact(pool, 5);
      assert.equal(tot, 8);
      assert.equal(set[0].id, 'small');
    }
  });

  test(`${name}: empty pool yields an empty paper`, () => {
    const { set, tot } = pickExact([], 10);
    assert.deepEqual(set, []);
    assert.equal(tot, 0);
  });

  test(`${name}: no question is picked twice`, () => {
    const pool = [q('x', 2), q('y', 2), q('z', 2)];
    const { set } = pickExact(pool, 6);
    const ids = set.map(x => x.id);
    assert.equal(new Set(ids).size, ids.length);
  });
}
