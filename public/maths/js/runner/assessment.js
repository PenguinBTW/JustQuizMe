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
import { noteDwell } from '../timeHeatmap.js';

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
  S.answers = o.resume?.answers ?? {};
  S.elapsed = o.resume?.elapsedSeconds ?? 0;
  S.startedAt = o.resume?.startedAt ?? new Date().toISOString();
  const savedTimes = Array.isArray(o.resume?.questionTimes) ? o.resume.questionTimes : [];
  S.qDwell = Object.fromEntries(
    savedTimes.filter(t => t && typeof t.s === 'number').map(t => [t.q, t.s])
  );
  S.qShownKey = null;
  S.qShownAt = 0;

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
  upd();
  S.timerId = setInterval(() => { S.elapsed++; upd(); }, 1000);
}

export function chromeCount() {
  const qs = S.quiz.questions;
  return `Q${S.idx + 1} of ${qs.length}`;
}

export async function saveProgress() {
  noteDwell(S.qDwell, S.qShownKey, S.qShownAt, Date.now());
  S.qShownAt = document.hidden ? 0 : Date.now();
  const body = {
    quizUuid: S.quiz.uuid,
    quizVersion: S.quiz.version,
    quizFile: S.quizMeta.file,
    category: S.quizMeta.category,
    questionIndex: S.idx,
    answers: S.answers,
    elapsedSeconds: S.elapsed,
    // Fractional seconds here so save→resume→finish doesn't drift through
    // two rounds of rounding; only the final score entry rounds.
    questionTimes: S.quiz.questions.map(q => ({ q: ak(q), s: S.qDwell[ak(q)] || 0 })),
    startedAt: S.startedAt,
    kind: S.quizMeta.virtual ? 'virtual' : 'file',
    title: S.quiz.title,
    exam: !!S.quiz.exam,
    order: S.quiz.questions.map(ak),
    questions: S.quizMeta.virtual ? S.quiz.questions : null,
    spec: S.retrySpec
  };
  await api('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
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

// Registered once — the handler reads S at event time, so it keeps working
// across runs without accumulating listeners per beginRun.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    noteDwell(S.qDwell, S.qShownKey, S.qShownAt, Date.now());
    S.qShownAt = 0;
  } else if (S.room === 'runner' && S.qShownKey) {
    S.qShownAt = Date.now();
  }
});

export function eyebrowLeft(q) {
  return `${q.id} · ${q.marks} Mark${q.marks === 1 ? '' : 's'}`;
}

export function renderQ() {
  const q = S.quiz.questions[S.idx];
  const qs = S.quiz.questions;

  // Credit dwell to whatever was on screen since the last render, then start
  // the clock on this question. Re-renders of the same question correctly
  // keep accumulating it.
  noteDwell(S.qDwell, S.qShownKey, S.qShownAt, Date.now());
  S.qShownKey = ak(q);
  // Hidden tab (e.g. a run started backgrounded) holds the clock at 0 until
  // the visibility listener resumes it on show.
  S.qShownAt = document.hidden ? 0 : Date.now();
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
  }

  wireQ(q);
  wireKeypad();
  if (window.renderMath) setTimeout(window.renderMath, 30);
}
