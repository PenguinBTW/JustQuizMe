// Physics Attempt History Room View
import { S, MIXED_UUID } from '../state.js';
import { $, esc, num, fmtDate, fmtDur } from '../utils.js';
import { roomNav, wireRoomNav, renderRoom } from '../navigation.js';
import { beginFileQuiz, startReviewRun } from '../runner/starters.js';
import { reviewQueue, REVIEW_DECK_CAP } from '../review.js';

export function pastEntries(){
  const uuids = new Set([...S.quizzes['past-paper'].map(m => m.uuid), MIXED_UUID]);
  return S.scores.filter(s => uuids.has(s.quizUuid)).slice().reverse();
}

export function practiceEntries(){
  const uuids = new Set(S.quizzes.normal.map(m => m.uuid));
  return S.scores.filter(s => uuids.has(s.quizUuid)).slice().reverse();
}

export function pct(a){ return a.total ? Math.round(a.score / a.total * 100) : 0; }

export function pillFor(p){
  return p >= 80 ? 'green' : p >= 60 ? 'amber' : 'red';
}

export function entryBreakdownLine(a){
  const b = a.breakdown;
  const bits = [];
  if (b){
    if (b.mcq && b.mcq.total) bits.push(`MCQ ${b.mcq.got}/${b.mcq.total}`);
    if (b.written && b.written.total) bits.push(`Written ${b.written.got}/${b.written.total}`);
    if (b.cSolo && b.cSolo.total) bits.push(`Calc ${b.cSolo.got}/${b.cSolo.total}`);
    if (b.self && b.self.total) bits.push(`Self ${b.self.got}/${b.self.total}`);
  }
  bits.push((a.helped && a.helped.length) ? `Helped: ${a.helped.join(', ')}` : '0 helped');
  return bits.join(' · ');
}

export function historyEntryHtml(a, retryLabel){
  const p = pct(a);
  const canRetry = retryLabel && a.quizFile && a.quizFile !== 'mixed' && /\.json$/i.test(a.quizFile);
  return `<div class="history-entry">
    <div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
        <strong style="font-size:15.5px;">${esc(a.quizTitle || a.quizFile || 'Quiz')}</strong>
        <span class="pill ${a.exam ? 'accent' : ''}">${a.exam ? 'Exam Conditions' : 'Standard Quiz'}</span>
      </div>
      <div class="mono" style="font-size:12px; color:var(--ink-muted);">
        ${fmtDate(a.date)} · ${fmtDur((a.minutes || 0) * 60 + (a.seconds || 0))} · ${esc(entryBreakdownLine(a))}
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:12px;">
      <span class="pill ${pillFor(p)}">${p}% · ${a.score}/${a.total}</span>
      ${canRetry ? `<button class="btn" style="padding:5px 13px; font-size:12px;" data-retry-entry="${esc(a.quizUuid)}|${esc(a.quizFile)}">${esc(retryLabel)}</button>` : ''}
    </div>
  </div>`;
}

export function reviewRowHtml(i){
  return `<div class="history-entry">
    <div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
        <strong style="font-size:15.5px;">${esc(i.qid.toUpperCase())}</strong>
        <span class="pill">${esc(i.fileKey)}.json</span>
        ${i.cat === 'normal' ? '<span class="pill">practice</span>' : ''}
        ${i.misses > 1 ? `<span class="pill red">${i.misses} misses</span>` : ''}
      </div>
      <div class="mono" style="font-size:12px; color:var(--ink-muted);">
        ${esc(i.quizTitle || 'Quiz')} · last ${i.got}/${i.marks ?? '?'} marks${i.date ? ` · ${fmtDate(i.date)}` : ''}
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:12px;">
      <span class="pill ${i.lost != null && i.lost <= 1 ? 'amber' : 'red'}">${i.lost != null ? `${i.lost}m owed` : 'helped'}</span>
    </div>
  </div>`;
}

export function renderHistory(){
  const isReview = S.historySrc === 'review';
  const isPast = !isReview && S.historySrc !== 'practice';
  let body = '';
  if (isReview){
    const items = reviewQueue();
    const owed = items.reduce((s, i) => s + (i.lost ?? 0), 0);
    const repeat = items.filter(i => i.misses > 1).length;
    body = `<div id="historyReviewView">
      <div class="history-stats-grid">
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Questions Queued</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${items.length}</div>
          <span class="mono" style="font-size:12px; color:var(--ink-secondary);">missed or part-scored, latest outcome wins</span>
        </div>
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Marks Still Owed</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${num(owed)}</div>
          <span class="mono" style="font-size:12px; color:var(--ink-secondary);">dropped on the most recent attempt</span>
        </div>
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Repeat Offenders</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${repeat}</div>
          <span class="mono" style="font-size:12px; color:var(--amber);">weak across 2+ sessions</span>
        </div>
      </div>
      ${items.length ? `<div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px;">
        <button class="btn btn-primary" id="reviewStartBtn">Start Review Deck (${Math.min(items.length, REVIEW_DECK_CAP)}Q)</button>
        <button class="btn" id="reviewExamBtn">Exam Conditions</button>
      </div>` : ''}
      <div class="card" style="padding: 10px 28px;">
        ${items.map(reviewRowHtml).join('') || '<p class="mono" style="font-size:12.5px; color:var(--ink-muted); padding:18px 0;">Nothing queued — questions you miss or part-score will appear here after a run.</p>'}
      </div>
    </div>`;
  } else if (isPast){
    const list = pastEntries();
    const bankTotal = S.quizzes['past-paper'].reduce((s, m) => s + m.totalMarks, 0);
    const avg = list.length ? Math.round(list.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / list.length * 100) : 0;
    const earned = list.reduce((s, a) => s + (a.score || 0), 0);
    let soloGot = 0, soloTot = 0, helpedN = 0;
    for (const a of list){
      if (a.breakdown?.cSolo){ soloGot += a.breakdown.cSolo.got || 0; soloTot += a.breakdown.cSolo.total || 0; }
      helpedN += (a.helped || []).length;
    }
    const soloRate = soloTot ? Math.round(soloGot / soloTot * 100) : 0;
    body = `<div id="historyPastView">
      <div class="history-stats-grid">
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Past-Paper Average</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${avg}%</div>
          <span class="mono" style="font-size:12px; color:var(--ink-secondary);">${list.length} logged session${list.length === 1 ? '' : 's'}</span>
        </div>
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Marks Completed</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${num(earned)} <span style="font-size:20px; color:var(--ink-muted);">/ ${num(bankTotal)}</span></div>
          <span class="mono" style="font-size:12px; color:var(--ink-secondary);">across all past sessions</span>
        </div>
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Solo Calculation Rate</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${soloRate}%</div>
          <span class="mono" style="font-size:12px; color:var(--amber);">${helpedN} helped via steps</span>
        </div>
      </div>
      <div class="card" style="padding: 10px 28px;">
        ${list.map(a => historyEntryHtml(a, 'Retry Shuffle')).join('') || '<p class="mono" style="font-size:12.5px; color:var(--ink-muted); padding:18px 0;">No past-paper attempts logged yet.</p>'}
      </div>
    </div>`;
  } else {
    const list = practiceEntries();
    const runs = list.slice().reverse();
    const best = list.length ? list.reduce((m, x) => (x.total && x.score / x.total > (m.total ? m.score / m.total : -1)) ? x : m, list[0]) : null;
    const bp = best ? pct(best) : 0;
    const ver = best ? (S.quizzes.normal.find(m => m.uuid === best.quizUuid)?.version ?? best.quizVersion ?? 1) : '-';
    const helpTrend = runs.length >= 2 ? `${(runs[0].helped || []).length} → ${(runs[runs.length - 1].helped || []).length}` : '-';
    body = `<div id="historyPracticeView">
      <div class="history-stats-grid">
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Practice Set Best</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${list.length ? bp + '%' : '-'}</div>
          <span class="mono" style="font-size:12px; color:var(--green);">${best ? `${best.score} / ${best.total} marks` : 'no runs yet'}</span>
        </div>
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Set Version</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${list.length ? 'v' + ver : '-'}</div>
          <span class="mono" style="font-size:12px; color:var(--ink-secondary);">${best ? esc((best.quizFile || '').replace(/\.json$/i, '') + '.json') : ''}</span>
        </div>
        <div class="history-stat-card">
          <span class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase;">Helped Reduction</span>
          <div class="serif" style="font-size:36px; line-height:1.1; margin-top:4px;">${helpTrend}</div>
          <span class="mono" style="font-size:12px; color:var(--green);">Across ${runs.length} full run${runs.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="card" style="padding: 10px 28px;">
        ${list.map(a => historyEntryHtml(a, 'Retry Set')).join('') || '<p class="mono" style="font-size:12.5px; color:var(--ink-muted); padding:18px 0;">No practice-set attempts logged yet.</p>'}
      </div>
    </div>`;
  }

  $('#stage').innerHTML = `
  ${roomNav('history')}
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
    <div>
      <h2 class="serif" style="font-size: 28px; line-height: 1.15;">Recorded Sessions &amp; Telemetry</h2>
      <p style="font-size: 13.5px; color: var(--ink-secondary);">Every completed run logged newest-first with per-type breakdowns and helped question IDs.</p>
    </div>
    <div class="segmented">
      <button class="${isPast ? 'active' : ''}" id="histTabPast">Past Papers (${pastEntries().length})</button>
      <button class="${!isPast && !isReview ? 'active' : ''}" id="histTabPractice">Practice Sets (${practiceEntries().length})</button>
      <button class="${isReview ? 'active' : ''}" id="histTabReview">Review Queue (${reviewQueue().length})</button>
    </div>
  </div>
  ${body}`;
  wireRoomNav();
  $('#histTabPast').onclick = () => { S.historySrc = 'past'; renderRoom(); };
  $('#histTabPractice').onclick = () => { S.historySrc = 'practice'; renderRoom(); };
  $('#histTabReview').onclick = () => { S.historySrc = 'review'; renderRoom(); };
  const rsBtn = $('#reviewStartBtn');
  if (rsBtn) rsBtn.onclick = () => startReviewRun(false);
  const reBtn = $('#reviewExamBtn');
  if (reBtn) reBtn.onclick = () => startReviewRun(true);
  document.querySelectorAll('[data-retry-entry]').forEach(b => b.onclick = () => {
    const [uuid, file] = b.dataset.retryEntry.split('|');
    const inNormal = S.quizzes.normal.some(m => m.file === file);
    beginFileQuiz(inNormal ? 'normal' : 'past-paper', file, !inNormal);
  });
}
