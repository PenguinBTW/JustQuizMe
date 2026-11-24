// Examiner-style structured feedback — matches a student's answer against a
// question's mistakes[] annotations. Backward-compatible: banks without
// mistakes[] simply yield no feedback. Schema v1, documented in QUESTION_SCHEMA.md.
//
// mistakes[] entry shapes:
//   MCQ:    { optionIndex: <int>, misconception: string, correction: string }
//   written/calculation/extended-response:
//           { pattern: <substring, case-insensitive>, misconception, correction }
//   universal fields: misconception (what the student is probably thinking),
//                     correction (how to fix it)

// matchMistakes(question, answerText|pickedIndex) → [{misconception, correction}] (empty if none)
export function matchMistakes(q, answer) {
  if (!q || !Array.isArray(q.mistakes) || !q.mistakes.length) return [];
  try {
    if (q.type === 'multiple-choice' && typeof answer === 'number') {
      return q.mistakes.filter(m => m && m.optionIndex === answer && m.misconception)
        .map(({ misconception, correction }) => ({ misconception, correction }));
    }
    const text = typeof answer === 'string' ? answer.trim().toLowerCase() : '';
    if (!text) return [];
    return q.mistakes
      .filter(m => m && typeof m.pattern === 'string' && m.pattern
        && text.includes(m.pattern.toLowerCase()) && m.misconception)
      .map(({ misconception, correction }) => ({ misconception, correction }));
  } catch { return []; }
}

// feedbackHtml(entries) — quiet examiner-note rendering, consistent with mark-scheme styling
export function feedbackHtml(entries, esc) {
  if (!entries || !entries.length) return '';
  const e = esc || (s => String(s));
  return entries.map(m => `
    <div class="fb-note" style="margin-top:8px; padding:8px 10px; border-left:3px solid #e0a75f; background:rgba(224,167,95,.07); border-radius:4px;">
      <div class="mono" style="font-size:11px; color:#e0a75f;">⚠ likely misconception</div>
      <div style="font-size:13px; margin-top:2px;">${e(m.misconception || '')}</div>
      ${m.correction ? `<div style="font-size:12.5px; margin-top:4px; opacity:.85;"><strong>Examiner note:</strong> ${e(m.correction)}</div>` : ''}
    </div>`).join('');
}
