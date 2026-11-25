// Mock exam series — multiple component papers sat back-to-back under fatigue.
// Pure series state machine + rendering helpers; the runner integration lives
// in each portal. No dependencies.

export function createSeries(papers, { breakMinutes = 10 } = {}) {
  // papers: [{key, title, file, category, totalMarks, timeLimitMinutes}]
  return {
    id: 'series-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    papers: papers.map((p, i) => ({ ...p, index: i })),
    index: 0,
    breakMinutes,
    results: [],   // per-paper score entries as written to scores.json
    breaks: [],    // {afterIndex, minutes, skipped, startedAt, endedAt}
    startedAt: new Date().toISOString(),
  };
}

export function seriesProgress(series) {
  if (!series || !series.papers) return { done: 0, total: 0, complete: true };
  const total = series.papers.length;
  const done = series.results.length;
  return { done, total, complete: done >= total, currentIndex: series.index };
}

export function recordPaperResult(series, entry) {
  series.results.push({ ...entry, seriesIndex: series.index });
  series.index += 1;
  return series;
}

export function recordBreak(series, { skipped = false, minutes = 0 } = {}) {
  series.breaks.push({
    afterIndex: series.index - 1,
    minutes,
    skipped,
    endedAt: new Date().toISOString(),
  });
  return series;
}

// grade boundaries: used when a paper carries them (bank meta), honest
// fallback to raw percentages otherwise
export function gradeFor(pct, boundaries) {
  if (!boundaries || typeof boundaries !== 'object') return null;
  const order = ['A*', 'A', 'B', 'C', 'D', 'E'];
  for (const g of order) {
    if (boundaries[g] != null && pct >= boundaries[g]) return g;
  }
  return boundaries.E != null ? 'U' : null;
}

export function seriesSummary(series) {
  const papers = (series.papers || []).map((p, i) => {
    const r = (series.results || [])[i] || null;
    const score = r ? +r.score || 0 : 0;
    const total = r ? +r.total || 0 : (+p.totalMarks || 0);
    const pct = total ? Math.round((score / total) * 100) : 0;
    return {
      key: p.key, title: p.title, index: i,
      score, total, pct,
      seconds: r ? +r.seconds || 0 : 0,
      grade: gradeFor(pct, p.boundaries),
      done: !!r,
    };
  });
  const totalScore = papers.reduce((s, p) => s + p.score, 0);
  const totalMarks = papers.reduce((s, p) => s + p.total, 0);
  const totalSeconds = papers.reduce((s, p) => s + p.seconds, 0);
  const pct = totalMarks ? Math.round((totalScore / totalMarks) * 100) : 0;
  return { papers, totalScore, totalMarks, totalSeconds, pct };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// intermission screen after paper N: result recap + enforced break + continue
export function breakScreenHtml(series, { paperTitle, score, total, nextTitle, expired }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const prog = seriesProgress(series);
  return `
    <div class="card" style="text-align:center; padding:36px 30px; max-width:640px; margin:0 auto;">
      <div class="mono" style="font-size:11px; color:var(--ink-muted); letter-spacing:.08em; text-transform:uppercase;">Mock series · paper ${prog.done} of ${prog.total} complete</div>
      <h2 class="serif" style="font-size:26px; margin:10px 0 4px;">${esc(paperTitle)}</h2>
      <div class="mono" style="font-size:22px; color:var(--accent); font-weight:700;">${score} / ${total} <span style="font-size:13px; color:var(--ink-muted);">(${pct}%)</span></div>
      ${expired ? '<div class="mono" style="font-size:11.5px; color:var(--ink-muted); margin-top:4px;">time expired — paper auto-submitted</div>' : ''}
      <div style="border-top:1px solid var(--border); margin:22px 0 14px; padding-top:18px;">
        <div class="mono" style="font-size:11px; color:var(--ink-muted); text-transform:uppercase; letter-spacing:.08em;">Break before next paper</div>
        <div class="mono" id="seriesBreakClock" style="font-size:34px; font-weight:700; margin:8px 0 4px;">${series.breakMinutes}:00</div>
        <div style="font-size:13px; opacity:.85;">Next: <strong>${esc(nextTitle)}</strong></div>
        <div style="display:flex; gap:8px; justify-content:center; margin-top:16px;">
          <button class="btn btn-primary" id="seriesContinueBtn" disabled>Continue to next paper</button>
          <button class="btn-ghost mono" style="font-size:11.5px;" id="seriesSkipBreakBtn">skip break (recorded)</button>
        </div>
      </div>
    </div>`;
}

export function seriesFinishHtml(series, { portal }) {
  const sum = seriesSummary(series);
  const rows = sum.papers.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
      <div><strong style="font-size:13.5px;">${esc(p.title)}</strong>${p.grade ? ` <span class="pill" style="margin-left:6px;">${p.grade}</span>` : ''}</div>
      <div class="mono" style="font-size:13px;">${p.score}/${p.total} <span style="color:var(--ink-muted);">(${p.pct}%)</span> · ${fmtClock(p.seconds)}</div>
    </div>`).join('');
  const skipped = (series.breaks || []).filter(b => b.skipped).length;
  return `
    <div class="card" style="padding:28px 30px; max-width:680px; margin:0 auto;">
      <div class="mono" style="font-size:11px; color:var(--ink-muted); letter-spacing:.08em; text-transform:uppercase;">Mock series complete · ${esc(portal || '')}</div>
      <h2 class="serif" style="font-size:28px; margin:8px 0 2px;">${sum.totalScore} / ${sum.totalMarks} <span style="font-size:15px; color:var(--ink-muted);">(${sum.pct}%)</span></h2>
      <div class="mono" style="font-size:12px; color:var(--ink-muted); margin-bottom:14px;">total exam time ${fmtClock(sum.totalSeconds)}${skipped ? ` · ${skipped} break${skipped === 1 ? '' : 's'} skipped` : ''}</div>
      ${rows}
      <div style="display:flex; gap:10px; margin-top:18px; justify-content:center;">
        <button class="btn btn-jade" id="seriesDoneBtn" style="padding:10px 24px;">Return to Question Banks</button>
      </div>
    </div>`;
}
