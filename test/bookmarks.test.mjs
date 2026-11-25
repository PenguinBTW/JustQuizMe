import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bookmarkKey,
  makeBookmark,
  normalizeBookmarks,
  isBookmarked,
  scopedQuizLike,
  stripTags
} from '../public/shared/js/bookmarks.js';

test('bookmarkKey composes category|file|qid', () => {
  assert.equal(bookmarkKey({ category: 'normal', file: 'a.json', qid: 'Q1' }), 'normal|a.json|Q1');
  assert.equal(bookmarkKey({ file: 'a.json', qid: 'Q1' }), '|a.json|Q1');
});

test('makeBookmark derives identity and snippet', () => {
  const b = makeBookmark(
    { id: 'Q3', topic: 'Integration', promptHtml: '<p>Show <em>that</em>  ∫ x dx = x²/2 + c for all x</p>' },
    { category: 'normal', file: 'int.json', title: 'Calculus Set', uuid: 'u1' },
    4
  );
  assert.equal(b.key, 'normal|int.json|Q3');
  assert.equal(b.index, 4);
  assert.equal(b.quizTitle, 'Calculus Set');
  assert.equal(b.topic, 'Integration');
  assert.match(b.snippet, /Show that/);
  assert.ok(!b.snippet.includes('<'));
});

test('src overrides win over meta for pooled runs', () => {
  const b = makeBookmark({ id: 'Q9', _srcFile: 'pool.json', _srcCat: 'past-paper' }, { category: 'normal', file: 'mix' }, 0);
  assert.equal(b.key, 'past-paper|pool.json|Q9');
});

test('normalizeBookmarks dedupes by key and sorts newest-first', () => {
  const list = normalizeBookmarks([
    { qid: 'A', file: 'f', category: 'n', addedAt: '2024-01-01' },
    { qid: 'B', file: 'f', category: 'n', addedAt: '2025-01-01' },
    { qid: 'A', file: 'f', category: 'n', addedAt: '2024-06-01' },
    { bad: true }
  ]);
  assert.deepEqual(list.map(b => b.qid), ['B', 'A']);
  assert.equal(list.length, 2);
});

test('isBookmarked matches by key regardless of extra fields', () => {
  const list = normalizeBookmarks([{ qid: 'A', file: 'f', category: 'n', addedAt: '1' }]);
  assert.ok(isBookmarked(list, { category: 'n', file: 'f', qid: 'A' }));
  assert.ok(!isBookmarked(list, { category: 'n', file: 'f', qid: 'B' }));
});

test('scopedQuizLike honours index hint then falls back to id search', () => {
  const quiz = { uuid: 'u', version: 2, title: 'Set', questions: [{ id: 'Q1' }, { id: 'Q2' }] };
  const hint = scopedQuizLike({ qid: 'Q2', index: 1, file: 'f', category: 'n' }, quiz);
  assert.equal(hint.questions.length, 1);
  assert.equal(hint.questions[0].id, 'Q2');
  const searched = scopedQuizLike({ qid: 'Q1', index: 9, file: 'f', category: 'n' }, quiz);
  assert.equal(searched.questions[0].id, 'Q1');
  assert.equal(scopedQuizLike({ qid: 'ZZ', file: 'f' }, quiz), null);
  assert.equal(scopedQuizLike({ qid: 'Q1' }, null), null);
});

test('stripTags collapses markup and whitespace', () => {
  assert.equal(stripTags('<p>a <b>b</b>  c</p>'), 'a b c');
  assert.equal(stripTags(''), '');
});
