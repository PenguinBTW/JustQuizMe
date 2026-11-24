// Computer Science Navigation & Room Routing Controller
import { S } from './state.js';
import { $, esc, fmtSaved } from './utils.js';
import { api } from './api.js';
import { renderPast } from './views/past.js';
import { renderPractice } from './views/practice.js';
import { renderProgress } from './views/progress.js';
import { renderHistory } from './views/history.js';
import { renderAuthor } from './views/author.js';
import { renderExploreList } from './views/explore.js';
import { beginRun } from './runner/assessment.js';

export function roomNav(active) {
  const nPractice = (S.quizzes.normal || []).length;
  const nPast = (S.quizzes['past-paper'] || []).length;
  const right = active === 'practice'
    ? 'Standard Practice Repository'
    : active === 'history'
      ? 'data/scores.json'
      : `<span style="color:var(--accent); font-weight:600;">${nPast}</span> Examination Series`;

  return `
    <div class="room-nav">
      <div class="room-tabs">
        <button class="room-tab ${active === 'past' ? 'active' : ''}" data-room="past">Past Papers</button>
        ${nPractice > 0 ? `<button class="room-tab ${active === 'practice' ? 'active' : ''}" data-room="practice">Practice Sets <span class="mono" style="font-size:13px;">(${nPractice})</span></button>` : ''}
        <button class="room-tab ${active === 'history' ? 'active' : ''}" data-room="history">Attempt History</button>
        <button class="room-tab ${active === 'progress' ? 'active' : ''}" data-room="progress">Progress</button>
        <button class="room-tab ${active === 'author' ? 'active' : ''}" data-room="author">Author</button>
      </div>
      <span class="mono" style="font-size:12px; color:var(--ink-muted);">${right}</span>
    </div>
  `;
}

export function wireRoomNav() {
  document.querySelectorAll('[data-room]').forEach(b => {
    b.onclick = () => { S.room = b.dataset.room; renderRoom(); };
  });
}

export function renderRoom() {
  clearInterval(S.timerId);
  if (S.room === 'past') renderPast();
  else if (S.room === 'practice') renderPractice();
  else if (S.room === 'history') renderHistory();
  else if (S.room === 'progress') renderProgress();
  else if (S.room === 'author') renderAuthor();
  else if (S.room === 'explore') renderExploreList();
  window.scrollTo(0, 0);
}

export function resumeBannerHtml() {
  const sv = S.save;
  if (!sv || !sv.quizUuid || S.saveDismissed) return '';
  const n = (sv.questions || []).length;
  let meta = n
    ? `Q${(sv.questionIndex ?? 0) + 1} of ${n} · saved ${fmtSaved(sv.updatedAt)}`
    : `Question ${(sv.questionIndex ?? 0) + 1} · saved ${fmtSaved(sv.updatedAt)}`;

  return `
    <div class="resume-strip" id="resumeBanner">
      <div>
        <span class="pill accent" style="margin-right:8px;">Saved Session</span>
        <strong style="font-size:14px;">${esc(sv.title || 'Saved assessment')}</strong>
        <span class="mono" style="font-size:12px; color:var(--ink-muted); margin-left:8px;">${esc(meta)}</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-jade" style="padding:6px 14px; font-size:12.5px;" id="resumeBtn">Resume</button>
        <button class="btn-ghost" id="discardSave" title="Discard saved assessment">✕</button>
      </div>
    </div>
  `;
}

export function wireResumeBanner() {
  const r = $('#resumeBtn');
  if (r) r.onclick = () => resumeSave();
  const d = $('#discardSave');
  if (d) d.onclick = async () => {
    try { await api('/api/save', { method: 'DELETE' }); } catch {}
    S.save = null;
    renderRoom();
  };
}

// A timed exam's deadline is wall-clock honest: time spent away counts.
function adjustResumeElapsed(sv) {
  if (!sv || !sv.exam || !sv.timeLimitMinutes || !sv.savedAt) return sv;
  try {
    const away = Math.max(0, Math.floor((Date.now() - new Date(sv.savedAt).getTime()) / 1000));
    if (!away) return sv;
    const cap = sv.timeLimitMinutes * 60;
    return { ...sv, elapsedSeconds: Math.min(cap, (sv.elapsedSeconds || 0) + away) };
  } catch { return sv; }
}

export async function resumeSave() {
  const sv = adjustResumeElapsed(S.save);
  if (!sv) return;
  const quizLike = {
    uuid: sv.quizUuid,
    version: sv.quizVersion ?? 1,
    title: sv.title || 'Saved quiz',
    timeLimitMinutes: sv.timeLimitMinutes || null,
    untimed: !!sv.untimed,
    questions: sv.questions || []
  };
  beginRun({
    mode: sv.exam ? 'exam' : 'quiz',
    quizLike,
    meta: { category: sv.category || 'past-paper', file: sv.quizFile || 'mixed', virtual: true },
    resume: sv,
    retrySpec: sv.spec || { kind: 'mixed' }
  });
}
