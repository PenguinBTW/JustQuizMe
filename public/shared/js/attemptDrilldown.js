// Attempt-history drill-down — pure functions, no DOM dependencies.
// Reconstructs what a saved score entry honestly knows: per-question records
// when present, a clearly-labelled summary-only view for legacy entries.

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// filterAttempts(entries, {topic, mode, from, to, search}) → filtered list, order preserved
export function filterAttempts(entries, { topic, mode, from, to, search } = {}) {
  return (entries || []).filter(e => {
    if (!e || typeof e !== 'object') return false;
    if (mode === 'exam' && !e.exam) return false;
    if (mode === 'quiz' && e.exam) return false;
    if (mode === 'flashcards' && !(e.flashcard || e.type === 'flashcards')) return false;
    if (topic) {
      const topics = entryTopics(e);
      if (!topics.some(t => t.toLowerCase().includes(topic.toLowerCase()))) return false;
    }
    if (from) { const d = new Date(e.date); if (!(d >= new Date(from))) return false; }
    if (to) { const d = new Date(e.date); if (!(d <= new Date(to + 'T23:59:59'))) return false; }
    if (search) {
      const hay = `${e.quizTitle || ''} ${e.quizFile || ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}

function entryTopics(e) {
  if (Array.isArray(e.perQuestion) && e.perQuestion.length)
    return [...new Set(e.perQuestion.map(q => q && q.topic).filter(Boolean))];
  if (Array.isArray(e.topics)) return e.topics.filter(Boolean);
  return [];
}

// drilldownHtml(entry) — full reconstruction of one attempt.
export function drilldownHtml(e) {
  if (!e || typeof e !== 'object') return '';
  const pct = Math.round((e.score / (e.total || 1)) * 100);
  const head = `
    <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:baseline; margin-bottom:12px;">
      <strong style="font-size:16px;">${esc(e.quizTitle || 'Assessment')}</strong>
      <span class="pill ${e.exam ? 'red' : ''}">${e.exam ? 'Exam' : 'Quiz'}${e.flashcard || e.type === 'flashcards' ? ' · flashcards' : ''}</span>
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">${e.minutes != null ? `${e.minutes}m ${(e.seconds || 0) % 60}s` : 'time not recorded'}</span>
      <span class="mono" style="font-size:14px; font-weight:700; color:var(--accent);">${e.score}/${e.total} (${pct}%)</span>
    </div>`;
  const pq = Array.isArray(e.perQuestion) ? e.perQuestion.filter(q => q && typeof q === 'object') : [];
  if (!pq.length) {
    return head + `
      <div class="mono" style="font-size:12px; color:#e0a75f; padding:8px 10px; border-left:3px solid #e0a75f; background:rgba(224,167,95,.07); border-radius:4px;">
        summary-only record — this attempt predates per-question recording; only the aggregate score is honestly known.
      </div>
      ${entryTopics(e).length ? `<div style="font-size:12.5px; margin-top:8px;" class="mono">topics: ${entryTopics(e).map(esc).join(' · ')}</div>` : ''}`;
  }
  const rows = pq.map((q, i) => {
    const qpct = q.marks ? Math.round((q.score / q.marks) * 100) : 0;
    const color = !q.attempted ? 'var(--ink-muted)' : qpct >= 70 ? 'var(--accent)' : qpct >= 40 ? '#e0a75f' : '#e0735f';
    return `<tr>
      <td class="mono" style="font-size:12px; padding:4px 8px;">${i + 1}</td>
      <td style="font-size:12.5px; padding:4px 8px;">${esc(q.subtopic || q.topic || '—')}</td>
      <td class="mono" style="font-size:12px; padding:4px 8px; color:var(--ink-muted);">${esc(q.type || '')}</td>
      <td class="mono" style="font-size:12.5px; padding:4px 8px; color:${color}; font-weight:700;">${q.attempted ? `${q.score}/${q.marks}` : 'unattempted'}</td>
    </tr>`;
  }).join('');
  return head + `
    <table style="width:100%; border-collapse:collapse;">
      <thead><tr class="mono" style="font-size:10.5px; color:var(--ink-muted); text-align:left;">
        <th style="padding:4px 8px;">#</th><th style="padding:4px 8px;">TOPIC</th><th style="padding:4px 8px;">TYPE</th><th style="padding:4px 8px;">RESULT</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>`;
}

// compareAttempts(entries, quizUuid) — same paper taken more than once:
// per-topic deltas newest vs previous. Returns null when not comparable.
export function compareAttempts(entries, quizUuid) {
  const runs = (entries || []).filter(e => e && e.quizUuid === quizUuid && e.quizUuid !== 'flashcards')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (runs.length < 2) return null;
  const prev = runs[runs.length - 2], last = runs[runs.length - 1];
  const topicScores = e => {
    const m = new Map();
    const pq = Array.isArray(e.perQuestion) ? e.perQuestion : [];
    for (const q of pq) {
      if (!q || !q.topic || !q.marks) continue;
      const cur = m.get(q.topic) || { got: 0, avail: 0 };
      cur.got += Math.min(q.marks, Math.max(0, +q.score || 0));
      cur.avail += q.marks;
      m.set(q.topic, cur);
    }
    return m;
  };
  const a = topicScores(prev), b = topicScores(last);
  const topics = [...new Set([...a.keys(), ...b.keys()])];
  const deltas = topics.map(t => {
    const pa = a.get(t), pb = b.get(t);
    const pPct = pa && pa.avail ? pa.got / pa.avail : null;
    const lPct = pb && pb.avail ? pb.got / pb.avail : null;
    return { topic: t, prev: pPct, last: lPct, delta: pPct != null && lPct != null ? lPct - pPct : null };
  }).filter(d => d.delta != null);
  return {
    prevDate: prev.date, lastDate: last.date,
    totalDelta: (last.score / (last.total || 1)) - (prev.score / (prev.total || 1)),
    deltas,
  };
}

// compareHtml(cmp) — improvement green, regression red, honest neutral at 0.
export function compareHtml(cmp) {
  if (!cmp) return '';
  const pct = x => Math.round(x * 100);
  const total = cmp.totalDelta;
  const tColor = total > 0.005 ? 'var(--accent)' : total < -0.005 ? '#e0735f' : 'var(--ink-muted)';
  const rows = cmp.deltas
    .sort((x, y) => x.delta - y.delta)
    .map(d => {
      const c = d.delta > 0.005 ? 'var(--accent)' : d.delta < -0.005 ? '#e0735f' : 'var(--ink-muted)';
      const arrow = d.delta > 0.005 ? '▲' : d.delta < -0.005 ? '▼' : '·';
      return `<div style="display:flex; justify-content:space-between; font-size:12.5px; padding:3px 0;">
        <span>${esc(d.topic)}</span>
        <span class="mono" style="color:${c};">${arrow} ${pct(d.prev)}% → ${pct(d.last)}%</span>
      </div>`;
    }).join('');
  return `
    <div style="margin-top:12px; padding:10px 12px; border:1px solid var(--border); border-radius:8px;">
      <div class="mono" style="font-size:11px; color:var(--ink-muted); margin-bottom:6px;">
        VS PREVIOUS ATTEMPT · overall <span style="color:${tColor}; font-weight:700;">${total >= 0 ? '+' : ''}${pct(total)}%</span>
      </div>
      ${rows || '<div class="mono" style="font-size:12px; color:var(--ink-muted);">no overlapping per-question topics to compare</div>'}
    </div>`;
}
