// Physics Quiz Results & Scoring Controller
import { S } from '../state.js';
import { $, esc, fmtDur, ak } from '../utils.js';
import { api } from '../api.js';
import { renderRoom } from '../navigation.js';
import { retryRun } from './starters.js';

export function quizScore(){
  let score = 0, total = 0, mcq = { got: 0, total: 0 }, w = { got: 0, total: 0 }, c = { got: 0, total: 0 }, s = { got: 0, total: 0 };
  const helped = [];
  for (const q of S.quiz.questions){
    total += q.marks; const a = S.answers[ak(q)];
    const sc = a?.score ?? 0; score += sc;
    if (q.type === 'multiple-choice'){ mcq.total += q.marks; mcq.got += sc; }
    else if (q.type === 'written'){ w.total += q.marks; w.got += sc; }
    else if (q.type === 'self-marked'){ s.total += q.marks; s.got += sc; }
    else { c.total += q.marks; c.got += sc; if (a?.helped) helped.push(ak(q).toUpperCase()); }
  }
  return { score, total, mcq, w, c, s, helped };
}

export async function finishQuiz(auto = false){
  if (auto === true) S.timeExpired = true;
  clearInterval(S.timerId);
  for (const q of S.quiz.questions){
    const k = ak(q), a = S.answers[k];
    if (q.type === 'written' && !(a?.locked)){ const n = ((a?.ticks) || []).filter(Boolean).length; S.answers[k] = { ...(a || {}), locked: true, score: Math.min(n, q.marks) }; }
    else if (q.type === 'self-marked' && !(a?.locked)){ const n = ((a?.ticks) || []).filter(Boolean).length; S.answers[k] = { ...(a || {}), locked: true, revealed: true, score: Math.min(n, q.marks) }; }
    else if (q.type === 'multiple-choice' && !(a?.locked)){ S.answers[k] = { locked: true, picked: null, correct: false, score: 0 }; }
    else if (q.type === 'calculation' && !(a?.locked)){ if (a?.helpedDone){ S.answers[k].score = 0; } else S.answers[k] = { ...(a || {}), locked: true, loggedWrong: (a?.attempts || 0) > 0, score: 0 }; }
  }
  const r = quizScore();
  const entry = { quizUuid: S.quiz.uuid, quizVersion: S.quiz.version, quizFile: S.quizMeta.file, quizTitle: S.quiz.title, score: r.score, total: r.total, minutes: Math.round(S.elapsed / 60), seconds: S.elapsed, helped: r.helped, exam: !!S.quiz.exam, topics: [...new Set((S.quiz.questions || []).map(q => q.topic || q._topic).filter(Boolean))], perQuestion: (S.quiz.questions || []).map(q => { const ans = S.answers[ak(q)] || {}; const qm = +q.marks || 0; return { id: q.id || null, topic: q.topic || q._topic || null, subtopic: q.subtopic || null, type: q.type, score: Math.min(qm, Math.max(0, ans.score || 0)), marks: qm, attempted: !!(ans.selected != null || ans.picked != null || (ans.text && ans.text.trim()) || (ans.code && ans.code.trim()) || (Array.isArray(ans.rows) && ans.rows.some(r => Array.isArray(r) && r.some(c => String(c ?? '').trim()))) || (ans.outputs && typeof ans.outputs === 'object' && Object.values(ans.outputs).some(v => String(v ?? '').trim())) || ans.tickedCount != null || (ans.ticked && ans.ticked.length)) }; }), breakdown: { mcq: r.mcq, written: r.w, cSolo: r.c, self: r.s }, date: new Date().toISOString() };
  let saved = null;
  try { await api('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }); saved = true; } catch { saved = false; }
  try { await api('/api/save', { method: 'DELETE' }); } catch {}
  S.save = null;
  S.scores = await api('/api/scores').catch(() => []);
  S.room = 'results';
  const pctScore = r.total ? Math.round(r.score / r.total * 100) : 0;
  const row = (label, g, t, color, suffix) => `
    <div class="stat-row">
      <span${color === 'amber' ? ' style="color:var(--amber);"' : ''}>${label}</span>
      <div class="stat-track"><div class="stat-fill" style="width:${t ? Math.round(g / t * 100) : 0}%; background:var(--${color});"></div></div>
      <span class="mono" style="text-align:right;${color === 'amber' ? ' color:var(--amber);' : ''};">${suffix || `${g} / ${t}`}</span>
    </div>`;
  $('#stage').innerHTML = `
  <div class="card" style="text-align:center; padding: 40px 32px; margin-bottom: 28px;">
    <span class="pill green" style="margin-bottom: 12px;">${saved ? 'Saved to data/scores.json' : '⚠ Could not save scores.json'}</span>
    <h1 class="serif" style="font-size: 64px; line-height: 1; margin-bottom: 8px;">${pctScore}%</h1>
    <p class="mono" style="font-size: 14px; color: var(--ink-secondary); margin-bottom: 28px;">
      ${r.score} / ${r.total} Marks · ${fmtDur(S.elapsed)} · ${r.helped.length} Question${r.helped.length === 1 ? '' : 's'} Helped${auto ? ' · auto-finished: time limit reached' : ''}${S.quiz.exam ? ' · exam conditions' : ''}
    </p>
    <div style="max-width: 560px; margin: 0 auto 32px; text-align:left;">
      ${row('Multiple Choice', r.mcq.got, r.mcq.total, 'green')}
      ${row('Written', r.w.got, r.w.total, 'green')}
      ${row('Calculation (Solo)', r.c.got, r.c.total, 'blue')}
      ${r.s.total ? row('Self-Marked', r.s.got, r.s.total, 'green') : ''}
      <div class="stat-row" style="border-bottom:none;">
        <span style="color:var(--amber);">Helped with Steps</span>
        <div class="stat-track"><div class="stat-fill" style="width:${r.c.total ? Math.round((r.c.total - r.c.got) / r.c.total * 100) : 0}%; background:var(--amber);"></div></div>
        <span class="mono" style="text-align:right; color:var(--amber);">${r.c.total - r.c.got} marks</span>
      </div>
    </div>
    <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
      <button class="btn" id="backHomeBtn">Back to Library</button>
      <button class="btn btn-primary" id="retryBtn">Try Again (Fresh Shuffle)</button>
    </div>
  </div>`;
  $('#backHomeBtn').onclick = () => { S.room = S.returnRoom || 'past'; renderRoom(); };
  $('#retryBtn').onclick = () => retryRun();
  window.scrollTo(0, 0);
  if (window.renderMath) window.renderMath();
}
