// Maths Quiz Results & Examiner Script Audit Controller
import { S } from '../state.js';
import { $, esc, fmtDur, ak, chipify } from '../utils.js';
import { api } from '../api.js';
import { renderRoom } from '../navigation.js';
import { renderQ } from './assessment.js';
import { retryRun } from './starters.js';
import { reviewWalkHtml } from '../../../shared/js/reviewWalk.js';
import { recordPaperResult, recordBreak, seriesProgress, breakScreenHtml, seriesFinishHtml, fmtClock } from '../../../shared/js/mockSeries.js';
import { beginSeriesPaper } from './starters.js';
import { paperPrintDoc, markSchemePrintDoc, openPrintWindow } from '../../../shared/js/printPaper.js';

export async function finishQuiz(auto = false) {
  if (S._finishing) return;
  S._finishing = true;
  if (auto === true) S.timeExpired = true;
  clearInterval(S.timerId);
  // capture mid-typing inputs on the visible question — same answer expiry would grade
  try {
    const cur = (S.quiz.questions || [])[S.idx];
    if (cur) {
      const k = ak(cur);
      const inp = $('#calcInput');
      if (inp) S.answers[k] = { ...(S.answers[k] || {}), finalValue: inp.value };
      const sym = $('#symInput');
      if (sym) S.answers[k] = { ...(S.answers[k] || {}), text: sym.value };
    }
  } catch { /* capture best-effort */ }
  // a suspended-then-woken tab must not record time past the deadline
  if (S.quiz && S.quiz.exam && S.quiz.timeLimitMinutes) S.elapsed = Math.min(S.elapsed, Math.round(S.quiz.timeLimitMinutes * 60));
  // the resume banner is corrected by the ownership check below — a
  // preserved save belonging to another quiz must survive finishing this one

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

  // Per-question outcomes — same contract as cs: attempted means the student
  // engaged at all; unattempted still records 0/full-marks (honest signal).
  const perQuestion = (S.quiz.questions || []).map(q => {
    const ans = S.answers[ak(q)] || {};
    const qm = +q.marks || 0;
    const score = Math.min(qm, Math.max(0, ans.score || 0));
    const hasTableInput = (Array.isArray(ans.rows) && ans.rows.some(r => Array.isArray(r) && r.some(c => String(c ?? '').trim())))
      || (ans.outputs && typeof ans.outputs === 'object' && Object.values(ans.outputs).some(v => String(v ?? '').trim()));
    const attempted = !!(ans.selected != null || ans.picked != null || (ans.finalValue != null && String(ans.finalValue).trim()) || (ans.proofText && ans.proofText.trim()) || (ans.targetVal && String(ans.targetVal).trim()) || (Array.isArray(ans.ticks) && ans.ticks.some(Boolean)) || (ans.score > 0) || (ans.text && ans.text.trim())
      || (ans.code && ans.code.trim())
      || hasTableInput || ans.tickedCount != null || (ans.ticked && ans.ticked.length));
    return {
      id: q.id || null,
      topic: q.topic || q._topic || null,
      subtopic: q.subtopic || null,
      type: q.type,
      score,
      marks: qm,
      attempted
    };
  });

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
    topics: [...new Set((S.quiz.questions || []).map(q => q.topic || q._topic).filter(Boolean))],
    perQuestion,
    date: new Date().toISOString()
  };
  if (S.series) {
    entry.seriesId = S.series.id;
    entry.seriesIndex = S.series.index;
  }

  try {
    await api('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    // only clear the save if it belongs to this run — finishing quiz A must
    // not destroy an in-progress save of quiz B
    try {
      const cur = await api('/api/save');
      const mine = cur && (cur.quizUuid === S.quiz.uuid || cur.uuid === S.quiz.uuid) && (!cur.quizFile || cur.quizFile === S.quizMeta?.file);
      if (mine) { await api('/api/save', { method: 'DELETE' }); S.save = null; }
      else S.save = cur || S.save;
    } catch {}
    S.scores = await api('/api/scores').catch(() => []);
  } catch {}

  // mock-series interception — series papers route to intermission/final
  if (S.series) return renderSeriesStage(entry);

  S.room = 'results';
  const pctScore = maxMarks ? Math.round((totalScore / maxMarks) * 100) : 0;

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
  
      <div id="rw-root" style="margin-top:28px; text-align:left; max-height:520px; overflow:auto;">
        <div class="mono" style="font-size:11.5px; color:var(--ink-muted); margin-bottom:8px;">REVIEW — question walk-through with mark scheme &amp; examiner feedback</div>
        ${reviewWalkHtml(S.quiz.questions || [], S.answers || {})}
      </div>
    `;

  $('#retryResBtn').onclick = () => retryRun();
  $('#exploreResBtn').onclick = () => {
    S.runMode = 'explore';
    S.idx = 0;
    S.room = 'runner';
    renderQ();
  };
  $('#backResBtn').onclick = () => {
    S.room = 'past';

  // print parity — the exact paper just taken, student copy + teacher scheme
  try {
    const anchor = $('#backResBtn');
    if (anchor && !$('#finishPrintPaperBtn')) {
      const mk = (id, lbl) => {
        const b = document.createElement('button');
        b.className = 'btn btn-ghost';
        b.id = id;
        b.textContent = lbl;
        b.style.cssText = 'padding:10px 14px; font-size:12.5px; margin-left:8px;';
        anchor.parentElement.appendChild(b);
        return b;
      };
      const spec = () => ({
        title: S.quiz.title || 'Paper',
        portal: 'A-Level Mathematics · OCR',
        timeMinutes: S.quiz.timeLimitMinutes || null,
        questions: S.quiz.questions || []
      });
      mk('finishPrintPaperBtn', '⎙ Print paper').onclick = () => openPrintWindow(paperPrintDoc(spec()));
      mk('finishPrintSchemeBtn', '⎙ Mark scheme').onclick = () => openPrintWindow(markSchemePrintDoc(spec()));
    }
  } catch {}
    renderRoom();
  };
}


// ---- mock series staging + print parity ----------------------------------

async function writeSeriesSave() {
  try {
    const body = {
      seriesContinuation: true,
      series: S.series,
      title: `Mock series · paper ${S.series.index + 1} of ${S.series.papers.length}`,
      savedAt: new Date().toISOString(),
    };
    await api('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    S.save = { ...body, updatedAt: body.savedAt };
  } catch {}
}

async function renderSeriesStage(entry) {
  recordPaperResult(S.series, { ...entry });
  await writeSeriesSave();
  const prog = seriesProgress(S.series);
  if (prog.complete) return renderSeriesFinal();
  const next = S.series.papers[S.series.index];
  $('#stage').innerHTML = breakScreenHtml(S.series, {
    paperTitle: entry.quizTitle,
    score: entry.score,
    total: entry.total,
    nextTitle: next.title,
    expired: !!S.timeExpired,
  });
  let remaining = Math.max(0, Math.round((S.series.breakMinutes || 10) * 60));
  const clock = $('#seriesBreakClock');
  const contBtn = $('#seriesContinueBtn');
  const tick = setInterval(() => {
    remaining -= 1;
    if (clock) clock.textContent = fmtClock(remaining);
    if (remaining <= 0) {
      clearInterval(tick);
      if (contBtn) contBtn.disabled = false;
      if (clock) clock.textContent = '0m 0s';
    }
  }, 1000);
  const advance = (skipped) => {
    clearInterval(tick);
    recordBreak(S.series, { skipped, minutes: Math.round(((S.series.breakMinutes || 10) * 60 - Math.max(0, remaining)) / 60) });
    beginSeriesPaper();
  };
  if (contBtn) contBtn.onclick = () => advance(false);
  const skip = $('#seriesSkipBreakBtn');
  if (skip) skip.onclick = () => advance(true);
}

async function renderSeriesFinal() {
  $('#stage').innerHTML = seriesFinishHtml(S.series, { portal: 'A-Level Mathematics · OCR' });
  S.series = null;
  try { await api('/api/save', { method: 'DELETE' }); } catch {}
  S.save = null;
  const done = $('#seriesDoneBtn');
  if (done) done.onclick = () => { S.room = 'past'; renderRoom(); };
}

export async function resumeSeriesContinuation(sv) {
  S.series = sv.series;
  if (!S.series || !S.series.papers) { S.room = 'past'; return renderRoom(); }
  const prog = seriesProgress(S.series);
  if (prog.complete) return renderSeriesFinal();
  const next = S.series.papers[S.series.index];
  $('#stage').innerHTML = `
    <div class="card" style="text-align:center; padding:36px 30px; max-width:640px; margin:0 auto;">
      <div class="mono" style="font-size:11px; color:var(--ink-muted); letter-spacing:.08em; text-transform:uppercase;">Mock series · resuming</div>
      <h2 class="serif" style="font-size:24px; margin:10px 0 6px;">Ready for paper ${S.series.index + 1} of ${S.series.papers.length}</h2>
      <div style="font-size:13.5px; opacity:.85;">Next: <strong>${esc(next.title)}</strong>${next.timeLimitMinutes ? ` · ${next.timeLimitMinutes} minutes` : ''}</div>
      <div class="mono" style="font-size:11.5px; color:var(--ink-muted); margin-top:6px;">break time elapsed while away counts as the break</div>
      <button class="btn btn-primary" id="seriesResumeNextBtn" style="margin-top:16px;">Begin next paper</button>
    </div>`;
  const b = $('#seriesResumeNextBtn');
  if (b) b.onclick = () => { recordBreak(S.series, { skipped: false, minutes: S.series.breakMinutes }); beginSeriesPaper(); };
}
