// Computer Science Assessment Runner & Timer Controller
import { S } from '../state.js';
import { $, esc, fmtClock, ak, imgHtml, tableHtml } from '../utils.js';
import { api } from '../api.js';
import { getAllQuestionPool, resolveDeps, depHtml } from '../taxonomy.js';
import { renderPromptHtml } from './evaluators.js';
import { renderQuestionSpecifics, wireQuestionInteractions } from './renderers.js';
import { finishQuiz } from './finish.js';

export function beginRun(o) {
  S.timeExpired = false;
  S.quiz = { ...o.quizLike };
  S.quizMeta = o.meta;
  S.runMode = o.mode;
  if (o.mode === 'exam') {
    S.quiz.exam = true;
    if (!o.quizLike.untimed && !S.quiz.timeLimitMinutes) {
      const totMarks = (S.quiz.questions || []).reduce((s, q) => s + (+q.marks || 0), 0);
      S.quiz.timeLimitMinutes = Math.max(5, Math.round(totMarks * 1.07));
    }
  }
  const pool = getAllQuestionPool();
  resolveDeps(S.quiz.questions, pool);
  S.idx = o.resume?.questionIndex ?? o.startIdx ?? 0;
  S.answers = o.resume?.answers ?? {};
  S.elapsed = o.resume?.elapsedSeconds ?? 0;
  S.startedAt = o.resume?.startedAt ?? new Date().toISOString();
  clearInterval(S.timerId);
  S.room = 'runner';
  renderQ();
  if (o.mode === 'quiz' || o.mode === 'exam') startTimer();
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
      if (left <= 0) {
        // capture whatever is mid-typing before the auto-submit — no work lost
        saveCurrent(S.quiz.questions[S.idx]);
        finishQuiz(true);
      }
    } else {
      mid.innerHTML = `${esc(chromeCount())} · <span>⏱ ${fmtClock(S.elapsed)}</span>`;
    }
  };
  upd();
  // wall-clock derived: a suspended tab can't stretch the clock
  const tickBase = S.elapsed, tickT0 = Date.now();
  S.timerId = setInterval(() => { S.elapsed = tickBase + Math.floor((Date.now() - tickT0) / 1000); upd(); }, 1000);
}

export function chromeCount() {
  const q = S.quiz.questions[S.idx];
  return `Question ${S.idx + 1} of ${S.quiz.questions.length} · ${q.marks} mark${q.marks === 1 ? '' : 's'}`;
}

export function eyebrowFor(q) {
  if (q.type === 'multiple-choice') return 'CHOOSE THE CORRECT STATEMENT';
  if (q.type === 'written') return 'EXPLAIN IN YOUR OWN WORDS';
  if (q.type === 'extended-response') return 'EXTENDED RESPONSE · LEVELS OF RESPONSE (9/12 MARKS)';
  if (q.type === 'calculation') return 'DISCRETE VALUE · EXACT MATCH';
  if (q.type === 'trace-table') return 'ALGORITHM TRACE · STEP-BY-STEP DRY RUN';
  if (q.type === 'truth-table') return 'BOOLEAN LOGIC · TRUTH TABLE';
  if (q.type === 'lmc') return 'ASSEMBLY LANGUAGE · LITTLE MAN COMPUTER (LMC)';
  if (q.type === 'code-requirement') return 'PROGRAMMING · C# & OCR REFERENCE LANGUAGE';
  if (q.type === 'self-marked') return 'DRAWING & DIAGRAM · SELF-MARKED';
  return 'EXAM QUESTION';
}

export function footerAnsweredText(q) {
  const extra = (q.type === 'written' || q.type === 'extended-response' || q.type === 'self-marked') ? ' · Honest self-ticking' : '';
  return `Question ${S.idx + 1} of ${S.quiz.questions.length}${extra}`;
}

export function renderQ() {
  const qs = S.quiz.questions;
  const q = qs[S.idx];
  if (!q) return finishQuiz();

  const ans = S.answers[ak(q)] || {};
  const pct = ((S.idx + 1) / qs.length) * 100;
  const rightTag = S.runMode === 'explore' ? 'Explore · Practice'
    : S.runMode === 'exam' ? 'EXAM MODE · 1-RUN SUBMIT'
    : `${q.section || 'OCR CS'} · ${q.type.toUpperCase()}`;

  $('#stage').innerHTML = `
    <div class="q-chrome">
      <button class="btn-ghost" id="backTop">← ${S.idx === 0 ? 'Back to Library' : 'Previous question'}</button>
      <span class="mono chrome-mid" id="chromeMid">${esc(chromeCount())}</span>
      <span class="mono" id="chromeRight" style="color:var(--accent);">${esc(rightTag)}</span>
    </div>
    <div class="thin-progress"><div id="qBar" style="width:${pct}%;"></div></div>

    <div class="paper-sheet">
      <div class="q-eyebrow">
        <span>${esc(eyebrowFor(q))}</span>
        <span>${esc(q.subtopic || 'GENERAL')}</span>
      </div>

      <div class="q-prompt-block">
        ${renderPromptHtml(q.prompt, ans)}
      </div>
      ${q.guidance ? `<div class="q-guide">${renderPromptHtml(q.guidance, ans)}</div>` : ''}

      ${depHtml(q)}
      ${imgHtml(q)}
      ${tableHtml(q)}

      ${renderQuestionSpecifics(q)}

      <div class="sheet-footer">
        <span class="mono" id="qAnswered">${footerAnsweredText(q)}</span>
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn-ghost" id="saveBtn">Save Progress</button>
          ${S.idx > 0 ? '<button class="btn" id="prevQ">← Back</button>' : ''}
          ${S.idx < qs.length - 1
            ? '<button class="btn btn-jade" id="nextQ">Continue →</button>'
            : `<button class="btn btn-jade" id="finishQ">${S.quiz.exam ? 'Submit Paper ⏱' : 'Finish Quiz →'}</button>`
          }
        </div>
      </div>
    </div>
  `;

  wireQuestionInteractions(q);
  if (window.renderMath) window.renderMath();
}

export function saveCurrent(q) {
  if (!q) return;
  const k = ak(q);
  S.answers[k] ||= {};
  const ans = S.answers[k];
  if (q.type === 'code-requirement') {
    const area = $('#csCodeArea');
    if (area) ans.code = area.value;
  } else if (q.type === 'lmc') {
    const area = $('#lmcCodeArea');
    if (area) ans.code = area.value;
  } else if (q.type === 'written' || q.type === 'extended-response') {
    const txt = $('#essayText');
    if (txt) ans.text = txt.value;
  } else if (q.type === 'self-marked') {
    const txt = $('#selfMarkNotes');
    if (txt) ans.text = txt.value;
  } else if (q.type === 'calculation') {
    const inp = $('#calcInput');
    if (inp) ans.text = inp.value;
  } else if (q.type === 'trace-table') {
    document.querySelectorAll('[data-tr-r]').forEach(inp => {
      const r = +inp.dataset.trR, c = +inp.dataset.trC;
      if (ans.rows && ans.rows[r]) ans.rows[r][c] = inp.value;
    });
  }
}

export async function saveProgress() {
  const body = {
    quizUuid: S.quiz.uuid,
    quizVersion: S.quiz.version,
    quizFile: S.quizMeta?.file || '',
    category: S.quizMeta?.category || 'normal',
    questionIndex: S.idx,
    answers: S.answers,
    elapsedSeconds: S.elapsed,
    startedAt: S.startedAt,
    timeLimitMinutes: S.quiz.timeLimitMinutes || null,
    untimed: !!S.quiz.untimed,
    savedAt: new Date().toISOString(),
    title: S.quiz.title,
    exam: S.runMode === 'exam',
    questions: S.quiz.questions
  };
  try {
    await api('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    S.save = { ...body, updatedAt: new Date().toISOString() };
    const b = $('#saveBtn');
    if (b) {
      b.textContent = '✓ Saved';
      setTimeout(() => { b.textContent = 'Save Progress'; }, 1500);
    }
  } catch {}
}
