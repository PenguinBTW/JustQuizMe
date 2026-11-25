// Printable paper export — print-ready rendering of a synthesized/generated
// paper plus a separate mark-scheme printout. Delivery is browser print-to-PDF:
// zero dependencies beyond the KaTeX CDN already used by the portals.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function optText(opt) {
  if (opt == null) return '';
  if (typeof opt === 'string') return opt;
  if (typeof opt === 'object') return opt.text || opt.label || '';
  return String(opt);
}

// working space proportional to marks: ~2 ruled lines per mark, sane caps
export function workingLines(q) {
  if (q.type === 'multiple-choice' || q.type === 'truth-table') return 0;
  const per = q.type === 'extended-response' ? 3 : 2;
  return Math.min(20, Math.max(3, (+q.marks || 1) * per));
}

export function questionBlockHtml(q, n, { scheme = false } = {}) {
  const marks = +q.marks || 0;
  let body = '';
  if (q.type === 'multiple-choice' && Array.isArray(q.options)) {
    body = `<ol class="pq-opts" type="A">${q.options.map(o => `<li>${optText(o)}</li>`).join('')}</ol>`;
  }
  if (scheme) {
    const ms = Array.isArray(q.markScheme) && q.markScheme.length
      ? `<ul class="pq-scheme">${q.markScheme.map(m => `<li>${esc(typeof m === 'object' ? m.text : m)} <span class="pq-mmark">[${typeof m === 'object' ? m.marks : 1}]</span></li>`).join('')}</ul>`
      : q.type === 'multiple-choice'
        ? `<div class="pq-ansline">Correct answer: <strong>${'ABCDEF'[q.correctIndex] || '?'}</strong></div>`
        : q.answer != null
          ? `<div class="pq-ansline">Answer: <strong>${esc(q.answer)}</strong>${q.tolerance != null ? ` (±${esc(q.tolerance)})` : ''}</div>`
          : '';
    const mistakes = Array.isArray(q.mistakes) && q.mistakes.length
      ? `<div class="pq-mistakes"><div class="pq-mtitle">Common errors</div><ul>${q.mistakes.map(m => `<li><em>${esc(m.misconception || m.error || '')}</em>${m.correction ? ` — ${esc(m.correction)}` : ''}</li>`).join('')}</ul></div>`
      : '';
    body = ms + mistakes;
  } else {
    const lines = workingLines(q);
    if (lines) {
      body += `<div class="pq-space">${'<div class="pq-line"></div>'.repeat(lines)}</div>`;
    }
  }
  return `<div class="pq">
    <div class="pq-head"><span class="pq-num">${n}</span><span class="pq-marks">${marks} mark${marks === 1 ? '' : 's'}</span></div>
    <div class="pq-prompt">${q.prompt || ''}</div>
    ${body}
  </div>`;
}

const CSS = `
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; font-size: 12pt; line-height: 1.45; margin: 0; }
  .ph { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 6px; }
  .ph h1 { font-size: 15pt; margin: 0 0 2px; }
  .ph .meta { font-size: 10pt; color: #333; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px 16px; }
  .name-line { display: flex; gap: 24px; font-size: 10.5pt; margin: 10px 0 16px; }
  .name-line span { border-bottom: 1px solid #666; min-width: 150px; display: inline-block; padding: 0 4px; }
  .pq { page-break-inside: avoid; break-inside: avoid; margin: 0 0 18px; }
  .pq-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #999; margin-bottom: 5px; }
  .pq-num { font-weight: 700; font-size: 12.5pt; }
  .pq-num::before { content: 'Question '; }
  .pq-marks { font-size: 9.5pt; color: #444; font-style: italic; }
  .pq-prompt { margin-bottom: 6px; }
  .pq-opts { margin: 4px 0 2px 24px; }
  .pq-opts li { margin-bottom: 3px; }
  .pq-space { margin-top: 8px; }
  .pq-line { border-bottom: 1px solid #bbb; height: 9mm; }
  .pq-scheme { margin: 4px 0 4px 20px; font-size: 11pt; }
  .pq-scheme li { margin-bottom: 3px; }
  .pq-mmark { color: #555; font-size: 9pt; }
  .pq-ansline { font-size: 11pt; margin: 4px 0; }
  .pq-mistakes { margin-top: 6px; border-left: 3px solid #999; padding-left: 8px; font-size: 10pt; }
  .pq-mtitle { font-weight: 700; font-size: 9.5pt; text-transform: uppercase; letter-spacing: .04em; color: #444; }
  .teacher-banner { background: #111; color: #fff; padding: 4px 10px; font-size: 9.5pt; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 10px; }
  .instructions { font-size: 10pt; color: #333; font-style: italic; margin-bottom: 12px; }
`;

function docShell({ title, portal, timeMinutes, totalMarks, teacher, bodyHtml }) {
  const timeLine = timeMinutes ? `Time allowed: ${timeMinutes} minutes` : 'No time limit';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>${CSS}</style></head><body>
${teacher ? '<div class="teacher-banner">Teacher copy — mark scheme · not for student distribution</div>' : ''}
<div class="ph"><h1>${esc(title)}</h1>
<div class="meta"><span>${esc(portal || '')}</span><span>${timeLine}</span><span>Total: ${totalMarks} marks</span></div></div>
${teacher ? '' : '<div class="name-line"><label>Name: <span></span></label><label>Date: <span></span></label></div><div class="instructions">Answer all questions in the spaces provided. Marks for each question are shown in italics.</div>'}
${bodyHtml}
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>
  window.addEventListener('load', () => {
    try { renderMathInElement(document.body, { delimiters: [{ left: '$', right: '$', display: false }] }); } catch (e) {}
    setTimeout(() => { try { window.print(); } catch (e) {} }, 350);
  });
</script>
</body></html>`;
}

export function paperPrintDoc({ title, portal, timeMinutes, questions }) {
  const total = (questions || []).reduce((s, q) => s + (+q.marks || 0), 0);
  const body = (questions || []).map((q, i) => questionBlockHtml(q, i + 1)).join('\n');
  return docShell({ title, portal, timeMinutes, totalMarks: total, teacher: false, bodyHtml: body });
}

export function markSchemePrintDoc({ title, portal, timeMinutes, questions }) {
  const total = (questions || []).reduce((s, q) => s + (+q.marks || 0), 0);
  const body = (questions || []).map((q, i) => questionBlockHtml(q, i + 1, { scheme: true })).join('\n');
  return docShell({ title: `${title} — Mark Scheme`, portal, timeMinutes, totalMarks: total, teacher: true, bodyHtml: body });
}

export function openPrintWindow(docHtml) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(docHtml);
  w.document.close();
  return true;
}
