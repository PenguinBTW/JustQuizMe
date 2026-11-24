// Maths Quiz Results & Examiner Script Audit Controller
import { S } from '../state.js';
import { $, esc, fmtDur, ak, chipify } from '../utils.js';
import { api } from '../api.js';
import { renderRoom } from '../navigation.js';
import { renderQ } from './assessment.js';
import { retryRun } from './starters.js';
import { examSummary, firstReviewIndex, missedCount } from '../summaryBar.js';

export async function finishQuiz(auto = false) {
  clearInterval(S.timerId);

  for (const q of S.quiz.questions) {
    const k = ak(q);
    if (!S.answers[k]) {
      S.answers[k] = { locked: true, score: 0 };
    }
  }

  let totalScore = 0, maxMarks = 0;
  for (const q of S.quiz.questions) {
    maxMarks += q.marks;
    totalScore += (S.answers[ak(q)]?.score || 0);
  }

  const minutes = Math.round(S.elapsed / 60);
  const seconds = S.elapsed;

  const entry = {
    quizUuid: S.quiz.uuid,
    quizVersion: S.quiz.version,
    quizFile: S.quizMeta.file,
    quizTitle: S.quiz.title,
    score: totalScore,
    total: maxMarks,
    minutes,
    seconds,
    exam: !!S.quiz.exam,
    date: new Date().toISOString()
  };

  try {
    await api('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    await api('/api/save', { method: 'DELETE' });
    S.scores = await api('/api/scores').catch(() => []);
  } catch {}

  S.room = 'results';
  const pctScore = maxMarks ? Math.round((totalScore / maxMarks) * 100) : 0;

  // Compact session summary: marks / total, time used vs limit, and a jump
  // to the first not-full-marks question in explore mode.
  const missed = missedCount(S.quiz.questions, S.answers, ak);
  const sum = examSummary({
    score: totalScore,
    total: maxMarks,
    elapsedSeconds: S.elapsed,
    limitMinutes: S.quiz.timeLimitMinutes,
    exam: !!S.quiz.exam,
    auto,
    missedCount: missed
  });
  const summaryBar = `
    <div class="card" style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 18px; margin-bottom:20px; flex-wrap:wrap;">
      <span class="mono" style="font-size:12.5px; color:var(--ink-secondary);">${esc(sum.text)}</span>
      ${missed > 0 ? `<button class="btn" id="reviewMissedBtn" style="padding:5px 13px; font-size:12px;">Review ${missed} missed question${missed === 1 ? '' : 's'} →</button>` : ''}
    </div>`;

  const auditRows = S.quiz.questions.map((q, i) => {
    const a = S.answers[ak(q)] || {};
    const marksGot = a.score || 0;
    const isFull = marksGot === q.marks;
    return `
      <div style="border:1px solid var(--border); border-radius:12px; padding:18px; margin:12px 0; background:var(--surface);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div><strong>Q${i + 1} (${esc(q.id)})</strong> · <span class="mono" style="font-size:12px; color:var(--ink-muted);">${esc(q.subtopic || q.section || '')}</span></div>
          <span class="pill ${isFull ? 'green' : marksGot > 0 ? 'amber' : 'red'}">${marksGot} / ${q.marks} Marks</span>
        </div>
        <div style="font-size:14px; margin-bottom:8px;">${chipify(q.prompt)}</div>
        <div class="mono" style="font-size:12.5px; color:var(--ink-secondary); margin-bottom:4px;">
          Candidate: <strong>${esc(a.text || a.targetVal || (a.picked !== undefined ? 'Option ' + ('ABCDEF'[a.picked]) : '(no working recorded)'))}</strong>
        </div>
        <div class="mono" style="font-size:12.5px; color:var(--accent); margin-bottom:6px;">
          Target: <strong>${esc(q.expected || (q.finalTarget && q.finalTarget.expected) || q.answer || 'Refer to rubric')}</strong>
        </div>
        ${q.guidance ? `<div style="font-size:12px; color:var(--ink-muted); margin-top:4px;">💡 <em>Examiner Guidance:</em> ${esc(q.guidance)}</div>` : ''}
      </div>
    `;
  }).join('');

  $('#stage').innerHTML = `
    ${summaryBar}
    <div class="card" style="text-align:center; padding: 40px 32px; margin-bottom: 28px;">
      <span class="pill green" style="margin-bottom: 12px;">Session Saved to data/scores.json</span>
      <h1 class="serif" style="font-size: 64px; line-height: 1; margin-bottom: 8px;">${pctScore}%</h1>
      <p class="mono" style="font-size: 14px; color: var(--ink-secondary); margin-bottom: 28px;">
        ${totalScore} / ${maxMarks} Marks · ${fmtDur(S.elapsed)}${auto ? ' · (Auto-finished: time limit reached)' : ''}${S.quiz.exam ? ' · Exam Conditions' : ''}
      </p>
      <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
        <button class="btn" id="retryResBtn">Retry Assessment ⟳</button>
        <button class="btn" id="exploreResBtn">Explore Questions ↗</button>
        <button class="btn btn-primary" id="backResBtn">Back to Past Papers</button>
      </div>
    </div>

    <div class="card" style="margin-top:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div>
          <h3 class="serif" style="font-size:24px; margin:0;">📋 Official Examiner Script Audit</h3>
          <p class="mono" style="font-size:12px; color:var(--ink-muted); margin-top:2px;">Question-by-question breakdown against specification rubrics.</p>
        </div>
        <span class="pill accent">${totalScore} / ${maxMarks} Total</span>
      </div>
      <div>${auditRows}</div>
    </div>
  `;

  const rm = $('#reviewMissedBtn');
  if (rm) rm.onclick = () => {
    const target = firstReviewIndex(S.quiz.questions, S.answers, ak);
    if (target < 0) return;
    S.runMode = 'explore';
    S.idx = target;
    S.room = 'runner';
    renderQ();
  };
  $('#retryResBtn').onclick = () => retryRun();
  $('#exploreResBtn').onclick = () => {
    S.runMode = 'explore';
    S.idx = 0;
    S.room = 'runner';
    renderQ();
  };
  $('#backResBtn').onclick = () => {
    S.room = 'past';
    renderRoom();
  };
}
