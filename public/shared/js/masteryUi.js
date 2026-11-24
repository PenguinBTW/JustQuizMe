// Shared mastery UI helpers — HTML-string builders, no DOM dependency.
// Used by all three portals' topic-list views (cs/maths/physics).

// Minimal topic resolution: score entries carry topics[] written at finish time.
export function resolveScoreTopics(s) {
  return Array.isArray(s?.topics) ? s.topics.filter(t => typeof t === 'string') : [];
}

// Small pill: red pct⚠ when weak, green pct% when fine, grey 'new' when unpracticed.
export function masteryBadge(row) {
  if (!row) return '<span class="mastery-badge mastery-new" title="No practice history yet">new</span>';
  const pct = Math.round(row.mastery * 100);
  const cls = row.weak ? 'mastery-weak' : 'mastery-ok';
  const label = row.weak ? 'needs review' : 'mastery';
  return `<span class="mastery-badge ${cls}" title="${label} — ${pct}% over ${row.runs} run${row.runs === 1 ? '' : 's'}${row.daysSince != null ? `, last practiced ${row.daysSince}d ago` : ''}">${pct}%${row.weak ? ' ⚠' : ''}</span>`;
}
