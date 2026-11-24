// Computer Science Finish Quiz & Summary Audit Report
import { S, MIXED_UUID } from '../state.js';
import { $, esc, fmtDur, ak } from '../utils.js';
import { api, loadHome } from '../api.js';
import { evaluateTraceTable, evaluateTruthTable, evaluateCalculation } from './evaluators.js';
import { reviewWalkHtml } from '../../../shared/js/reviewWalk.js';

export async function finishQuiz(auto) {
  if (S._finishing) return;
  S._finishing = true;
  clearInterval(S.timerId);
  // a suspended-then-woken tab must not record time past the deadline
  if (S.quiz && S.quiz.exam && S.quiz.timeLimitMinutes) S.elapsed = Math.min(S.elapsed, Math.round(S.quiz.timeLimitMinutes * 60));
  if (auto === true) S.timeExpired = true;

  // If Exam Mode, run batch code tests strictly once now!
  if (S.runMode === 'exam') {
    $('#stage').innerHTML = `
      <div class="card" style="text-align:center; padding:40px;">
        <h2 class="serif" style="font-size:32px; margin-bottom:12px;">Evaluating Exam Submissions...</h2>
        <p class="mono" style="color:var(--accent);">Executing single-run requirement test suites for C#, OCR Pseudocode, LMC, Trace Tables, and Truth Tables...</p>
      </div>
    
      <div id="rw-root" style="margin-top:28px; text-align:left; max-height:520px; overflow:auto;">
        <div class="mono" style="font-size:11.5px; color:var(--ink-muted); margin-bottom:8px;">REVIEW — question walk-through with mark scheme &amp; examiner feedback</div>
        ${reviewWalkHtml(S.quiz.questions || [], S.answers || {})}
      </div>
    `;

    const codeSubmissions = [];
    S.quiz.questions.forEach(q => {
      const qKey = ak(q);
      const ans = S.answers[qKey] || {};

      if (q.type === 'code-requirement') {
        codeSubmissions.push({
          questionId: qKey,
          language: ans.language || (q.allowedLanguages?.[0] || 'ocr'),
          code: ans.code || '',
          requirements: q.requirements || [],
          options: { entryFunction: q.entryFunction, entryMethod: q.entryMethod, className: q.className, mockFiles: q.mockFiles }
        });
      } else if (q.type === 'lmc') {
        codeSubmissions.push({
          questionId: qKey,
          language: 'lmc',
          code: ans.code || '',
          requirements: q.requirements || [],
          options: {}
        });
      } else if (q.type === 'trace-table') {
        evaluateTraceTable(q, ans);
      } else if (q.type === 'truth-table') {
        evaluateTruthTable(q, ans);
      } else if (q.type === 'calculation') {
        evaluateCalculation(q, ans);
      }
    });

    if (codeSubmissions.length > 0) {
      try {
        const bRes = await api('/api/execute/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissions: codeSubmissions })
        });
        if (bRes.results) {
          for (const [qid, res] of Object.entries(bRes.results)) {
            if (S.answers[qid]) {
              const matchingQ = (S.quiz?.questions || []).find(q => ak(q) === qid);
              const maxQMarks = matchingQ ? (+matchingQ.marks || 0) : Infinity;
              const earnedScore = Math.min(maxQMarks, res.totalScore || 0);
              S.answers[qid].results = res.results || [];
              S.answers[qid].totalScore = earnedScore;
              S.answers[qid].score = earnedScore;
              S.answers[qid].compileError = res.compileError || null;
              S.answers[qid].lastRunStdout = res.stdout || '';
            }
          }
        }
      } catch (e) {
        console.error('Batch evaluation error:', e);
      }
    }
  }

  // Score any MCQ selection that has no recorded score yet — exam papers score here by
  // design, and resumed exams re-enter in quiz mode so their selections must not be lost.
  // Already-scored answers (quiz mode locks+scores at click time) are untouched.
  (S.quiz?.questions || []).forEach(q => {
    if (q.type !== 'multiple-choice') return;
    const ans = S.answers[ak(q)] || {};
    if (ans.score == null && ans.selected != null || ans.picked != null || (Array.isArray(ans.ticks) && ans.ticks.some(Boolean)) || (ans.score > 0)) {
      ans.score = ans.selected === q.correctIndex ? (+q.marks || 0) : 0;
    }
    if (ans.selected != null) ans.locked = true;
  });

  // Clear save file
  try { await api('/api/save', { method: 'DELETE' }); } catch {}
  S.save = null;

  renderSummaryReport();
}

export async function renderSummaryReport() {
  let earned = 0;
  let total = 0;
  const breakdown = {
    mcq: { got: 0, total: 0 },
    written: { got: 0, total: 0 },
    discrete: { got: 0, total: 0 },
    coding: { got: 0, total: 0 }
  };

  S.quiz.questions.forEach(q => {
    const qm = +q.marks || 0;
    total += qm;
    const ans = S.answers[ak(q)] || {};
    const score = Math.min(qm, Math.max(0, ans.score || 0));
    earned += score;

    if (q.type === 'multiple-choice') {
      breakdown.mcq.total += qm;
      breakdown.mcq.got += score;
    } else if (q.type === 'written' || q.type === 'extended-response' || q.type === 'self-marked') {
      breakdown.written.total += qm;
      breakdown.written.got += score;
    } else if (q.type === 'calculation' || q.type === 'trace-table' || q.type === 'truth-table') {
      breakdown.discrete.total += qm;
      breakdown.discrete.got += score;
    } else if (q.type === 'code-requirement' || q.type === 'lmc') {
      breakdown.coding.total += qm;
      breakdown.coding.got += score;
    }
  });

  const pct = Math.round((earned / (total || 1)) * 100);

  // Per-question outcomes — the data-integrity layer mastery is built on.
  // attempted: the student engaged the question at all (typed text, picked an
  // option, self-marked, ran code). Unattempted questions still record 0 score
  // against full marks — skipping a topic in an exam is honest signal.
  const perQuestion = (S.quiz.questions || []).map(q => {
    const ans = S.answers[ak(q)] || {};
    const qm = +q.marks || 0;
    const score = Math.min(qm, Math.max(0, ans.score || 0));
    const hasTableInput = (Array.isArray(ans.rows) && ans.rows.some(r => Array.isArray(r) && r.some(c => String(c ?? '').trim())))
      || (ans.outputs && typeof ans.outputs === 'object' && Object.values(ans.outputs).some(v => String(v ?? '').trim()));
    const attempted = !!(ans.selected != null || ans.picked != null || (Array.isArray(ans.ticks) && ans.ticks.some(Boolean)) || (ans.score > 0) || (ans.text && ans.text.trim())
      || (ans.code && ans.code.trim() && (() => {
        const sc = q.starterCode;
        const starters = typeof sc === 'string' ? [sc] : (sc && typeof sc === 'object' ? Object.values(sc) : []);
        return !starters.some(st => typeof st === 'string' && st.trim() === String(ans.code).trim());
      })())
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

  // Save to scores.json
  const scoreEntry = {
    quizUuid: S.quiz.uuid || MIXED_UUID,
    quizVersion: S.quiz.version || 1,
    quizFile: S.quizMeta?.file || '',
    quizTitle: S.quiz.title || 'OCR CS Assessment',
    score: earned,
    total,
    minutes: Math.floor(S.elapsed / 60),
    seconds: S.elapsed,
    exam: S.runMode === 'exam',
    topics: [...new Set((S.quiz.questions || []).map(q => q.topic || q._topic).filter(Boolean))],
    breakdown,
    perQuestion
  };
  try {
    // explore mode is explicitly unscored ('Explore · No Score') — writing an entry
    // would count unvisited questions as missed marks in mastery. Skip the write.
    if (S.runMode !== 'explore') {
      await api('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreEntry)
      });
      // keep the in-memory list in sync so Stats/CSV see the run that just
      // saved — mirrors the server's newest-first unshift + 500-entry cap
      (S.scores = S.scores || []).unshift({ ...scoreEntry, date: new Date().toISOString() });
      if (S.scores.length > 500) S.scores.length = 500;
    }
  } catch {}

  $('#stage').innerHTML = `
    <div class="card" style="text-align:center; padding:44px 32px;">
      ${S.timeExpired ? `<p class="mono" style="font-size:13px; color:var(--ink-secondary); margin-bottom:14px;">⏱ Time expired — your paper was submitted automatically with everything you had written.</p>` : ''}
      <span class="pill accent" style="margin-bottom:12px;">${S.runMode.toUpperCase()} MODE COMPLETE</span>
      <h1 class="serif" style="font-size:42px; margin-bottom:8px;">${esc(S.quiz.title)}</h1>
      <div style="font-size:56px; font-weight:700; color:var(--accent); font-family:'JetBrains Mono',monospace; margin:18px 0;">
        ${earned} / ${total} <span style="font-size:24px; color:var(--ink-muted);">(${pct}%)</span>
      </div>
      <p style="color:var(--ink-secondary); font-size:14px; margin-bottom:32px;">
        Assessment completed in ${fmtDur(S.elapsed)}.
      </p>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:36px; text-align:left;">
        <div class="card" style="padding:16px 20px;">
          <div class="mono" style="font-size:11px; color:var(--ink-muted);">MULTIPLE CHOICE</div>
          <div class="mono" style="font-size:22px; font-weight:700; margin-top:4px;">${breakdown.mcq.got} / ${breakdown.mcq.total}</div>
        </div>
        <div class="card" style="padding:16px 20px;">
          <div class="mono" style="font-size:11px; color:var(--ink-muted);">WRITTEN &amp; ESSAYS</div>
          <div class="mono" style="font-size:22px; font-weight:700; margin-top:4px;">${breakdown.written.got} / ${breakdown.written.total}</div>
        </div>
        <div class="card" style="padding:16px 20px;">
          <div class="mono" style="font-size:11px; color:var(--ink-muted);">TRACE &amp; TRUTH TABLES</div>
          <div class="mono" style="font-size:22px; font-weight:700; margin-top:4px; color:var(--accent);">${breakdown.discrete.got} / ${breakdown.discrete.total}</div>
        </div>
        <div class="card" style="padding:16px 20px;">
          <div class="mono" style="font-size:11px; color:var(--ink-muted);">CODING &amp; ASSEMBLY</div>
          <div class="mono" style="font-size:22px; font-weight:700; margin-top:4px; color:var(--accent);">${breakdown.coding.got} / ${breakdown.coding.total}</div>
        </div>
      </div>

      <button class="btn btn-jade" id="finishReturnBtn" style="padding:10px 28px; font-size:14px;">Return to Question Banks</button>
    </div>
  `;

  $('#finishReturnBtn')?.addEventListener('click', () => loadHome());
}
