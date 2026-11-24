// attemptHistory.js — pure model + render-strings for the "Attempt history"
// panel on a portal landing view. DOM-free: takes raw score entries (the same
// feed the streak widget reads) and returns HTML strings; the portal decides
// where to mount them.

const esc = (s) => {
  // Stored scores are user data: a crafted value with a throwing toString
  // (e.g. Object.create(null)) must not take down the whole panel.
  try {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  } catch {
    return '';
  }
};

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

/** Full timestamp for the detail line; stored entries may carry any junk
 * the scores API accepted, so an unparseable date echoes back verbatim
 * instead of throwing inside toISOString. */
export const fmtFullDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? String(iso) : d.toISOString();
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
      <span class="ah-date mono">${esc(fmtDate(a.date))}<span class="ah-chev">▾</span></span>
    </summary>
    <div class="ah-detail mono">
      <span>ref: ${esc(a.ref)}</span>
      ${a.uuid && a.uuid !== a.ref ? `<span>id: ${esc(a.uuid)}</span>` : ''}
      <span>duration: ${fmtDuration(a.seconds)}</span>
      <span>mode: ${a.mode === 'exam' ? 'exam conditions' : 'practice'}</span>
      ${a.date ? `<span>finished: ${esc(fmtFullDate(a.date))}</span>` : ''}
    </div>
  </details>`;
}

/** Attempts belonging to one quiz — matched on quizFile or quizUuid,
 * newest-first. `ref` = { file?, uuid? } (pass either or both). */
export function quizAttempts(scores, ref = {}) {
  const feed = Array.isArray(scores) ? scores : [];
  const wanted = feed.filter(e => {
    if (ref.uuid && e.quizUuid === ref.uuid) return true;
    // Filename fallback only when either side lacks a uuid — reusing a file
    // name for a rewritten quiz must not inherit the old quiz's attempts.
    return Boolean(ref.file) && e.quizFile === ref.file &&
      (!e.quizUuid || !ref.uuid);
  });
  return listAttempts(wanted);
}

/** Badge stats for one quiz: count, best %, latest %, direction the score
 * moved between the two most recent attempts ('up' | 'down' | 'flat'). */
export function quizStats(rows) {
  const n = Array.isArray(rows) ? rows.length : 0;
  if (!n) return { count: 0, best: 0, last: 0, trend: 'flat' };
  const best = Math.max(...rows.map(r => r.pct));
  const last = rows[0].pct;
  const prev = n > 1 ? rows[1].pct : null;
  const trend = prev == null ? 'flat' : last > prev ? 'up' : last < prev ? 'down' : 'flat';
  return { count: n, best, last, trend };
}

const TREND_GLYPH = { up: '↗', down: '↘', flat: '→' };

/** One compact row for the expanded list. */
function quizRowHtml(a) {
  return `
    <div class="qh-entry">
      <span class="qh-entry-date mono">${esc(fmtDate(a.date))}</span>
      <span class="qh-entry-mode mono">${a.mode}</span>
      <span class="qh-entry-score mono">${a.score}/${a.total} <span class="qh-pct">${a.pct}%</span></span>
      <span class="qh-entry-dur mono">${fmtDuration(a.seconds)}</span>
    </div>`;
}

/** Collapsed-by-default per-quiz history block: a small badge in the row's
 * summary line; expanding shows each past attempt (date, mode, score,
 * duration). Renders an empty "no attempts" badge when the quiz is fresh. */
export function quizHistoryHtml(scores, ref = {}) {
  const rows = quizAttempts(scores, ref);
  const st = quizStats(rows);
  if (!st.count) {
    // Nothing to expand — render the badge inert.
    return `<span class="qh-badge qh-badge-empty mono">no attempts yet</span>`;
  }
  const badge = `${st.count} attempt${st.count === 1 ? '' : 's'} · best ${st.best}% ${TREND_GLYPH[st.trend]}`;
  const body = rows.map(quizRowHtml).join('');
  return `
  <details class="qh">
    <summary><span class="qh-badge mono">${esc(badge)}</span><span class="qh-chev">▾</span></summary>
    <div class="qh-list">${body}</div>
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
