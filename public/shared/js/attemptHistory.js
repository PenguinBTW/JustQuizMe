// attemptHistory.js — pure model + render-strings for the "Attempt history"
// panel on a portal landing view. DOM-free: takes raw score entries (the same
// feed the streak widget reads) and returns HTML strings; the portal decides
// where to mount them.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmtDuration = (seconds) => {
  const s = Math.max(0, Math.round(+seconds || 0));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

export const fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

/** Raw score entry → normalized attempt row. Tolerant of missing fields. */
export function normalizeEntry(e) {
  const score = +e.score || 0;
  const total = +e.total || 0;
  return {
    ref: e.quizFile || e.quizUuid || 'unknown',
    title: e.quizTitle || e.quizFile || 'Untitled quiz',
    mode: e.exam ? 'exam' : 'quiz',
    version: e.quizVersion ?? null,
    uuid: e.quizUuid || null,
    score,
    total,
    pct: total ? Math.round(score / total * 100) : 0,
    seconds: +e.seconds || (+e.minutes || 0) * 60,
    date: e.date || null,
  };
}

/** Newest-first list of normalized attempts (entries lacking a date sort last). */
export function listAttempts(scores, { limit = Infinity } = {}) {
  const rows = (Array.isArray(scores) ? scores : []).map(normalizeEntry);
  rows.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  return rows.slice(0, limit);
}

/** One expandable row: summary line + detail body. */
export function rowHtml(a) {
  return `
  <details class="ah-row">
    <summary>
      <span class="ah-title">${esc(a.title)}</span>
      <span class="ah-meta mono">${a.mode}${a.version ? ` · v${esc(a.version)}` : ''}</span>
      <span class="ah-score mono">${a.score}/${a.total} <span class="ah-pct">${a.pct}%</span></span>
      <span class="ah-date mono">${esc(fmtDate(a.date))}</span>
    </summary>
    <div class="ah-detail mono">
      <span>ref: ${esc(a.ref)}</span>
      ${a.uuid && a.uuid !== a.ref ? `<span>id: ${esc(a.uuid)}</span>` : ''}
      <span>duration: ${fmtDuration(a.seconds)}</span>
      <span>mode: ${a.mode === 'exam' ? 'exam conditions' : 'practice'}</span>
      ${a.date ? `<span>finished: ${esc(new Date(a.date).toISOString())}</span>` : ''}
    </div>
  </details>`;
}

/** Full panel markup; empty feed renders the empty state. */
export function sectionHtml(scores, { title = 'Attempt history', limit = 12 } = {}) {
  const rows = listAttempts(scores, { limit });
  const body = rows.length
    ? rows.map(rowHtml).join('')
    : `<p class="mono" style="font-size:12px; color:var(--ink-muted); margin:0;">No attempts logged yet — finished quizzes land here.</p>`;
  return `
  <section class="attempt-history">
    <div class="ah-head">
      <h3 class="serif">${esc(title)}</h3>
      <span class="mono ah-count">${rows.length} attempt${rows.length === 1 ? '' : 's'}</span>
    </div>
    <div class="ah-list">${body}</div>
  </section>`;
}
