// Post-quiz review mode — walks back through the paper: per question the
// student's answer, the mark scheme/correct answer, and matched mistakes[]
// feedback side by side. Pure rendering, no deps.
import { matchMistakes, feedbackHtml } from './answerFeedback.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function optText(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  if (typeof opt === 'object') return opt.text || opt.label || '';
  return String(opt);
}

function answerText(q, ans) {
  if (!ans) return '';
  if (q.type === 'multiple-choice') {
    const picked = ans.selected != null ? ans.selected : ans.picked;
    if (picked == null) return '';
    return `${'ABCDEF'[picked] || picked + 1}. ${optText(q.options?.[picked])}`;
  }
  if (ans.code && typeof ans.code === 'string' && ans.code.trim()) {
    // prefilled starter code is not the student's answer — saveCurrent copies
    // the editor even when untouched
    const starter = q.starterCode || q.starter || '';
    if (starter && ans.code.trim() === String(starter).trim()) return '';
    return ans.code;
  }
  // table-type answers (trace-table, truth-table): rows/outputs snapshots
  if (Array.isArray(ans.rows) && ans.rows.length) {
    try {
      // keep original row positions — grading evaluates rows by index, so
      // dropping blank rows would shift answers onto the wrong rows here.
      // a fully blank table (e.g. cleared) is unattempted.
      const anyContent = ans.rows.some(r => Array.isArray(r) ? r.some(c => String(c || '').trim()) : String(r || '').trim());
      if (!anyContent) return '';
      return ans.rows.map(r => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n');
    } catch {}
  }
  if (ans.outputs && typeof ans.outputs === 'object') {
    try {
      const entries = Object.entries(ans.outputs).filter(([, v]) => v != null && v !== '');
      if (!entries.length) return '';
      // truth tables pair each output with its input column name when the
      // question carries column definitions — fall back to sorted keys
      const cols = (q.table && q.table.columns) || q.columns || null;
      return entries.sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
        .map(([k, v]) => {
          const label = cols && cols[k] != null ? (cols[k].label || cols[k].name || k) : k;
          return `${label}: ${v}`;
        }).join('\n');
    } catch {}
  }
  return ans.text || ans.proofText || ans.targetVal || ans.expected
    || (ans.finalValue != null ? String(ans.finalValue) : '') || '';
}

// reviewWalkHtml(questions, answers) → html for the post-quiz review list.
// answers: object keyed by question id or array aligned with questions.
export function reviewWalkHtml(questions, answers) {
  const byId = Array.isArray(answers)
    ? Object.fromEntries((questions || []).map((q, i) => [q.id, answers[i]]))
    : (answers || {});
  // runners key answers by bank-qualified keys ("file::qid") — resolve each
  // question's entry by bare id first, then by any key ending in the id.
  const filePrefix = k => {
    const m = /^(.+?)(?:::|:(?!:)|\||\/)/.exec(k);
    return m ? m[1] : null;
  };
  const resolve = q => {
    if (!q) return {};
    // the exact bank-qualified key first — runners stamp it as file:qid
    if (q._key && byId[q._key]) return byId[q._key];
    if (byId[q.id]) return byId[q.id];
    // suffix fallback: two different banks can carry the same bare question
    // id, so an unmatched suffix key may belong to ANOTHER bank's question.
    // borrowing it would fabricate an answer for a question the student
    // never reached — only accept a suffix match when it is unambiguous:
    // exactly one candidate, and (when the question carries its own bank
    // key) one that shares the same file prefix.
    const suffix = String(q.id);
    const wantPrefix = q._key ? filePrefix(q._key) : null;
    const candidates = Object.keys(byId).filter(k =>
      k === suffix || k.endsWith('::' + suffix) || k.endsWith(':' + suffix) || k.endsWith('|' + suffix) || k.endsWith('/' + suffix));
    const sameBank = wantPrefix ? candidates.filter(k => filePrefix(k) === wantPrefix) : candidates;
    if (sameBank.length === 1) return byId[sameBank[0]];
    if (!wantPrefix && candidates.length === 1) return byId[candidates[0]];
    return {};
  };
  return (questions || []).map((q, i) => {
    const ans = resolve(q);
    const picked = ans.selected != null ? ans.selected : ans.picked;
    const raw = q.type === 'multiple-choice' ? picked : answerText(q, ans);
    const fb = feedbackHtml(matchMistakes(q, raw), esc);
    const scheme = (q.markScheme || []).length
      ? `<ul style="margin:6px 0 0 18px; font-size:13px; line-height:1.5;">${q.markScheme.map(m => `<li>${esc(m.text)} <span class="mono" style="color:var(--ink-muted); font-size:11px;">[${esc(m.marks)}]</span></li>`).join('')}</ul>`
      : q.type === 'multiple-choice' && q.options
        ? `<div style="font-size:13px; margin-top:6px;">Correct: <strong>${'ABCDEF'[q.correctIndex] || ''}. ${esc(optText(q.options[q.correctIndex]))}</strong></div>`
        : q.answer != null
          ? `<div style="font-size:13px; margin-top:6px;">Answer: <strong>${esc(q.answer)}</strong></div>`
          : '';
    const mine = answerText(q, ans);
    return `
      <details class="rw-item" style="border:1px solid var(--border); border-radius:8px; padding:10px 14px; margin-bottom:8px;">
        <summary style="cursor:pointer; font-size:13.5px;">
          <span class="mono" style="color:var(--ink-muted); font-size:11px;">Q${i + 1} · ${esc(q.subtopic || q.topic || '')}</span>
          ${esc((q.prompt || '').replace(/<[^>]*>/g, '').slice(0, 140))}${(q.prompt || '').length > 140 ? '…' : ''}
        </summary>
        <div style="margin-top:10px; display:grid; gap:8px;">
          <div style="font-size:13px; opacity:.9;">${esc(q.prompt || '').replace(/\$([^$]+)\$/g, '$1')}</div>
          ${mine ? `<div style="font-size:13px;"><span class="mono" style="font-size:11px; color:var(--ink-muted);">YOUR ANSWER</span><div style="margin-top:2px; white-space:pre-wrap; font-family:inherit;">${esc(mine)}</div></div>` : '<div class="mono" style="font-size:11.5px; color:var(--ink-muted);">unattempted</div>'}
          ${scheme ? `<div><span class="mono" style="font-size:11px; color:var(--ink-muted);">MARK SCHEME</span>${scheme}</div>` : ''}
          ${fb}
        </div>
      </details>`;
  }).join('');
}
