import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntry, listAttempts, fmtDuration, rowHtml, sectionHtml, quizAttempts, quizStats, quizHistoryHtml } from '../public/shared/js/attemptHistory.js';

const mk = (over = {}) => ({
  quizUuid: 'u1', quizFile: 'pure_2023.json', quizTitle: 'Pure 2023',
  score: 40, total: 50, seconds: 750, exam: false, date: '2026-11-20T10:00:00Z',
  ...over,
});

test('empty feed renders the empty state', () => {
  const html = sectionHtml([]);
  assert.match(html, /No attempts logged yet/);
  assert.match(html, /0 attempts/);
  assert.equal(sectionHtml(null).match(/No attempts logged yet/) != null, true);
});

test('listAttempts sorts newest-first and respects limit', () => {
  const rows = listAttempts([
    mk({ quizTitle: 'old', date: '2026-11-01T10:00:00Z' }),
    mk({ quizTitle: 'new', date: '2026-11-22T10:00:00Z' }),
    mk({ quizTitle: 'mid', date: '2026-11-10T10:00:00Z' }),
  ]);
  assert.deepEqual(rows.map(r => r.title), ['new', 'mid', 'old']);
  assert.equal(listAttempts([mk(), mk()], { limit: 1 }).length, 1);
  // entries without a date sort last
  const mixed = listAttempts([mk({ quizTitle: 'nodate', date: null }), mk({ quizTitle: 'dated' })]);
  assert.equal(mixed[0].title, 'dated');
});

test('normalizeEntry handles missing fields and formats pct', () => {
  const a = normalizeEntry({ score: 3, total: 4 });
  assert.equal(a.pct, 75);
  assert.equal(a.mode, 'quiz');
  assert.equal(a.ref, 'unknown');
  assert.equal(normalizeEntry({ exam: true }).mode, 'exam');
  assert.equal(fmtDuration(0), '0s');
  assert.equal(fmtDuration(75), '1m 15s');
  assert.equal(fmtDuration(3700), '1h 1m');
});

test('rows from multiple quizzes each render', () => {
  const html = sectionHtml([mk({ quizTitle: 'P1' }), mk({ quizTitle: 'Stats A', quizFile: 'stats_a.json' })]);
  assert.match(html, /P1/);
  assert.match(html, /Stats A/);
  assert.match(html, /stats_a\.json/);
  assert.match(html, /2 attempts/);
});

test('malformed stored timestamps do not throw', () => {
  const html = rowHtml(normalizeEntry({ quizTitle: 'x', date: 'not-a-date' }));
  assert.match(html, /finished: not-a-date/);
  assert.match(html, /—/);
});

test('escapes HTML in titles and refs', () => {
  const html = rowHtml(normalizeEntry({ quizTitle: '<b>x</b>', quizFile: 'f<1>.json' }));
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /f&lt;1&gt;\.json/);
  assert.equal(html.includes('<b>x</b>'), false);
});

// ---- per-quiz history (cs picker) -------------------------------------------

test('quizAttempts matches on quizFile or quizUuid, newest-first', () => {
  const feed = [
    mk({ quizTitle: 'same file old', date: '2026-11-01T10:00:00Z' }),
    mk({ quizTitle: 'other quiz', quizFile: 'other.json', quizUuid: 'u2' }),
    mk({ quizTitle: 'same uuid', quizFile: 'renamed.json', quizUuid: 'u1', date: '2026-11-22T10:00:00Z' }),
  ];
  const rows = quizAttempts(feed, { file: 'pure_2023.json', uuid: 'u1' });
  assert.deepEqual(rows.map(r => r.title), ['same uuid', 'same file old']);
  assert.equal(quizAttempts(feed, { file: 'other.json' }).length, 1);
  assert.equal(quizAttempts(feed, {}).length, 0);
  assert.equal(quizAttempts(null, { file: 'x' }).length, 0);
});

test('quizStats reports count, best, last and the last-vs-prev trend', () => {
  const rows = listAttempts([
    mk({ score: 20, total: 50, date: '2026-11-10T10:00:00Z' }), // older, 40%
    mk({ score: 45, total: 50, date: '2026-11-20T10:00:00Z' }), // newest, 90%
    mk({ score: 30, total: 50, date: '2026-11-15T10:00:00Z' }), // middle, 60%
  ]);
  assert.deepEqual(quizStats(rows), { count: 3, best: 90, last: 90, trend: 'up' });
  assert.equal(quizStats(rows.slice(0, 2).reverse()).trend, 'down');
  assert.deepEqual(quizStats([]), { count: 0, best: 0, last: 0, trend: 'flat' });
  assert.equal(quizStats([mk()]).trend, 'flat'); // single attempt: no direction
});

test('quizHistoryHtml renders collapsed details with badge + rows', () => {
  const feed = [
    mk({ score: 40, total: 50, exam: true, date: '2026-11-20T10:00:00Z' }),
    mk({ quizTitle: 'other', quizFile: 'other.json', quizUuid: 'u2' }),
  ];
  const html = quizHistoryHtml(feed, { file: 'pure_2023.json' });
  assert.match(html, /<details class="qh">/);
  assert.match(html, /1 attempt · best 80% →/);
  assert.match(html, /exam/);
  assert.match(html, /40\/50/);
  assert.match(html, /12m 30s/); // 750s
  assert.doesNotMatch(html, /other/);
});

test('quizHistoryHtml renders an inert badge for a fresh quiz', () => {
  const html = quizHistoryHtml([], { file: 'nothing.json' });
  assert.equal(html.includes('<details'), false);
  assert.match(html, /no attempts yet/);
});

test('quizHistoryHtml escapes injected content', () => {
  const html = quizHistoryHtml([mk({ date: '<script>' })], { file: 'pure_2023.json' });
  assert.equal(html.includes('<script>'), false);
});
