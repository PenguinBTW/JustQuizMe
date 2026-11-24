// Shared mastery UI helpers — HTML-string builders, no DOM dependency.
// Used by all three portals' topic-list views (cs/maths/physics).

import { topicsFor } from './stats.js';

// Topic resolution: entries written at finish time carry topics[]; older or
// ordinary-file entries fall back to topicsFor's chain (quizTitle prefix etc.).
export function resolveScoreTopics(s, uuidIndex = {}) {
  const direct = Array.isArray(s?.topics) ? s.topics.filter(t => typeof t === 'string') : [];
  if (direct.length) return direct;
  try { return topicsFor(s, uuidIndex); } catch { return []; }
}

// Build the uuid→topics lookup from the portal's quiz metadata so topicsFor
// can recover canonical topics for older file-backed entries.
export function buildUuidIndex(quizzes) {
  const idx = {};
  for (const cat of Object.values(quizzes || {})) {
    for (const q of cat || []) {
      if (q?.uuid && Array.isArray(q.topics) && q.topics.length) idx[q.uuid] = q.topics;
    }
  }
  return idx;
}

// Small pill: red pct⚠ when weak, green pct% when fine, grey 'new' when unpracticed.
export function masteryBadge(row) {
  if (!row) return '<span class="mastery-badge mastery-new" title="No practice history yet">new</span>';
  const pct = Math.round(row.mastery * 100);
  const cls = row.weak ? 'mastery-weak' : 'mastery-ok';
  const label = row.weak ? 'needs review' : 'mastery';
  return `<span class="mastery-badge ${cls}" title="${label} — ${pct}% over ${row.runs} run${row.runs === 1 ? '' : 's'}${row.daysSince != null ? `, last practiced ${row.daysSince}d ago` : ''}">${pct}%${row.weak ? ' ⚠' : ''}</span>`;
}
