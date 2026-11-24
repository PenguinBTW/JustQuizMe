// Session-summary bar helpers — pure string/data builders, no DOM, so the
// whole surface can be exercised at node level.

/** mm:ss clock like the runner's fmtClock. */
export function clockStr(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Build the compact post-finish summary model.
 * @param {object} o { score, total, elapsedSeconds, limitMinutes, exam, auto }
 */
export function examSummary(o) {
  const score = Number(o?.score) || 0;
  const total = Number(o?.total) || 0;
  const elapsed = Math.max(0, Math.round(Number(o?.elapsedSeconds) || 0));
  const lim = Number(o?.limitMinutes) || 0;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const parts = [`${score} / ${total} marks`, `${pct}%`];
  if (o?.exam && lim > 0) {
    const left = Math.round(lim * 60 - elapsed);
    parts.push(left >= 0
      ? `${clockStr(elapsed)} used of ${clockStr(lim * 60)}`
      : `${clockStr(-left)} over the ${clockStr(lim * 60)} limit`);
  } else {
    parts.push(`${clockStr(elapsed)} used`);
  }
  if (o?.auto) parts.push('auto-finished');
  const reviewable = Number.isInteger(o?.missedCount) ? o.missedCount : null;
  return {
    text: parts.join(' · '),
    pct,
    overtime: o?.exam && lim > 0 && elapsed > lim * 60,
    reviewable
  };
}

/**
 * Index of the first question that did not score full marks, or -1 when the
 * run was clean. `questions[i].marks` vs `answers[ak(q)].score`.
 */
export function firstReviewIndex(questions, answers, ak) {
  for (let i = 0; i < (questions?.length || 0); i++) {
    const q = questions[i];
    const a = answers?.[ak(q)];
    if ((a?.score || 0) < (q?.marks || 0)) return i;
  }
  return -1;
}

/** Count of questions below full marks (0 for a clean run). */
export function missedCount(questions, answers, ak) {
  let n = 0;
  for (const q of questions || []) {
    if ((answers?.[ak(q)]?.score || 0) < (q?.marks || 0)) n++;
  }
  return n;
}
