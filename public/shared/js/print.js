// Shared "Print paper" export — builds a clean exam layout into a hidden
// #printRoot container and calls window.print(). Only print.css shows it.
// Per-portal image root is supplied by the caller.

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function chipify(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function tableHtml(table) {
  if (!table || !Array.isArray(table.rows) || !table.rows.length) return '';
  const head = Array.isArray(table.headers) && table.headers.length
    ? `<thead><tr>${table.headers.map(h => `<th>${chipify(String(h ?? ''))}</th>`).join('')}</tr></thead>` : '';
  const body = `<tbody>${table.rows.map(r => `<tr>${(Array.isArray(r) ? r : [r]).map(c => `<td>${chipify(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table class="print-table">${table.caption ? `<caption>${esc(table.caption)}</caption>` : ''}${head}${body}</table>`;
}

function imgSrc(file, base, imgRoot) {
  const f = String(file);
  if (/^[a-z]+:/i.test(f) || f.startsWith('/')) return f;
  return imgRoot + (base ? String(base).replace(/\/+$/, '') + '/' : '') + f;
}

function qImages(q) {
  if (Array.isArray(q.images) && q.images.length)
    return q.images.map(it => typeof it === 'string' ? { file: it } : it);
  if (q.image) return [{ file: q.image, alt: q.imageAlt, caption: q.imageCaption }];
  return [];
}

function imgHtml(q, imgRoot) {
  return qImages(q).map(it => {
    const src = imgSrc(it.file, q._imgBase, imgRoot);
    const cap = it.caption || (!q.images && q.imageCaption) || '';
    return `<figure class="print-fig"><img src="${esc(src)}" alt="${esc(it.alt || q.imageAlt || ('Diagram for ' + q.id))}"/>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
  }).join('');
}

// Dependency context blocks (physics linked prompts). Renders the stem,
// table and images so the paper is self-contained.
function depHtml(q, imgRoot) {
  if (!q._deps?.length) return '';
  return q._deps.map(d => {
    if (d.missing) return '';
    return `<div class="print-dep">
      <div class="print-dep-label">Reference context${d.id ? ' — ' + esc(d.id) : ''}</div>
      ${d.prompt ? `<p>${chipify(d.prompt)}</p>` : ''}
      ${d.table ? tableHtml(d.table) : ''}
      ${(d.images || []).map(it => `<figure class="print-fig"><img src="${esc(it.src)}" alt="${esc(it.alt || '')}"/>${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</figure>`).join('')}
    </div>`;
  }).join('');
}

function questionBody(q, imgRoot) {
  const parts = [];
  if (q.guidance) parts.push(`<p class="print-guidance">${chipify(q.guidance)}</p>`);
  if (q.codeSnippet) parts.push(`<pre class="print-code">${esc(q.codeSnippet)}</pre>`);
  if (q.stemCode) parts.push(`<pre class="print-code">${esc(q.stemCode)}</pre>`);
  parts.push(tableHtml(q.table));
  parts.push(imgHtml(q, imgRoot));
  if (Array.isArray(q.options) && q.options.length) {
    parts.push(`<ol class="print-options" type="A">${q.options.map(o => `<li>${chipify(o)}</li>`).join('')}</ol>`);
  }
  if (Array.isArray(q.parts) && q.parts.length) {
    parts.push(`<ol class="print-options" type="a">${q.parts.map(p => `<li>${chipify(typeof p === 'string' ? p : (p.prompt || ''))}${typeof p === 'object' && p.marks ? ` <span class="print-marks">[${esc(p.marks)}]</span>` : ''}</li>`).join('')}</ol>`);
  }
  // Working space: lines scale with marks, only for non-MCQ.
  if (q.type !== 'multiple-choice') {
    const lines = Math.max(3, Math.min(10, Math.round(+q.marks || 4)));
    parts.push(`<div class="print-work" style="--lines:${lines}" aria-hidden="true"></div>`);
  }
  return parts.join('');
}

function markSchemeHtml(q) {
  const bits = [];
  if (q.type === 'multiple-choice' && q.correctIndex != null && Array.isArray(q.options)) {
    bits.push(`<p>Correct answer: <strong>${'ABCDEFGH'[q.correctIndex] || q.correctIndex} — ${chipify(q.options[q.correctIndex])}</strong></p>`);
  }
  if (q.answerText || q.answer) bits.push(`<p>${chipify(q.answerText || q.answer)}</p>`);
  if (q.expected) bits.push(`<p>Expected: <code>${esc(q.expected)}</code></p>`);
  if (Array.isArray(q.markScheme) && q.markScheme.length) {
    bits.push(`<ul class="print-ms">${q.markScheme.map(m => `<li><strong>[${m.marks ?? 1}m]</strong> ${chipify(m.text ?? m)}</li>`).join('')}</ul>`);
  }
  if (Array.isArray(q.indicativeContent) && q.indicativeContent.length) {
    bits.push(`<div class="print-dep-label">Indicative content</div><ul class="print-ms">${q.indicativeContent.map(p => `<li>${chipify(p)}</li>`).join('')}</ul>`);
  }
  if (Array.isArray(q.steps) && q.steps.length) {
    bits.push(`<ol class="print-ms">${q.steps.map(st => `<li>${chipify(typeof st === 'string' ? st : (st.text || st.expr || ''))}</li>`).join('')}</ol>`);
  }
  if (Array.isArray(q.levels) && q.levels.length) {
    bits.push(`<ul class="print-ms">${q.levels.map(l => `<li><strong>Level ${esc(l.level)} (${l.range?.[0]}–${l.range?.[1]}m):</strong> ${chipify(l.title || '')}</li>`).join('')}</ul>`);
  }
  return bits.join('');
}

function buildPrintHtml({ title, portal, questions, withMarkScheme, timeLimitMinutes, imgRoot }) {
  const tot = questions.reduce((s, q) => s + (+q.marks || 0), 0);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const qs = questions.map((q, i) => `
    <li class="print-q">
      ${depHtml(q, imgRoot)}
      <div class="print-q-head">
        <span class="print-q-num">${i + 1}</span>
        <div class="print-q-body">
          <p class="print-prompt">${chipify(q.prompt || '')}</p>
          ${questionBody(q, imgRoot)}
        </div>
        <span class="print-marks">[${esc(q.marks ?? 0)}]</span>
      </div>
    </li>`).join('');
  const ms = withMarkScheme ? `
    <section class="print-markscheme">
      <h2>Mark scheme</h2>
      <ol>${questions.map((q, i) => `<li><div class="print-q-head"><span class="print-q-num">${i + 1}</span><div class="print-q-body">${markSchemeHtml(q) || '<p class="print-guidance">See mark scheme in-app.</p>'}</div><span class="print-marks">[${esc(q.marks ?? 0)}]</span></div></li>`).join('')}</ol>
    </section>` : '';
  return `
    <div class="print-paper">
      <header class="print-head">
        <div class="print-title-row">
          <h1>${esc(title)}</h1>
        </div>
        <table class="print-meta">
          <tr>
            <td class="print-name">Name: <span class="print-blank"></span></td>
            <td>Date: ${esc(date)}</td>
            ${timeLimitMinutes ? `<td>Time allowed: ${Math.round(timeLimitMinutes)} min</td>` : ''}
            <td>Total marks: ${tot}</td>
          </tr>
        </table>
        <div class="print-sub">${esc(portal)} · generated by JustQuizMe</div>
      </header>
      <ol class="print-questions">${qs}</ol>
      ${ms}
    </div>`;
}

function renderMath(root) {
  try {
    if (typeof renderMathInElement === 'undefined') return;
    renderMathInElement(root, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwError: false
    });
  } catch { /* math is decorative */ }
}

let dialogEl = null;

export function openPrintDialog({ title, portal, questions, imgRoot, timeLimitMinutes }) {
  if (!questions?.length) return;
  closePrintDialog();
  dialogEl = document.createElement('div');
  dialogEl.className = 'modal-backdrop open';
  dialogEl.id = 'printDialog';
  dialogEl.setAttribute('role', 'dialog');
  dialogEl.setAttribute('aria-modal', 'true');
  dialogEl.setAttribute('aria-label', 'Print paper');
  dialogEl.innerHTML = `
    <div class="modal-card" style="max-width:420px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline;">
        <h3 style="margin-bottom:8px;">Print paper</h3>
        <button class="btn-ghost" id="printDialogClose" aria-label="Close">✕</button>
      </div>
      <p style="font-size:13.5px; color:var(--ink-secondary); margin-bottom:16px;">${esc(title)} · ${questions.length} questions</p>
      <label style="display:flex; align-items:center; gap:10px; font-size:14px; margin-bottom:18px; cursor:pointer;">
        <input type="checkbox" id="printWithMs" style="accent-color:var(--accent);">
        Append mark scheme on a separate page
      </label>
      <button class="btn btn-primary" id="printGo" style="width:100%;">Print paper</button>
    </div>`;
  document.body.appendChild(dialogEl);
  const close = closePrintDialog;
  dialogEl.onclick = (e) => { if (e.target === dialogEl) close(); };
  dialogEl.onkeydown = (e) => { if (e.key === 'Escape') close(); };
  dialogEl.querySelector('#printDialogClose').onclick = close;
  const go = dialogEl.querySelector('#printGo');
  go.onclick = () => {
    printPaper({ title, portal, questions, imgRoot, timeLimitMinutes, withMarkScheme: dialogEl.querySelector('#printWithMs').checked });
    close();
  };
  dialogEl.querySelector('#printDialogClose').focus();
}

export function closePrintDialog() {
  dialogEl?.remove();
  dialogEl = null;
}

export function printPaper({ title, portal, questions, imgRoot, timeLimitMinutes, withMarkScheme }) {
  let root = document.getElementById('printRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'printRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = buildPrintHtml({ title, portal, questions, imgRoot, timeLimitMinutes, withMarkScheme });
  renderMath(root);
  // Give images a tick to load before the dialog opens.
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
}
