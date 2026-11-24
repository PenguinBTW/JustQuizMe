// Exam timer — pure countdown + per-question pace math.
// paceQ is the question number (1-based) a perfectly-paced run would be on.

export function timerSpec({ totalMin, questionCount }) {
  const totalSec = Math.max(0, Math.round((Number(totalMin) || 0) * 60));
  const count = Math.max(0, Math.round(Number(questionCount) || 0));
  return { totalSec, perQSec: count > 0 ? totalSec / count : 0 };
}

// state: { elapsedSec?, remainingSec?, questionIndex? } — questionIndex is 1-based
// (the question the runner is showing). Exactly one of elapsedSec/remainingSec needed.
export function tick(state, spec) {
  const s = state || {};
  const remainingSec = s.remainingSec != null
    ? Math.max(0, Number(s.remainingSec) || 0)
    : Math.max(0, spec.totalSec - (Number(s.elapsedSec) || 0));
  const elapsed = Math.max(0, spec.totalSec - remainingSec);
  const paceQ = spec.perQSec > 0 ? elapsed / spec.perQSec + 1 : 0;
  let pace = 'on';
  if (spec.perQSec > 0 && s.questionIndex != null) {
    const qi = Number(s.questionIndex);
    if (qi < paceQ - 0.5) pace = 'behind';
    else if (qi > paceQ + 0.5) pace = 'ahead';
  }
  return { remainingSec, pace, paceQ };
}

export function mmss(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// Parses portals' chromeCount strings: "Question 3 of 12 · 4 marks" / "Q3 of 12".
export function parseChromeCount(text) {
  const m = /Q(?:uestion)?\s*(\d+)\s+of\s+(\d+)/i.exec(String(text || ''));
  return m ? { index: +m[1], count: +m[2] } : null;
}

// Parses "⏱ 12:34 left" from the exam clock span.
export function parseRemaining(text) {
  const m = /(\d+):(\d{2})\s*left/i.exec(String(text || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
