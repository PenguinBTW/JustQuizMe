// Mathematics Assessment Runner
import { esc, fmtDur } from '../../../../shared/js/utils.js';
import { areMathEqual } from '../cas-client.js';
import { renderMcq, wireMcq } from '../../cs/js/renderers/mcq.js';
import { renderSymbolic, wireSymbolic } from '../renderers/symbolic.js';
import { renderMilestone, wireMilestone, evaluateMilestone } from '../renderers/milestone.js';
import { renderCalculation, wireCalculation } from '../renderers/calculation.js';
import { renderWritten, wireWritten } from '../../cs/js/renderers/written.js';
import { openFlagDialog } from '../../../../shared/js/flags.js';

export function renderQuestion(S) {
  const q = S.questions[S.idx];
  if (!q) return `<div class="card"><p>No question loaded.</p></div>`;

  const totalQ = S.questions.length;
  const progressPct = Math.round(((S.idx + 1) / totalQ) * 100);
  const userAns = S.answers[q.id || S.idx] || {};

  let specificHtml = '';
  const type = q.type || (q.options ? 'mcq' : q.milestones ? 'milestone' : q.symbolicAnswer || q.exactAnswer ? 'symbolic' : q.expectedNumber ? 'calc' : 'written');

  if (type === 'mcq') {
    specificHtml = renderMcq(q, userAns.mcq, S.isExam && S.isLocked);
  } else if (type === 'symbolic') {
    specificHtml = renderSymbolic(q, userAns, S.isExam);
  } else if (type === 'milestone') {
    specificHtml = renderMilestone(q, userAns, S.isExam);
  } else if (type === 'calc') {
    specificHtml = renderCalculation(q, userAns, S.isExam);
  } else {
    specificHtml = renderWritten(q, userAns, S.isExam);
  }

  return `
    <div class="runner-shell">
      <div class="runner-header">
        <div>
          <span class="mono" style="font-size: 11.5px; color: var(--accent); font-weight: 700; text-transform: uppercase;">
            ${esc(S.currentQuiz?.title || 'OCR Mathematics')}
          </span>
          <div class="runner-progress-bar" style="width: 220px;">
            <div class="runner-progress-fill" style="width: ${progressPct}%;"></div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 14px;">
          <span class="mono" id="examClockDisplay" style="font-size: 13.5px; font-weight: 600;">00:00</span>
          <button class="btn btn-ghost" id="btnFlagQ" title="Flag an issue with this question" style="font-size: 12px;">⚑ Flag</button>
          <button class="btn btn-ghost" id="btnAbandonRun" style="font-size: 12px;">Exit</button>
        </div>
      </div>

      <div class="question-box">
        <div class="runner-eyebrow mono">
          <span>Question ${S.idx + 1} of ${totalQ} (${q.marks || 1} Mark${(q.marks || 1) > 1 ? 's' : ''})</span>
          <span>${esc(q.topic || 'OCR H240')}</span>
        </div>

        <div class="question-prompt" id="questionPromptBox">
          ${q.promptHtml || esc(q.prompt || q.question || '')}
        </div>

        <div id="questionSpecificContainer">
          ${specificHtml}
        </div>

        <div class="runner-footer">
          <div class="runner-foot-left">
            <button class="btn" id="btnPrevQ" ${S.idx === 0 ? 'disabled style="opacity: 0.5;"' : ''}>← Previous</button>
            <span class="mono" style="font-size: 12px; color: var(--ink-secondary);">Q ${S.idx + 1} / ${totalQ}</span>
          </div>

          <div class="runner-foot-right">
            ${S.idx === totalQ - 1 
              ? `<button class="btn btn-primary" id="btnFinishExam">Submit Paper ✓</button>`
              : `<button class="btn btn-primary" id="btnNextQ">Next Question →</button>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

export function wireQuestion(container, S, onNavigate, onFinish, onAbandon) {
  const q = S.questions[S.idx];
  if (!q) return;

  const qKey = q.id || S.idx;
  if (!S.answers[qKey]) S.answers[qKey] = {};

  const type = q.type || (q.options ? 'mcq' : q.milestones ? 'milestone' : q.symbolicAnswer || q.exactAnswer ? 'symbolic' : q.expectedNumber ? 'calc' : 'written');
  const specContainer = container.querySelector('#questionSpecificContainer');

  if (type === 'mcq') {
    wireMcq(specContainer, (optIdx) => {
      S.answers[qKey].mcq = optIdx;
    });
  } else if (type === 'symbolic') {
    wireSymbolic(specContainer, (symAns) => {
      Object.assign(S.answers[qKey], symAns);
    });
  } else if (type === 'milestone') {
    wireMilestone(specContainer, (msAns) => {
      Object.assign(S.answers[qKey], msAns);
    });
  } else if (type === 'calc') {
    wireCalculation(specContainer, (calcAns) => {
      Object.assign(S.answers[qKey], calcAns);
    });
  } else {
    wireWritten(specContainer, (wAns) => {
      Object.assign(S.answers[qKey], wAns);
    });
  }

  // Trigger KaTeX rendering if available
  if (window.renderMath) window.renderMath();

  const prevBtn = container.querySelector('#btnPrevQ');
  const nextBtn = container.querySelector('#btnNextQ');
  const finishBtn = container.querySelector('#btnFinishExam');
  const abandonBtn = container.querySelector('#btnAbandonRun');
  const flagBtn = container.querySelector('#btnFlagQ');
  if (flagBtn) flagBtn.onclick = () => openFlagDialog({
    portal: 'maths',
    fileBase: S.quizMeta?.file || '',
    questionId: q.id || String(S.idx),
    questionLabel: `Q${S.idx + 1} of ${S.questions.length}`
  });

  if (prevBtn) prevBtn.onclick = () => onNavigate(S.idx - 1);
  if (nextBtn) nextBtn.onclick = () => onNavigate(S.idx + 1);
  if (finishBtn) finishBtn.onclick = () => onFinish();
  if (abandonBtn) abandonBtn.onclick = () => onAbandon();
}

export function calculateMathsScore(S) {
  let score = 0;
  let total = 0;

  S.questions.forEach((q, i) => {
    const qKey = q.id || i;
    const ans = S.answers[qKey] || {};
    const marks = Number(q.marks) || 1;
    total += marks;

    const type = q.type || (q.options ? 'mcq' : q.milestones ? 'milestone' : q.symbolicAnswer || q.exactAnswer ? 'symbolic' : q.expectedNumber ? 'calc' : 'written');
    if (type === 'mcq') {
      const exp = Number(q.answer !== undefined ? q.answer : q.correctIndex);
      if (ans.mcq === exp) score += marks;
    } else if (type === 'symbolic') {
      const exp = q.symbolicAnswer || q.exactAnswer || q.answer || '';
      if (areMathEqual(ans.expr, exp)) score += marks;
    } else if (type === 'milestone') {
      score += evaluateMilestone(q, ans);
    } else if (type === 'calc') {
      const exp = Number(q.expectedNumber || q.answer);
      const act = Number(ans.val);
      if (!isNaN(exp) && !isNaN(act) && Math.abs(act - exp) < 0.05) score += marks;
    } else {
      score += ans.selfAward ?? (ans.text ? marks : 0);
    }
  });

  return { score, total };
}

export function renderMathsReport(S, score, total, onReturn) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  return `
    <div class="card" style="max-width: 680px; margin: 40px auto; text-align: center; padding: 40px 32px;">
      <span class="mono" style="font-size: 11.5px; color: var(--accent); font-weight: 700; text-transform: uppercase;">
        OCR A-Level Mathematics · Examination Report
      </span>
      <h2 class="serif" style="font-size: 36px; margin: 12px 0 6px;">${percentage >= 70 ? 'Grade A* / A Standard' : 'Assessment Completed'}</h2>
      <p style="font-size: 14px; color: var(--ink-secondary); margin-bottom: 24px;">
        ${esc(S.currentQuiz?.title || 'Mathematics Paper')} · Time taken: ${fmtDur(S.elapsed)}
      </p>

      <div style="background: var(--surface-subtle); padding: 24px; border-radius: 12px; margin-bottom: 28px; border: 1px solid var(--border);">
        <div class="mono" style="font-size: 42px; font-weight: 700; color: var(--accent);">${score} / ${total}</div>
        <div class="mono" style="font-size: 14px; color: var(--ink-muted); margin-top: 4px;">Overall Score (${percentage}%)</div>
      </div>

      <button class="btn btn-primary" id="btnReturnToLibrary" style="padding: 10px 24px;">Return to Past Paper Library</button>
    </div>
  `;
}
