import test from 'node:test';
import assert from 'node:assert/strict';
import { paceMinutesPerMark as csPace } from '../public/cs/js/runner/starters.js';
import { paceMinutesPerMark as mathsPace } from '../public/maths/js/runner/starters.js';
import { paceMinutesPerMark as physicsPace } from '../public/physics/js/runner/starters.js';

for (const [name, pace] of [['cs', csPace], ['maths', mathsPace], ['physics', physicsPace]]) {
  test(`${name}: untimed pace yields no limit (opt-out)`, () => {
    assert.equal(pace('untimed'), null);
  });
  test(`${name}: standard ≈ 1 minute per mark per exam convention`, () => {
    assert.ok(pace('standard') >= 1 && pace('standard') < 1.2);
  });
  test(`${name}: relaxed is more generous than standard, strict is tighter`, () => {
    assert.ok(pace('relaxed') > pace('standard'));
    assert.ok(pace('strict') < pace('standard'));
  });
  test(`${name}: unknown pace falls back to standard`, () => {
    assert.equal(pace('bogus'), pace('standard'));
    assert.equal(pace(undefined), pace('standard'));
  });
}
