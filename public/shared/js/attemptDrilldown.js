// Attempt-history drill-down — pure functions, no DOM dependencies.
// Reconstructs what a saved score entry honestly knows: per-question records
// when present, a clearly-labelled summary-only view for legacy entries.

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// filterAttempts(entries, {topic, mode, from, to, search}) → filtered list, order preserved
export function filterAttempts(entries, { topic, mode, from, to, search } = {}) {
  return (entries || []).filter(e => {
    if (!e || typeof e !== 'object') return false;
    const fc = !!(e.flashcard || e.type === 'flashcards');
    if (mode === 'exam' && (!e.exam || fc)) return false;
    if (mode === 'quiz' && (e.exam || fc)) return false;
    if (mode === 'flashcards' && !fc) return false;
    if (!mode && false) return false;
    if (mode === 'flashcards' && !(e.flashcard || e.type === 'flashcards')) return false;
    if (topic) {
      const topics = entryTopics(e);
      if (!topics.some(t => t.toLowerCase().includes(topic.toLowerCase()))) return false;
    }
    // date inputs are local calendar days — compare in local time, end inclusive
    if (from) { const d = new Date(e.date); if (!(d >= new Date(from + 'T00:00:00'))) return false; }
    if (to) {
      const end = new Date(to + 'T00:00:00');
      end.setDate(end.getDate() + 1);
      if (!(new Date(e.date) < end)) return false;
    }
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
// time/breakdown label — scores.json is user-writable JSON, so coerce every
// interpolated value to a finite number; a crafted string must never reach the HTML.
function timeLabel(e) {
  // +null coerces to 0 — a missing value is not zero seconds, it is unknown.
  // presence must be established before the numeric coercion means anything.
  let base = 'time not recorded';
  if (e.seconds != null && Number.isFinite(+e.seconds)) {
    const sec = Math.max(0, Math.floor(+e.seconds));
    base = `${Math.floor(sec / 60)}m ${sec % 60}s`;
  } else if (e.minutes != null && Number.isFinite(+e.minutes)) {
    base = `${Math.max(0, Math.floor(+e.minutes))}m`;
  }
  const c = e.breakdown && e.breakdown.coding;
  if (c && c.got != null && c.total != null && Number.isFinite(+c.got) && Number.isFinite(+c.total)) {
    // fractional marks are real — rounding them away misreports the result
    const fmt = (v) => {
      const n = +v;
      return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
    };
    base += ` · coding ${fmt(c.got)}/${fmt(c.total)}`;
  }
  return base;
}

export function drilldownHtml(e) {
  if (!e || typeof e !== 'object') return '';
  const eScore = Number.isFinite(+e.score) ? +e.score : 0;
  const eTotal = Number.isFinite(+e.total) && +e.total > 0 ? +e.total : 1;
  const pct = Math.round((eScore / eTotal) * 100);
  const head = `
    <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:baseline; margin-bottom:12px;">
      <strong style="font-size:16px;">${esc(e.quizTitle || 'Assessment')}</strong>
      <span class="pill ${e.exam ? 'red' : ''}">${e.exam ? 'Exam' : 'Quiz'}${e.flashcard || e.type === 'flashcards' ? ' · flashcards' : ''}</span>
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">${timeLabel(e)}</span>
      <span class="mono" style="font-size:14px; font-weight:700; color:var(--accent);">${eScore}/${eTotal} (${pct}%)</span>
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
    // coerce to finite numbers — scores.json is user-writable; raw values
    // must never reach the HTML as markup.
    const qm = Number.isFinite(+q.marks) ? +q.marks : 0;
    const qs = Number.isFinite(+q.score) ? +q.score : 0;
    const qpct = qm ? Math.round((qs / qm) * 100) : 0;
    const color = !q.attempted ? 'var(--ink-muted)' : qpct >= 70 ? 'var(--accent)' : qpct >= 40 ? '#e0a75f' : '#e0735f';
    return `<tr>
      <td class="mono" style="font-size:12px; padding:4px 8px;">${i + 1}</td>
      <td style="font-size:12.5px; padding:4px 8px;">${esc(q.subtopic || q.topic || '—')}</td>
      <td class="mono" style="font-size:12px; padding:4px 8px; color:var(--ink-muted);">${esc(q.type || '')}</td>
      <td class="mono" style="font-size:12.5px; padding:4px 8px; color:${color}; font-weight:700;">${q.attempted ? `${qs}/${qm}` : 'unattempted'}</td>
    </tr>`;
  }).join('');
  return head + `
    <table style="width:100%; border-collapse:collapse;">
      <thead><tr class="mono" style="font-size:10.5px; color:var(--ink-muted); text-align:left;">
        <th style="padding:4px 8px;">#</th><th style="padding:4px 8px;">TOPIC</th><th style="padding:4px 8px;">TYPE</th><th style="padding:4px 8px;">RESULT</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>`;
}

// contentKeyOf(entry) — a cheap fingerprint of WHICH questions were asked.
// Synthesized mocks can share a quizUuid across genuinely different papers;
// comparing those as "retakes" would show meaningless deltas. Entries without
// per-question records can't be fingerprinted — null, and such entries only
// match other unfingerprinted entries (legacy behaviour, honestly degrading).
function contentKeyOf(e) {
  const pq = Array.isArray(e.perQuestion) ? e.perQuestion : null;
  if (!pq || !pq.length) return null;
  // sorted: a shuffled retake of the same paper is still the same paper;
  // file-qualified key preferred — two mixed papers drawing the same bare
  // ids from different bank files must not share a fingerprint
    // topic+marks in the fingerprint: score writers save bare ids, so two
  // synthesized papers drawing the same id from different banks must not
  // collapse — their topic/marks context almost always differs
  return pq.map(q => q && ((q.key || q.id || q.prompt || '') + '#' + (q.marks ?? ''))).sort().join('|');
}

// compareAttempts(entries, quizUuid) — same paper taken more than once:
// per-topic deltas newest vs previous. Returns null when not comparable.
export function compareAttempts(entries, quizUuid, anchorDate) {
  const anchor = anchorDate ? (entries || []).find(e => e && e.date === anchorDate) : null;
  const ref = anchor || (entries || []).find(e => e && e.quizUuid === quizUuid);
  const refFile = ref && ref.quizFile;
  const refKey = ref ? contentKeyOf(ref) : null;
  // subtopic quizzes share the bank uuid — only same-file runs are true
  // retakes; and when question content is recorded, only runs whose actual
  // paper content matches count (same uuid ≠ same questions for synth mocks)
  const runs = (entries || []).filter(e => e && e.quizUuid === quizUuid && e.quizUuid !== 'flashcards'
    && (!refFile || !e.quizFile || e.quizFile === refFile)
    && (refKey == null || contentKeyOf(e) === refKey))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  if (runs.length < 2) return null;
  // anchor on the attempt being viewed when given (its date); otherwise latest
  let li = runs.length - 1;
  if (anchorDate) {
    const ai = runs.findIndex(r => r.date === anchorDate);
    if (ai >= 0) li = ai;
  }
  if (li < 1) return null; // first ever attempt has no predecessor
  const prev = runs[li - 1], last = runs[li];
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
