// Shared "Print paper" export — builds a clean exam layout into a hidden
// #printRoot container and calls window.print(). Only print.css shows it.
// Per-portal image root is supplied by the caller.

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function chipify(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

// MCQ options may be bare strings or {text, ...} objects.
function optText(o) {
  return typeof o === 'string' ? o : (o?.text ?? o?.label ?? '');
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
      ${d.showAnswer && d.answer ? `<div><strong>${esc(d.answer.label || 'Answer')}:</strong> ${d.answer.text ? chipify(d.answer.text) : ''}
        ${(d.answer.points || []).map(p => `<div>• ${esc(p)}</div>`).join('')}
        ${d.answer.image ? `<figure class="print-fig"><img src="${esc(d.answer.image)}" alt="${esc(d.answer.alt || '')}"/></figure>` : ''}</div>` : ''}
    </div>`;
  }).join('');
}

function questionBody(q, imgRoot) {
  const parts = [];
  if (q.guidance) parts.push(`<p class="print-guidance">${chipify(q.guidance)}</p>`);
  if (q.codeSnippet) parts.push(`<pre class="print-code">${esc(q.codeSnippet)}</pre>`);
  if (q.stemCode) parts.push(`<pre class="print-code">${esc(q.stemCode)}</pre>`);
  if (q.formula) parts.push(`<pre class="print-code">${esc(q.formula)}</pre>`);
  parts.push(tableHtml(q.table));
  parts.push(imgHtml(q, imgRoot));
  // CS trace table: columns plus any given starting rows.
  if (Array.isArray(q.columns) && q.columns.length) {
    const rows = Array.isArray(q.initialRows) && q.initialRows.length ? q.initialRows : Array.from({ length: 5 }, () => []);
    parts.push(tableHtml({ headers: ['#', ...q.columns.map(String)], rows: rows.map((r, i) => [i + 1, ...(Array.isArray(r) ? r : [r])]) }));
  }
  // CS truth table: inputs with the output column(s) left blank.
  if ((Array.isArray(q.inputs) || Array.isArray(q.outputs)) && Array.isArray(q.rows)) {
    const ins = q.inputs || [], outs = q.outputs || [];
    parts.push(tableHtml({ headers: [...ins, ...outs], rows: q.rows.map(r => [...(r?.inputs || []), ...outs.map(() => '')]) }));
  }
  // CS code-requirement: supplied sandbox files and starter code.
  if (q.mockFiles && typeof q.mockFiles === 'object') {
    for (const [fn, c] of Object.entries(q.mockFiles)) {
      parts.push(`<div class="print-dep-label">File: ${esc(fn)}</div><pre class="print-code">${esc(String(c ?? ''))}</pre>`);
    }
  }
  if (q.starterCode) {
    const starters = typeof q.starterCode === 'string' ? [['', q.starterCode]] : Object.entries(q.starterCode);
    for (const [lang, code] of starters) {
      if (code) parts.push(`<div class="print-dep-label">Starter code${lang ? ' — ' + esc(lang) : ''}</div><pre class="print-code">${esc(String(code))}</pre>`);
    }
  }
  if (Array.isArray(q.options) && q.options.length) {
    parts.push(`<ol class="print-options" type="A">${q.options.map(o => `<li>${chipify(optText(o))}</li>`).join('')}</ol>`);
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

function markSchemeHtml(q, imgRoot) {
  const bits = [];
  if (q.type === 'multiple-choice' && q.correctIndex != null && Array.isArray(q.options)) {
    bits.push(`<p>Correct answer: <strong>${'ABCDEFGH'[q.correctIndex] || q.correctIndex} — ${chipify(optText(q.options[q.correctIndex]))}</strong></p>`);
  }
  if (q.answerText || q.answer) bits.push(`<p>${chipify(q.answerText || q.answer)}</p>`);
  if (q.answerImage) bits.push(`<figure class="print-fig"><img src="${esc(imgSrc(q.answerImage, q._imgBase, imgRoot))}" alt="${esc(q.answerAlt || 'Answer diagram')}"/></figure>`);
  const expected = q.expected || (q.finalTarget && q.finalTarget.expected);
  if (expected) bits.push(`<p>Expected: <code>${esc(expected)}</code></p>`);
  if (Array.isArray(q.markScheme) && q.markScheme.length) {
    bits.push(`<ul class="print-ms">${q.markScheme.map(m => `<li><strong>[${esc(m.marks ?? 1)}m]</strong> ${chipify(m.text ?? m)}</li>`).join('')}</ul>`);
  }
  if (Array.isArray(q.indicativeContent) && q.indicativeContent.length) {
    bits.push(`<div class="print-dep-label">Indicative content</div><ul class="print-ms">${q.indicativeContent.map(p => `<li>${chipify(p)}</li>`).join('')}</ul>`);
  }
  // Physics recovery steps carry title/equation/answer/unit.
  if (Array.isArray(q.steps) && q.steps.length) {
    bits.push(`<ol class="print-ms">${q.steps.map(st => `<li>${typeof st === 'string' ? chipify(st) : `${chipify(st.title || st.text || '')}${st.equation ? ` — use <code>${esc(st.equation)}</code>` : ''}${st.answer != null ? ` = <strong>${esc(st.answer)}${st.unit ? ' ' + esc(st.unit) : ''}</strong>` : ''}`}</li>`).join('')}</ol>`);
  }
  // Maths derivation milestones: rubric title plus each field's expected expression.
  if (Array.isArray(q.milestones) && q.milestones.length) {
    bits.push(`<ul class="print-ms">${q.milestones.map(m => `<li><strong>${chipify(m.title || '')} [${esc(m.rubricMark || (m.marks != null ? m.marks + 'm' : ''))}]</strong>${(m.fields || []).map(f => `<div>• ${esc(f.label || f.key)}: <code>${esc(f.expected ?? '')}</code></div>`).join('')}</li>`).join('')}</ul>`);
  }
  if (Array.isArray(q.levels) && q.levels.length) {
    bits.push(`<ul class="print-ms">${q.levels.map(l => `<li><strong>Level ${esc(l.level)} (${esc(l.range?.[0])}–${esc(l.range?.[1])}m):</strong> ${chipify(l.title || '')}</li>`).join('')}</ul>`);
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
      <ol>${questions.map((q, i) => `<li><div class="print-q-head"><span class="print-q-num">${i + 1}</span><div class="print-q-body">${markSchemeHtml(q, imgRoot) || '<p class="print-guidance">See mark scheme in-app.</p>'}</div><span class="print-marks">[${esc(q.marks ?? 0)}]</span></div></li>`).join('')}</ol>
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
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
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
  // Wait for figure images to decode (capped) so the preview can't open blank.
  const imgs = [...root.querySelectorAll('img')];
  const wait = Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : im.decode().catch(() => {}))));
  Promise.race([wait, new Promise((r) => setTimeout(r, 2000))]).then(() => {
    requestAnimationFrame(() => setTimeout(() => window.print(), 50));
  });
  // After printing (or cancelling), drop the paper so a later plain Ctrl+P
  // prints the page itself again instead of this export.
  window.addEventListener('afterprint', () => root.remove(), { once: true });
}
