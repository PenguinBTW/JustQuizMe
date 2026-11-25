import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCurrentSave } from '../public/shared/js/saveSelection.js';

const cached = { title: 'cached quiz' };
const fresh = { title: 'fresh quiz' };

test('authoritative empty server response is not overridden by stale cache', () => {
  // server answered: no save exists (discarded, perhaps in another tab)
  assert.equal(pickCurrentSave(null, true, cached), null);
  assert.equal(pickCurrentSave(undefined, true, cached), null);
});

test('server save wins over cache when both exist', () => {
  assert.equal(pickCurrentSave(fresh, true, cached), fresh);
});

test('cache is fallback only when the fetch failed', () => {
  assert.equal(pickCurrentSave(null, false, cached), cached);
  assert.equal(pickCurrentSave(fresh, false, cached), fresh);
  assert.equal(pickCurrentSave(null, false, null), null);
});
