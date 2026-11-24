// Physics Assessment Runner (Question Display, Nav, Progress, Timer, Save)
import { S } from '../state.js';
import { $, esc, fmtClock, ak } from '../utils.js';
import { api } from '../api.js';
import { resolveDeps, depHtml, mcqHtml, writtenHtml, selfMarkedHtml, calcHtml, wireQ } from './renderers.js';
import { finishQuiz } from './finish.js';
import { openPrintDialog } from '../../../shared/js/print.js';
import { goExploreBack } from '../views/explore.js';
import { renderRoom } from '../navigation.js';

export function beginRun(o){
  let qs = o.quizLike.questions;
  if (o.resume?.order){
    const pos = new Map(o.resume.order.map((k, i) => [k, i]));
    qs = [...qs].sort((a, b) => (pos.get(ak(a)) ?? 1e9) - (pos.get(ak(b)) ?? 1e9));
  }
  S.quiz = { ...o.quizLike, questions: qs };
  S.quizMeta = o.meta;
  S.runMode = o.mode;
  // Attach dependency stems (idempotent - safe on resume where _deps persist).
  try { resolveDeps(S.quiz.questions, [...S.quiz.questions, ...Object.values(S._pastAll || {})]); } catch { /* deps optional */ }
  S.retrySpec = o.retrySpec || null;
  S.idx = o.resume?.questionIndex ?? o.startIdx ?? 0;
  S.answers = o.resume?.answers ?? {};
  S.elapsed = o.resume?.elapsedSeconds ?? 0;
  S.startedAt = o.resume?.startedAt ?? new Date().toISOString();
  clearInterval(S.timerId);
  S.room = 'runner';
  renderQ();
  if (o.mode === 'quiz') startTimer();
}

export function startTimer(){
  clearInterval(S.timerId);
  const upd = () => {
    const mid = $('#chromeMid');
    if (!mid || S.room !== 'runner') return;
    const lim = S.quiz.timeLimitMinutes;
    if (S.quiz.exam && lim){
      const left = Math.max(0, Math.round(lim * 60 - S.elapsed));
      mid.innerHTML = `${esc(chromeCount())} · <span id="examClock" class="${left < 60 ? 'timer-warn' : ''}">⏱ ${fmtClock(left)} left</span>`;
    }
    if (S.quiz.timeLimitMinutes && S.elapsed >= S.quiz.timeLimitMinutes * 60){
      finishQuiz(true);
    }
  };
  upd();
  S.timerId = setInterval(() => { S.elapsed++; upd(); }, 1000);
}

export async function saveProgress(){
  const body = {
    quizUuid: S.quiz.uuid, quizVersion: S.quiz.version, quizFile: S.quizMeta.file, category: S.quizMeta.category,
    questionIndex: S.idx, answers: S.answers, elapsedSeconds: S.elapsed, startedAt: S.startedAt,
    kind: S.quizMeta.virtual ? 'virtual' : 'file', title: S.quiz.title,
    order: S.quiz.questions.map(ak),
    questions: S.quizMeta.virtual ? S.quiz.questions : null,
    spec: S.retrySpec,
  };
  try {
    await api('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    S.save = { ...body, updatedAt: new Date().toISOString() };
  } catch {}
  const b = $('#saveBtn');
  if (b){ b.classList.add('save-flash'); const t = b.textContent; b.textContent = '✓ Saved'; setTimeout(() => { b.textContent = t; b.classList.remove('save-flash'); }, 1500); }
}

export function chromeCount(){
  const q = S.quiz.questions[S.idx];
  return `Question ${S.idx + 1} of ${S.quiz.questions.length} · ${q.marks} mark${q.marks === 1 ? '' : 's'}`;
}

export function progress(){
  const qs = S.quiz.questions, last = S.idx === qs.length - 1;
  const mid = $('#chromeMid');
  if (mid){
    mid.textContent = chromeCount();
    if (S.runMode === 'quiz' && S.quiz.exam && S.quiz.timeLimitMinutes){
      const left = Math.max(0, Math.round(S.quiz.timeLimitMinutes * 60 - S.elapsed));
      mid.innerHTML = `${esc(chromeCount())} · <span class="${left < 60 ? 'timer-warn' : ''}">⏱ ${fmtClock(left)} left</span>`;
    }
  }
  const bar = $('#qBar');
  if (bar) bar.style.width = `${((S.idx + 1) / qs.length) * 100}%`;
  const right = $('#chromeRight');
  if (right) right.textContent = rightLabel(qs[S.idx]);
  const backTop = $('#backTop');
  if (backTop) backTop.textContent = S.runMode === 'explore' ? '← Back to list' : (S.idx === 0 ? '← Back to Library' : '← Previous question');
  const foot = $('#qAnswered');
  if (foot){
    if (S.runMode === 'explore') foot.textContent = `Exploring ${S.idx + 1} of ${qs.length} - nothing is scored`;
    else {
      const n = Object.keys(S.answers).filter(k => S.answers[k]?.locked).length;
      const q = qs[S.idx];
      const extra = (q.type === 'written' || q.type === 'self-marked') ? ' · Honest ticking only' : '';
      foot.textContent = `Answered ${n} of ${qs.length} so far${extra}`;
    }
  }
  const next = $('#nextQ'), fin = $('#finishQ');
  if (next && fin){
    if (S.runMode === 'explore'){
      next.hidden = last; fin.hidden = !last;
      fin.textContent = 'Back to list →';
    } else {
      next.hidden = last; fin.hidden = !last;
      fin.textContent = S.quiz.exam ? 'Finish Paper →' : 'Finish quiz →';
    }
  }
}

export function rightLabel(q){
  if (S.runMode === 'explore') return 'Practice · no score';
  const a = S.answers[ak(q)];
  if (q.type === 'multiple-choice') return a?.locked ? (a.correct ? `${q.section} · +${q.marks} ✓` : `${q.section} · +0`) : `${q.section} · +${q.marks}?`;
  if (q.type === 'written') return `${q.section} · self-checked`;
  if (q.type === 'self-marked'){
    if (a?.locked) return `${q.section} · self-marked ${a.score}/${q.marks}`;
    const n = (a?.ticks || []).filter(Boolean).length;
    return a?.revealed ? `${q.section} · ${n}/${q.marks} ticked` : `${q.section} · reveal the answer`;
  }
  if (a?.soloCorrect) return `Solo ✓ +${q.marks}`;
  if (a?.helped) return `Helped · +0`;
  if (a?.loggedWrong) return `Wrong · steps for helped credit`;
  return `One attempt · +${q.marks}?`;
}

export function eyebrowLeft(q){
  if (q.type === 'multiple-choice') return 'Choose One · Multiple Choice';
  if (q.type === 'written') return 'Explain in Your Own Words';
  if (q.type === 'self-marked') return 'Draw / Annotate on Paper · Self-Marked';
  if (S.runMode === 'explore') return 'Calculation · Practice';
  if ((q._deps || []).length) return 'Calculation · Cross-Question Dependency';
  return 'Calculation · Exact Answer with Tolerance';
}

export function renderQ(){
  const q = S.quiz.questions[S.idx];
  const inQuiz = S.runMode === 'quiz';
  let body = '';
  if (q.type === 'multiple-choice') body = mcqHtml(q);
  else if (q.type === 'written') body = writtenHtml(q);
  else if (q.type === 'self-marked') body = selfMarkedHtml(q);
  else body = calcHtml(q);
  $('#stage').innerHTML = `
  <div class="q-chrome">
    <div class="chrome-cluster">
      <button class="btn-ghost" id="backTop">← Previous question</button>
      ${inQuiz ? '<button class="btn-ghost mono" style="font-size:12px;" id="saveBtn" title="Save progress to resume later">Save</button>' : ''}
      <button class="btn-ghost mono" style="font-size:12px;" id="printPaperBtn" title="Export as a printable exam paper">Print paper</button>
    </div>
    <span class="mono chrome-mid" id="chromeMid"></span>
    <span class="mono" id="chromeRight"></span>
  </div>
  <div class="thin-progress"><div id="qBar"></div></div>
  <div class="paper-sheet">
    <div class="q-eyebrow"><span>${esc(eyebrowLeft(q))}</span><span>${esc(q.subtopic || q.section || '')}</span></div>
    ${depHtml(q)}
    ${body}
    <div class="sheet-footer">
      <span id="qAnswered"></span>
      <div style="display:flex; gap:8px;">
        <button class="btn" id="prevQ">← Back</button>
        <button class="btn btn-primary" id="nextQ">Continue →</button>
        <button class="btn btn-primary" id="finishQ" hidden>Finish →</button>
      </div>
    </div>
  </div>`;
  progress();
  wireQ(q);
  $('#backTop').onclick = navBack;
  $('#prevQ').onclick = navBack;
  const sv = $('#saveBtn');
  if (sv) sv.onclick = saveProgress;
  const pp = $('#printPaperBtn');
  if (pp) pp.onclick = () => openPrintDialog({
    title: S.quiz.title, portal: 'AQA Physics 7408', questions: S.quiz.questions,
    imgRoot: '/physics/images/past-paper/', timeLimitMinutes: S.quiz.timeLimitMinutes,
  });
  if (window.renderMath) window.renderMath();
}

export function navBack(){
  if (S.idx > 0){ S.idx--; renderQ(); }
  else if (S.runMode === 'explore') goExploreBack();
  else { S.room = S.returnRoom || 'past'; renderRoom(); }
}

export function navNext(lockFn){
  if (lockFn) lockFn();
  if (S.idx < S.quiz.questions.length - 1){ S.idx++; renderQ(); }
}
