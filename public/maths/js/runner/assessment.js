// Maths Assessment Runner (Question Display, Nav, Progress, Timer, Save)
import { S } from '../state.js';
import { $, esc, fmtClock, ak } from '../utils.js';
import { api } from '../api.js';
import { wireKeypad } from './keypad.js';
import {
  mcqHtml, symbolicHtml, milestoneHtml, proofHtml, hypothesisHtml,
  mechanicsHtml, graphFeaturesHtml, writtenHtml, selfMarkedHtml, calcHtml, wireQ
} from './renderers.js';
import { finishQuiz } from './finish.js';
import { renderRoom } from '../navigation.js';

export function beginRun(o) {
  let qs = o.quizLike.questions;
  if (o.resume?.order) {
    const pos = new Map(o.resume.order.map((k, i) => [k, i]));
    qs = [...qs].sort((a, b) => (pos.get(ak(a)) ?? 1e9) - (pos.get(ak(b)) ?? 1e9));
  }
  S.quiz = { ...o.quizLike, questions: qs };
  S.quizMeta = o.meta;
  S.runMode = o.mode;
  S.retrySpec = o.retrySpec || null;
  S.idx = o.resume?.questionIndex ?? o.startIdx ?? 0;
  // Deep-copy the checkpoint: edits must not mutate the stored save object,
  // or an unsaved resume would still restore those edits on the next open.
  S.answers = o.resume?.answers ? JSON.parse(JSON.stringify(o.resume.answers)) : {};
  S.elapsed = o.resume?.elapsedSeconds ?? 0;
  S.startedAt = o.resume?.startedAt ?? new Date().toISOString();

  clearInterval(S.timerId);
  S.room = 'runner';
  renderQ();
  if (o.mode === 'quiz') startTimer();
}

export function startTimer() {
  clearInterval(S.timerId);
  const upd = () => {
    const mid = $('#chromeMid');
    if (!mid || S.room !== 'runner') return;
    const lim = S.quiz.timeLimitMinutes;
    if (S.quiz.exam && lim) {
      const left = Math.max(0, Math.round(lim * 60 - S.elapsed));
      mid.innerHTML = `${esc(chromeCount())} · <span id="examClock" class="${left < 60 ? 'timer-warn' : ''}">⏱ ${fmtClock(left)} left</span>`;
      if (left <= 0) finishQuiz(true);
    } else {
      mid.textContent = `${chromeCount()} · ⏱ ${fmtClock(S.elapsed)}`;
    }
  };
  // Install the interval BEFORE the first update: when upd() auto-finishes
  // an overdue run, finishQuiz's clearInterval must kill this timer too,
  // or it keeps firing duplicate submissions until the room changes.
  S.timerId = setInterval(() => { S.elapsed++; upd(); }, 1000);
  upd();
}

export function chromeCount() {
  const qs = S.quiz.questions;
  return `Q${S.idx + 1} of ${qs.length}`;
}

export async function saveProgress() {
  const body = {
    quizUuid: S.quiz.uuid,
    quizVersion: S.quiz.version,
    quizFile: S.quizMeta.file,
    category: S.quizMeta.category,
    questionIndex: S.idx,
    answers: S.answers,
    elapsedSeconds: S.elapsed,
    startedAt: S.startedAt,
    kind: S.quizMeta.virtual ? 'virtual' : 'file',
    title: S.quiz.title,
    exam: !!S.quiz.exam,
    timeLimitMinutes: S.quiz.timeLimitMinutes ?? null,
    order: S.quiz.questions.map(ak),
    questions: S.quizMeta.virtual ? S.quiz.questions : null,
    spec: S.retrySpec
  };
  await api('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  // Refresh the in-memory save so Resume reflects this write, not the
  // snapshot loaded at page start.
  // Deep-copy: a shared reference would let later edits leak into the
  // cached save and show up in a same-page Resume.
  S.save = JSON.parse(JSON.stringify({ ...body, updatedAt: new Date().toISOString() }));
  const b = $('#saveBtn');
  if (b) {
    b.classList.add('save-flash');
    b.textContent = 'Saved ✓';
    setTimeout(() => {
      b.classList.remove('save-flash');
      b.textContent = 'Save';
    }, 1400);
  }
}

export function eyebrowLeft(q) {
  return `${q.id} · ${q.marks} Mark${q.marks === 1 ? '' : 's'}`;
}

export function renderQ() {
  const q = S.quiz.questions[S.idx];
  const qs = S.quiz.questions;
  const isLast = S.idx === qs.length - 1;
  const inQuiz = S.runMode === 'quiz';

  let body = '';
  if (q.type === 'multiple-choice') body = mcqHtml(q);
  else if (q.type === 'symbolic-exact') body = symbolicHtml(q);
  else if (q.type === 'method-milestone') body = milestoneHtml(q);
  else if (q.type === 'show-that-proof') body = proofHtml(q);
  else if (q.type === 'statistics-hypothesis') body = hypothesisHtml(q);
  else if (q.type === 'mechanics-vector-fbd') body = mechanicsHtml(q);
  else if (q.type === 'graph-features') body = graphFeaturesHtml(q);
  else if (q.type === 'written') body = writtenHtml(q);
  else if (q.type === 'self-marked') body = selfMarkedHtml(q);
  else body = calcHtml(q);

  $('#stage').innerHTML = `
    <div class="q-chrome">
      <div class="chrome-cluster">
        <button class="btn-ghost" id="backTop">← Previous question</button>
        ${inQuiz ? '<button class="btn-ghost mono" style="font-size:12px;" id="saveBtn" title="Save progress to resume later">Save</button>' : ''}
        ${inQuiz && S.quiz.exam ? '<button class="btn-ghost mono" style="font-size:12px;" id="saveExitBtn" title="Save progress and leave the exam">Save &amp; exit</button>' : ''}
      </div>
      <span class="mono chrome-mid" id="chromeMid"></span>
      <span class="mono" id="chromeRight">${esc(q.section || 'Mathematics')}</span>
    </div>
    <div class="thin-progress"><div id="qBar" style="width:${((S.idx + 1) / qs.length) * 100}%;"></div></div>
    <div class="paper-sheet">
      <div class="q-eyebrow">
        <span>${esc(eyebrowLeft(q))}</span>
        <span>${esc(q.subtopic || q.section || '')}</span>
      </div>
      ${body}
      <div class="sheet-footer">
        <span id="qAnswered" class="mono">Answered ${Object.keys(S.answers).filter(k => S.answers[k]?.locked).length} of ${qs.length}</span>
        <div style="display:flex; gap:8px;">
          <button class="btn" id="prevQ">← Back</button>
          <button class="btn btn-primary" id="nextQ" ${isLast ? 'hidden' : ''}>Continue →</button>
          <button class="btn btn-primary" id="finishQ" ${!isLast ? 'hidden' : ''}>${S.runMode === 'explore' ? 'Back to list →' : 'Finish →'}</button>
        </div>
      </div>
    </div>
  `;

  $('#backTop').onclick = () => {
    if (S.idx > 0) { S.idx--; renderQ(); }
    else if (S.runMode === 'explore') { S.room = 'explore'; renderRoom(); }
    else { S.room = S.returnRoom || 'past'; renderRoom(); }
  };
  $('#prevQ').onclick = () => { if (S.idx > 0) { S.idx--; renderQ(); } };
  $('#nextQ').onclick = () => { if (S.idx < qs.length - 1) { S.idx++; renderQ(); } };
  $('#finishQ').onclick = () => {
    if (S.runMode === 'explore') { S.room = 'explore'; renderRoom(); }
    else finishQuiz();
  };

  if (inQuiz) {
    const sb = $('#saveBtn');
    if (sb) sb.onclick = saveProgress;
    const se = $('#saveExitBtn');
    if (se) se.onclick = async () => {
      se.disabled = true;
      se.textContent = 'Saving…';
      // Stop the countdown first: an auto-finish mid-save would DELETE the
      // resume snapshot this button is writing.
      clearInterval(S.timerId);
      try {
        await saveProgress();
      } catch {
        se.disabled = false;
        se.textContent = 'Save failed ✗';
        startTimer();
        setTimeout(() => { se.textContent = 'Save & exit'; }, 1600);
        return;
      }
      S.room = S.returnRoom || 'past';
      renderRoom();
    };
  }

  wireQ(q);
  wireKeypad();
  if (window.renderMath) setTimeout(window.renderMath, 30);
}
