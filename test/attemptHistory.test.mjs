import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntry, listAttempts, fmtDuration, rowHtml, sectionHtml } from '../public/shared/js/attemptHistory.js';

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
