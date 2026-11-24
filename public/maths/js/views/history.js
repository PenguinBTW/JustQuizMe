// Maths Attempt History Room View
import { S, MIXED_UUID } from '../state.js';
import { $, esc, num, fmtDate, fmtDur } from '../utils.js';
import { roomNav, wireRoomNav, renderRoom } from '../navigation.js';
import { beginFileQuiz } from '../runner/starters.js';

// retry-missed runs are saved under '<sourceUuid>:retry-missed' — map them
// back to the source uuid only when the entry ends with the marker and its
// base is a real manifest uuid
const RETRY_MARK = ':retry-missed';
const srcUuid = (u) => (u || '').replace(/(:retry-missed)+$/, '');

export function pastEntries() {
  const uuids = new Set([...S.quizzes['past-paper'].map(m => m.uuid), MIXED_UUID]);
  return S.scores.filter(s => uuids.has(s.quizUuid) || uuids.has(srcUuid(s.quizUuid))).slice().reverse();
}

export function practiceEntries() {
  const uuids = new Set(S.quizzes.normal.map(m => m.uuid));
  return S.scores.filter(s => uuids.has(s.quizUuid) || uuids.has(srcUuid(s.quizUuid))).slice().reverse();
}

export function pct(a) {
  return a.total ? Math.round((a.score / a.total) * 100) : 0;
}

export function pillFor(p) {
  return p >= 80 ? 'green' : p >= 60 ? 'amber' : 'red';
}

export function historyEntryHtml(a, retryLabel) {
  const p = pct(a);
  const canRetry = retryLabel && a.quizFile && a.quizFile !== 'mixed' && /\.json$/i.test(a.quizFile);
  return `
    <div class="history-entry">
      <div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
          <strong style="font-size:15.5px;">${esc(a.quizTitle || a.quizFile || 'Mathematics Quiz')}</strong>
          <span class="pill ${a.exam ? 'accent' : ''}">${a.exam ? 'Exam Conditions' : 'Standard Quiz'}</span>
        </div>
        <div class="mono" style="font-size:12px; color:var(--ink-muted);">
          ${fmtDate(a.date)} · ${fmtDur((a.minutes || 0) * 60 + (a.seconds || 0))} · ${a.score}/${a.total} marks (${p}%)
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span class="pill ${pillFor(p)}">${p}% · ${a.score}/${a.total}</span>
        ${
          canRetry
            ? `<button class="btn" style="padding:5px 13px; font-size:12px;" data-retry-entry="${esc(a.quizUuid)}|${esc(a.quizFile)}">${esc(retryLabel)}</button>`
            : ''
        }
      </div>
    </div>
  `;
}

export function renderHistory() {
  const isPast = S.historySrc !== 'practice';
  let body = '';
  if (isPast) {
    const list = pastEntries();
    const bankTotal = S.quizzes['past-paper'].reduce((s, m) => s + m.totalMarks, 0);
    // retry subsets stay listed but don't count toward aggregate stats
    const base = list.filter(x => !(x.quizUuid || '').endsWith(RETRY_MARK));
    const avg = base.length
      ? Math.round(base.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / base.length * 100)
      : 0;
    const earned = base.reduce((s, a) => s + (a.score || 0), 0);

    body = `
      <div id="historyPastView">
        <div class="history-stats-grid">
          <div class="history-stat-card">
            <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Past-Paper Average</span>
            <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${avg}%</div>
            <span class="mono" style="font-size:12px; color:var(--ink-secondary);">${base.length} logged session${base.length === 1 ? '' : 's'}</span>
          </div>
          <div class="history-stat-card">
            <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Marks Completed</span>
            <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${num(earned)} <span style="font-size:20px; color:var(--ink-muted);">/ ${num(bankTotal)}</span></div>
            <span class="mono" style="font-size:12px; color:var(--ink-secondary);">across full past-paper sessions</span>
          </div>
          <div class="history-stat-card">
            <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Success Rate</span>
            <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${bankTotal ? Math.round((earned / bankTotal) * 100) : 0}%</div>
            <span class="mono" style="font-size:12px; color:var(--accent);">Of Entire H240 Specification Bank</span>
          </div>
        </div>
        <div class="card" style="padding: 10px 28px;">
          ${
            list.map(a => historyEntryHtml(a, 'Retry Shuffle')).join('') ||
            '<p class="mono" style="font-size:12.5px; color:var(--ink-muted); padding:18px 0;">No past-paper attempts logged yet.</p>'
          }
        </div>
      </div>
    `;
  } else {
    const list = practiceEntries();
    const runs = list.slice().reverse();
    // retry subsets stay listed but mustn't outrank full sets on the best card
    const base = list.filter(x => !(x.quizUuid || '').endsWith(RETRY_MARK));
    const best = base.length
      ? base.reduce(
          (m, x) => (x.total && x.score / x.total > (m.total ? m.score / m.total : -1) ? x : m),
          base[0]
        )
      : null;
    const bp = best ? pct(best) : 0;
    const ver = best
      ? S.quizzes.normal.find(m => m.uuid === best.quizUuid)?.version ?? best.quizVersion ?? 1
      : '-';

    body = `
      <div id="historyPracticeView">
        <div class="history-stats-grid">
          <div class="history-stat-card">
            <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Topic Set Best</span>
            <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${list.length ? bp + '%' : '-'}</div>
            <span class="mono" style="font-size:12px; color:var(--green);">${best ? `${best.score} / ${best.total} marks` : 'no runs yet'}</span>
          </div>
          <div class="history-stat-card">
            <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Set Version</span>
            <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${list.length ? 'v' + ver : '-'}</div>
            <span class="mono" style="font-size:12px; color:var(--ink-secondary);">${best ? esc((best.quizFile || '').replace(/\.json$/i, '') + '.json') : ''}</span>
          </div>
          <div class="history-stat-card">
            <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Attempts</span>
            <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${runs.length}</div>
            <span class="mono" style="font-size:12px; color:var(--accent);">Completed Curated Sets</span>
          </div>
        </div>
        <div class="card" style="padding: 10px 28px;">
          ${
            list.map(a => historyEntryHtml(a, 'Retry Set')).join('') ||
            '<p class="mono" style="font-size:12.5px; color:var(--ink-muted); padding:18px 0;">No topic-set attempts logged yet.</p>'
          }
        </div>
      </div>
    `;
  }

  $('#stage').innerHTML = `
    ${roomNav('history')}
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
      <div>
        <h2 class="serif" style="font-size: 28px; line-height: 1.15;">Recorded Sessions &amp; Telemetry</h2>
        <p style="font-size: 13.5px; color: var(--ink-secondary);">Every completed attempt audited newest-first with score verification.</p>
      </div>
      <div class="segmented">
        <button class="${isPast ? 'active' : ''}" id="histTabPast">Past Papers (${pastEntries().length})</button>
        <button class="${!isPast ? 'active' : ''}" id="histTabPractice">Topic Sets (${practiceEntries().length})</button>
      </div>
    </div>
    ${body}
  `;

  wireRoomNav();
  $('#histTabPast').onclick = () => {
    S.historySrc = 'past';
    renderRoom();
  };
  $('#histTabPractice').onclick = () => {
    S.historySrc = 'practice';
    renderRoom();
  };
  document.querySelectorAll('[data-retry-entry]').forEach(b => {
    b.onclick = () => {
      const [uuid, file] = b.dataset.retryEntry.split('|');
      const inNormal = S.quizzes.normal.some(m => m.file === file);
      beginFileQuiz(inNormal ? 'normal' : 'past-paper', file, !inNormal);
    };
  });
}
