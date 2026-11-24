// Post-quiz review mode — walks back through the paper: per question the
// student's answer, the mark scheme/correct answer, and matched mistakes[]
// feedback side by side. Pure rendering, no deps.
import { matchMistakes, feedbackHtml } from './answerFeedback.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function answerText(q, ans) {
  if (!ans) return '';
  if (q.type === 'multiple-choice') {
    const picked = ans.selected != null ? ans.selected : ans.picked;
    if (picked == null) return '';
    return `${'ABCDEF'[picked] || picked + 1}. ${q.options?.[picked] ?? ''}`;
  }
  return ans.text || ans.finalValue != null && String(ans.finalValue) || ans.targetVal || '';
}

// reviewWalkHtml(questions, answers) → html for the post-quiz review list.
// answers: object keyed by question id or array aligned with questions.
export function reviewWalkHtml(questions, answers) {
  const byId = Array.isArray(answers)
    ? Object.fromEntries((questions || []).map((q, i) => [q.id, answers[i]]))
    : (answers || {});
  return (questions || []).map((q, i) => {
    const ans = byId[q.id] || {};
    const picked = ans.selected != null ? ans.selected : ans.picked;
    const raw = q.type === 'multiple-choice' ? picked : answerText(q, ans);
    const fb = feedbackHtml(matchMistakes(q, raw), esc);
    const scheme = (q.markScheme || []).length
      ? `<ul style="margin:6px 0 0 18px; font-size:13px; line-height:1.5;">${q.markScheme.map(m => `<li>${esc(m.text)} <span class="mono" style="color:var(--ink-muted); font-size:11px;">[${m.marks}]</span></li>`).join('')}</ul>`
      : q.type === 'multiple-choice' && q.options
        ? `<div style="font-size:13px; margin-top:6px;">Correct: <strong>${'ABCDEF'[q.correctIndex] || ''}. ${esc(q.options[q.correctIndex] || '')}</strong></div>`
        : q.answer != null
          ? `<div style="font-size:13px; margin-top:6px;">Answer: <strong>${esc(q.answer)}</strong></div>`
          : '';
    const mine = answerText(q, ans);
    return `
      <details class="rw-item" style="border:1px solid var(--border); border-radius:8px; padding:10px 14px; margin-bottom:8px;">
        <summary style="cursor:pointer; font-size:13.5px;">
          <span class="mono" style="color:var(--ink-muted); font-size:11px;">Q${i + 1} · ${esc(q.subtopic || q.topic || '')}</span>
          ${esc((q.prompt || '').replace(/<[^>]*>/g, '').slice(0, 90))}${(q.prompt || '').length > 90 ? '…' : ''}
        </summary>
        <div style="margin-top:10px; display:grid; gap:8px;">
          ${mine ? `<div style="font-size:13px;"><span class="mono" style="font-size:11px; color:var(--ink-muted);">YOUR ANSWER</span><div style="margin-top:2px;">${esc(mine).slice(0, 600)}</div></div>` : '<div class="mono" style="font-size:11.5px; color:var(--ink-muted);">unattempted</div>'}
          ${scheme ? `<div><span class="mono" style="font-size:11px; color:var(--ink-muted);">MARK SCHEME</span>${scheme}</div>` : ''}
          ${fb}
        </div>
      </details>`;
  }).join('');
}
