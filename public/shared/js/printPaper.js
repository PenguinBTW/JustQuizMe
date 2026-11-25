// Printable paper export — print-ready rendering of a synthesized/generated
// paper plus a separate mark-scheme printout. Delivery is browser print-to-PDF:
// zero dependencies beyond the KaTeX CDN already used by the portals.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// bank content is authorable in-app — printed HTML must not carry script
// execution into the print window. Regex scrubbing cannot keep up with HTML's
// parsing rules (svg/math/nested tags/entity-encoded attrs), so sanitize by
// DOM: parse, walk, and drop everything outside a formatting whitelist.
const PRINT_SAFE_TAGS = new Set([
  'b','i','em','strong','u','s','sub','sup','span','div','p','br','hr',
  'ul','ol','li','table','thead','tbody','tr','td','th','caption',
  'h1','h2','h3','h4','h5','h6','pre','code','blockquote','small','mark'
]);
export function sanitizeHtml(html) {
  const str = String(html == null ? '' : html);
  if (typeof DOMParser === 'undefined') {
    // non-DOM context (tests): fail closed — strip every tag
    return str.replace(/<[^>]*>/g, '');
  }
  const doc = new DOMParser().parseFromString(str, 'text/html');
  const clean = (el) => {
    for (const attr of [...el.attributes]) {
      // class is presentation-only; every other attribute (src, href, style,
      // event handlers, srcset, formaction...) is executable surface
      if (attr.name !== 'class') el.removeAttribute(attr.name);
    }
    for (const child of [...el.childNodes]) {
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (!PRINT_SAFE_TAGS.has(tag)) {
        // unwrap: keep the text content, drop the element — then rescan,
        // because the unwrapped children may themselves be unsafe
        child.replaceWith(...[...child.childNodes]);
        clean(el);
        return;
      }
      clean(child);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
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

export function fmtTolerance(tol) {
  if (tol == null) return '';
  if (typeof tol === 'number' || typeof tol === 'string') return `±${esc(tol)}`;
  if (typeof tol === 'object') {
    if (tol.percent != null) return `±${esc(tol.percent)}%`;
    if (tol.absolute != null) return `±${esc(tol.absolute)}`;
    if (tol.min != null && tol.max != null) return `accepted range ${esc(tol.min)}–${esc(tol.max)}`;
  }
  return '';
}

// supplementary material the question depends on: context stems, diagrams,
// data tables, algorithms, formulae — without it the question is unanswerable
function supplementHtml(q) {
  let out = '';
  const ctx = q.context || q.stem || q.instructions;
  if (ctx) out += `<div class="pq-context">${sanitizeHtml(ctx)}</div>`;
  const algo = q.algorithm || q.pseudocode || q.code || q.codeSnippet;
  if (algo) out += `<pre class="pq-pre">${esc(algo)}</pre>`;
  const tbl = q.table || q.dataTable;
  if (tbl && Array.isArray(tbl.rows)) {
    const head = Array.isArray(tbl.headers) ? `<tr>${tbl.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>` : '';
    out += `<table class="pq-table">${head}${tbl.rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  if (q.formula) out += `<div class="pq-context">$${esc(q.formula)}$</div>`;
  if (q.diagram) out += `<pre class="pq-pre">${esc(q.diagram)}</pre>`;
  const imgs = [];
  if (q.image) imgs.push(q.image);
  if (Array.isArray(q.images)) imgs.push(...q.images);
  for (const im of imgs) {
    const src = typeof im === 'object' ? im.src || im.url : im;
    const cap = typeof im === 'object' ? im.caption || im.alt : '';
    if (src) out += `<div class="pq-fig"><img src="${esc(src)}" style="max-width:100%; max-height:70mm;" alt="${esc(cap)}">${cap ? `<div style="font-size:9pt; color:#444; font-style:italic;">${esc(cap)}</div>` : ''}</div>`;
  }
  return out;
}

// trace/truth tables print with their input cells filled and answer cells blank
function blankTableHtml(q) {
  if (q.type === 'trace-table' && Array.isArray(q.columns)) {
    const rows = Math.max(4, ((Array.isArray(q.expectedRows) ? q.expectedRows.length : q.expectedRows) || 4) + 2);
    // starting state is a given, not an answer — print it filled in
    const init = Array.isArray(q.initialRows) && q.initialRows.length
      ? q.initialRows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
      : '';
    const blankRow = '<tr>' + q.columns.map(() => '<td>&nbsp;</td>').join('') + '</tr>';
    return `<table class="pq-table pq-answertable"><tr>${q.columns.map(c => `<th>${esc(typeof c === 'object' ? c.label || c.name : c)}</th>`).join('')}</tr>${init}${blankRow.repeat(rows)}</table>`;
  }
  // schema-documented truth tables carry inputs/outputs arrays, not columns:
  // input columns are givens (filled), output columns are the answer cells (blank)
  if (q.type === 'truth-table' && Array.isArray(q.inputs) && Array.isArray(q.outputs)) {
    const cols = [...q.inputs, ...q.outputs];
    const rows = Array.isArray(q.rows) ? q.rows : [];
    return `<table class="pq-table pq-answertable"><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${rows.map(r => {
      const ins = Array.isArray(r && r.inputs) ? r.inputs : [];
      return `<tr>${cols.map((c, ci) => `<td>${ci < q.inputs.length ? esc(ins[ci] != null ? ins[ci] : '') : '&nbsp;'}</td>`).join('')}</tr>`;
    }).join('')}</table>`;
  }
  if (q.type === 'truth-table' && Array.isArray(q.columns)) {
    const cols = q.columns;
    const rows = Array.isArray(q.rows) ? q.rows : [];
    if (rows.length) {
      return `<table class="pq-table pq-answertable"><tr>${cols.map(c => `<th>${esc(typeof c === 'object' ? c.label || c.name : c)}</th>`).join('')}</tr>${rows.map(r => `<tr>${cols.map((c, ci) => {
        const key = typeof c === 'object' ? c.key || c.name : c;
        const val = Array.isArray(r) ? r[ci] : (r && r[key]);
        return `<td>${val != null && val !== '' ? esc(val) : '&nbsp;'}</td>`;
      }).join('')}</tr>`).join('')}</table>`;
    }
  }
  return '';
}

export function questionBlockHtml(q, n, { scheme = false, exactCalculations = false } = {}) {
  const marks = +q.marks || 0;
  let body = '';
  if (q.type === 'multiple-choice' && Array.isArray(q.options)) {
    body = `<ol class="pq-opts" type="A">${q.options.map(o => `<li>${sanitizeHtml(optText(o))}</li>`).join('')}</ol>`;
  }
  if (scheme) {
    const ms = Array.isArray(q.markScheme) && q.markScheme.length
      ? `<ul class="pq-scheme">${q.markScheme.map(m => `<li>${esc(typeof m === 'object' ? m.text : m)} <span class="pq-mmark">[${typeof m === 'object' ? m.marks : 1}]</span></li>`).join('')}</ul>`
      : q.type === 'multiple-choice'
        ? `<div class="pq-ansline">Correct answer: <strong>${'ABCDEF'[q.correctIndex] || '?'}</strong></div>`
        : q.answer != null
          ? `<div class="pq-ansline">Answer: <strong>${esc(q.answer)}</strong>${exactCalculations ? '' : q.tolerance != null ? ` (${fmtTolerance(q.tolerance)})` : q.tolerancePercent != null ? ` (±${esc(q.tolerancePercent)}%)` : ''}</div>`
          : '';
    const mistakes = Array.isArray(q.mistakes) && q.mistakes.length
      ? `<div class="pq-mistakes"><div class="pq-mtitle">Common errors</div><ul>${q.mistakes.map(m => `<li><em>${esc(m.misconception || m.error || '')}</em>${m.correction ? ` — ${esc(m.correction)}` : ''}</li>`).join('')}</ul></div>`
      : '';
    const rubric = Array.isArray(q.rubric) && q.rubric.length
      ? `<ul class="pq-scheme">${q.rubric.map(r => `<li>${esc(typeof r === 'object' ? r.text || r.criterion : r)}</li>`).join('')}</ul>`
      : '';
    body = ms + rubric + mistakes;
  } else {
    const tbl = blankTableHtml(q);
    if (tbl) body += tbl;
    const lines = workingLines(q);
    if (lines) {
      body += `<div class="pq-space">${'<div class="pq-line"></div>'.repeat(lines)}</div>`;
    }
  }
  return `<div class="pq">
    <div class="pq-head"><span class="pq-num">${n}</span><span class="pq-marks">${marks} mark${marks === 1 ? '' : 's'}</span></div>
    <div class="pq-prompt">${sanitizeHtml(q.prompt || '')}</div>
    ${supplementHtml(q)}
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
  .pq-context { background: #f4f4f4; border: 1px solid #ddd; padding: 6px 10px; font-size: 10.5pt; margin: 4px 0 8px; white-space: pre-wrap; }
  .pq-pre { font-family: 'Courier New', monospace; font-size: 9.5pt; background: #f8f8f8; border: 1px solid #ddd; padding: 6px 10px; white-space: pre-wrap; margin: 4px 0 8px; }
  .pq-table { border-collapse: collapse; margin: 6px 0 10px; font-size: 10.5pt; }
  .pq-table th, .pq-table td { border: 1px solid #666; padding: 3px 10px; text-align: left; }
  .pq-answertable td { min-width: 40px; height: 7mm; }
  .pq-prompt { white-space: pre-wrap; }
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
    try { renderMathInElement(document.body, { delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
      // note: \\(...\\) deliberately excluded — prose parentheses like (x + 1)
      // would be eaten as math and printed without their brackets
    ] }); } catch (e) {}
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

export function markSchemePrintDoc({ title, portal, timeMinutes, questions, exactCalculations = false }) {
  const total = (questions || []).reduce((s, q) => s + (+q.marks || 0), 0);
  const body = (questions || []).map((q, i) => questionBlockHtml(q, i + 1, { scheme: true, exactCalculations })).join('\n');
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
