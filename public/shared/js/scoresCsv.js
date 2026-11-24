// JustQuizMe scores → CSV — pure builder, no DOM.
// RFC-4180 output: CRLF row separators, double-quote escaping for any field
// containing a comma, quote, CR, or LF.

import { topicsFor } from './stats.js';

export const CSV_HEADERS = [
  'date',
  'portal',
  'quizTitle',
  'topic',
  'score',
  'maxScore',
  'pct',
  'mode',
  'durationSec'
];

// One field: quote only when the value can break the row layout.
export function csvField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ISO-normalize a stored date; scores.json is user-writable via the API, so
// malformed values must never throw — fall back to the raw string.
export function csvDate(d) {
  if (d instanceof Date) return d.toISOString();
  if (typeof d !== 'string' && typeof d !== 'number') return '';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toISOString();
}

// Topics a run covered, joined for a single cell.
function topicsCell(score, uuidIndex) {
  try {
    return topicsFor(score, uuidIndex).join('; ');
  } catch {
    return '';
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pctOf(score, total) {
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
}

// buildScoresCsv(runs, { portal, uuidIndex }) → full CSV text.
// Row order follows the stored order (newest-first in scores.json).
export function buildScoresCsv(runs, { portal = '', uuidIndex = {} } = {}) {
  const lines = [CSV_HEADERS.join(',')];
  for (const s of runs || []) {
    if (!s || typeof s !== 'object') continue;
    const score = num(s.score);
    const total = num(s.total);
    const row = [
      csvDate(s.date),
      portal,
      typeof s.quizTitle === 'string' ? s.quizTitle : '',
      topicsCell(s, uuidIndex),
      score,
      total,
      pctOf(score, total),
      s.exam ? 'exam' : 'quiz',
      num(s.seconds)
    ];
    lines.push(row.map(csvField).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
