// Author studio — structured question authoring with live schema validation,
// preview-as-student rendering and atomic bank saves via the server.
import { validateQuestion, validateBank } from './questionSchema.js';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// only types whose grading data the form can fully capture — complex types
// (code-requirement, lmc, trace-table, truth-table) need structured grading
// inputs the form doesn't have; offering them produced ungradeable questions
const TYPE_FIELDS = {
  'multiple-choice': ['options', 'correctIndex', 'mistakes'],
  'written': ['markScheme', 'mistakes'],
  'calculation': ['answer', 'tolerancePercent', 'mistakes'],
  'self-marked': ['markScheme', 'answerText', 'mistakes'],
  'extended-response': ['markScheme', 'mistakes'],
};

export function blankQuestion(type = 'multiple-choice') {
  const q = { id: 'q' + Date.now().toString(36), type, marks: 1, prompt: '', topic: '', subtopic: '' };
  if (type === 'multiple-choice') { q.options = ['', '']; q.correctIndex = 0; }
  if (type === 'written' || type === 'self-marked' || type === 'extended-response') q.markScheme = [{ marks: 1, text: '' }];
  if (type === 'calculation') { q.tolerancePercent = 2.5; }
  return q;
}

// questionFormHtml(q, errs, portal) — type-specific structured form
export function questionFormHtml(q, errs = [], portal = 'cs') {
  const tf = TYPE_FIELDS[q.type] || [];
  const errBox = errs.length
    ? `<div style="margin:10px 0; padding:8px 12px; border-left:3px solid #e0735f; background:rgba(224,115,95,.08); border-radius:4px; font-size:12.5px;">${errs.map(e => `<div>⚠ ${esc(e)}</div>`).join('')}</div>`
    : `<div class="mono" style="font-size:11.5px; color:var(--accent); margin:10px 0;">✓ valid against schema v1</div>`;
  return `
    <div class="author-form" style="display:grid; gap:10px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <label style="font-size:12px;">type<br><select id="af-type" style="padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;">
          ${Object.keys(TYPE_FIELDS).map(t => `<option ${t === q.type ? 'selected' : ''}>${t}</option>`).join('')}
        </select></label>
        <label style="font-size:12px;">marks<br><input id="af-marks" type="number" value="${q.marks}" min="1" style="width:70px; padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" /></label>
        <label style="font-size:12px; flex:1;">topic<br><input id="af-topic" value="${esc(q.topic)}" style="width:100%; padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" /></label>
        <label style="font-size:12px;">subtopic<br><input id="af-subtopic" value="${esc(q.subtopic || '')}" style="padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" /></label>
      </div>
      <label style="font-size:12px;">prompt (markdown + $latex$)<br><textarea id="af-prompt" rows="3" style="width:100%; padding:8px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px; font-family:inherit;">${esc(q.prompt)}</textarea></label>
      ${q.type === 'multiple-choice' ? `
        <div><span class="mono" style="font-size:11px; color:var(--ink-muted);">OPTIONS — click letter to mark correct</span>
        ${(q.options || []).map((o, i) => `
          <div style="display:flex; gap:8px; align-items:center; margin-top:6px;">
            <button class="btn-ghost mono af-correct" data-i="${i}" style="padding:4px 8px; ${i === q.correctIndex ? 'color:var(--accent); font-weight:700;' : ''}">${'ABCDEF'[i]}</button>
            <input class="af-option" data-i="${i}" value="${esc(typeof o === 'string' ? o : o.text || '')}" style="flex:1; padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" />
          </div>`).join('')}
          <button class="btn-ghost mono" id="af-addopt" style="margin-top:6px; font-size:11.5px;">+ add option</button>
        </div>` : ''}
      ${q.type === 'calculation' ? `
        <label style="font-size:12px;">numeric answer<br><input id="af-answer" type="number" step="any" value="${q.answer != null ? q.answer : ''}" style="padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" /></label>
${portal === 'physics' ? `<label style="font-size:12px;">tolerance %<br><input id="af-tolerance" type="number" step="any" min="0" value="${q.tolerancePercent != null ? q.tolerancePercent : ''}" style="padding:6px; width:80px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" /></label>` : ''}` : ''}
      ${tf.includes('markScheme') ? `
        <div><span class="mono" style="font-size:11px; color:var(--ink-muted);">MARK SCHEME — points must sum to ${q.marks}</span>
        ${(q.markScheme || []).map((m, i) => `
          <div style="display:flex; gap:8px; margin-top:6px;">
            <input class="af-ms-marks" data-i="${i}" type="number" value="${m.marks}" min="1" style="width:56px; padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" />
            <input class="af-ms-text" data-i="${i}" value="${esc(m.text)}" placeholder="marking point…" style="flex:1; padding:6px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" />
          </div>`).join('')}
          <button class="btn-ghost mono" id="af-addms" style="margin-top:6px; font-size:11.5px;">+ add point</button>
        </div>` : ''}
      ${tf.includes('mistakes') ? `
        <div><span class="mono" style="font-size:11px; color:var(--ink-muted);">EXAMINER FEEDBACK — mistakes[] annotations (optional)</span>
        ${(q.mistakes || []).map((m, i) => `
          <div style="display:grid; gap:4px; margin-top:6px; padding:8px; border:1px solid var(--border); border-radius:6px;">
            ${q.type === 'multiple-choice'
              ? `<label style="font-size:11px;">for option <input class="af-mk-opt" data-i="${i}" type="number" value="${m.optionIndex ?? 0}" min="0" style="width:50px; padding:4px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:4px;" /></label>`
              : `<input class="af-mk-pattern" data-i="${i}" value="${esc(m.pattern || '')}" placeholder="pattern in student answer…" style="padding:4px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:4px;" />`}
            <input class="af-mk-misconception" data-i="${i}" value="${esc(m.misconception || '')}" placeholder="misconception — what the student is probably thinking" style="padding:4px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:4px;" />
            <input class="af-mk-correction" data-i="${i}" value="${esc(m.correction || '')}" placeholder="correction — examiner note" style="padding:4px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:4px;" />
          </div>`).join('')}
          <button class="btn-ghost mono" id="af-addmk" style="margin-top:6px; font-size:11.5px;">+ add misconception</button>
        </div>` : ''}
      ${errBox}
    </div>`;
}

// previewHtml(q) — rough student-view rendering of the authored question
export function previewHtml(q) {
  let body = '';
  if (q.type === 'multiple-choice') {
    body = (q.options || []).map((o, i) => `
      <div style="padding:8px 12px; border:1px solid var(--border); border-radius:6px; margin-top:6px; font-size:13.5px;">
        <strong class="mono">${'ABCDEF'[i]}</strong> &nbsp;${esc(typeof o === 'string' ? o : o.text || '')}
      </div>`).join('');
  } else if (q.type === 'calculation') {
    body = `<input disabled placeholder="numeric answer…" style="padding:8px; width:200px; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--ink-muted);" />`;
  } else {
    body = `<textarea disabled rows="4" placeholder="student answer area…" style="width:100%; padding:8px; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--ink-muted);"></textarea>`;
  }
  return `
    <div style="padding:16px; border:1px dashed var(--border); border-radius:8px;">
      <div class="mono" style="font-size:10.5px; color:var(--ink-muted); margin-bottom:6px;">STUDENT PREVIEW · ${esc(q.type)} · ${q.marks} mark${q.marks === 1 ? '' : 's'}</div>
      <div style="font-size:14.5px; line-height:1.55;">${q.prompt
        ? esc(q.prompt).replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre style="background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:8px 10px; font-size:12px; white-space:pre-wrap; margin:6px 0;">${code}</pre>`).replace(/\n/g, '<br>')
        : '<span style="opacity:.4">prompt appears here…</span>'}</div>
      <div style="margin-top:10px;">${body}</div>
    </div>`;
}

// readForm(root, q) — harvest the form back into the question object
export function readForm(root, q) {
  const val = id => (root.querySelector(id) || {}).value;
  q.marks = +val('#af-marks') || q.marks;
  q.topic = val('#af-topic') || '';
  q.subtopic = val('#af-subtopic') || '';
  q.prompt = val('#af-prompt') || '';
  if (q.type === 'multiple-choice') {
    root.querySelectorAll('.af-option').forEach(el => {
      const i = +el.dataset.i;
      const prev = q.options[i];
      // object-form options carry explanations — editing the text must not
      // flatten them away
      if (prev && typeof prev === 'object') q.options[i] = { ...prev, text: el.value };
      else q.options[i] = el.value;
    });
  }
  if (q.type === 'calculation') {
    const raw = val('#af-answer');
    q.answer = raw === '' || raw == null ? undefined : +raw;
    const tol = val('#af-tolerance');
    if (tol !== '' && tol != null) q.tolerancePercent = +tol;
  }
  if (Array.isArray(q.markScheme)) {
    root.querySelectorAll('.af-ms-marks').forEach(el => {
      if (!q.markScheme[+el.dataset.i]) return;
      let v = +el.value || 1;
      if (root.dataset && root.dataset.oneMarkPerPoint === '1') {
        // the form offers no per-point mark input in this portal — preserve
        // whatever the question already carries rather than crushing loaded
        // multi-mark points to 1 (which then read as phantom unsaved edits)
        v = (q.markScheme[+el.dataset.i] && Number.isFinite(+q.markScheme[+el.dataset.i].marks)) ? +q.markScheme[+el.dataset.i].marks : 1;
      }
      q.markScheme[+el.dataset.i].marks = v;
    });
    root.querySelectorAll('.af-ms-text').forEach(el => { if (q.markScheme[+el.dataset.i]) q.markScheme[+el.dataset.i].text = el.value; });
  }
  if (Array.isArray(q.mistakes)) {
    root.querySelectorAll('.af-mk-opt').forEach(el => { if (q.mistakes[+el.dataset.i]) q.mistakes[+el.dataset.i].optionIndex = +el.value; });
    root.querySelectorAll('.af-mk-pattern').forEach(el => { if (q.mistakes[+el.dataset.i]) q.mistakes[+el.dataset.i].pattern = el.value; });
    root.querySelectorAll('.af-mk-misconception').forEach(el => { if (q.mistakes[+el.dataset.i]) q.mistakes[+el.dataset.i].misconception = el.value; });
    root.querySelectorAll('.af-mk-correction').forEach(el => { if (q.mistakes[+el.dataset.i]) q.mistakes[+el.dataset.i].correction = el.value; });
  }
  return q;
}

// mountAuthorStudio(host, { apiBase, portal }) — full interactive author tab
export function mountAuthorStudio(host, { apiBase = '', portal = 'cs' } = {}) {
  const draftKey = `jqm-author-draft-${portal}`;
  let q = blankQuestion();
  let bank = { uuid: 'authored-' + Date.now().toString(36), version: 1, title: 'Authored bank', subject: portal, topics: [], questions: [] };
  let editFile = null;
  // restore the working draft — leaving the Author tab must not discard work
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft && draft.bank && Array.isArray(draft.bank.questions)) {
      bank = draft.bank;
      editFile = draft.editFile || null;
      // the half-finished question in the form is work too — restore it,
      // unless it is already in the bank unchanged (reopening it would make
      // the next Add replace the entry instead of appending new work)
      if (draft.q && typeof draft.q === 'object' && draft.q.type) {
        const banked = bank.questions.find(x => x.id === draft.q.id);
        if (!banked || JSON.stringify(banked) !== JSON.stringify(draft.q)) q = draft.q;
      }
    }
  } catch {}
  let persistTimer = null;
  const persistDraft = () => {
    try {
      // capture the live form state before stashing — leaving the tab must not
      // erase a half-written question
      const form = host.querySelector('#af-formhost');
      if (form) try { readForm(form, q); } catch {}
      localStorage.setItem(draftKey, JSON.stringify({ bank, editFile, q }));
    } catch {}
  };

  // form edits persist continuously (lightly debounced) — a half-written first
  // question must survive a tab switch even before anything reaches the bank
  host.addEventListener('input', () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistDraft, 400);
  });

  const render = () => {
    const errs = validateQuestion(q);
    host.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start;">
        <div>
          <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center; flex-wrap:wrap;">
            <input id="af-banktitle" value="${esc(bank.title)}" placeholder="bank title…" style="padding:6px 10px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px; width:200px;" />
            <input id="af-loadfile" placeholder="edit existing file…" style="padding:6px 10px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px; width:160px;" />
            <button class="btn-ghost mono" id="af-load" style="font-size:11.5px;">load</button>
            <span class="mono" style="font-size:11px; color:var(--ink-muted);">${bank.questions.length} question${bank.questions.length === 1 ? '' : 's'} in bank</span>
          </div>
          <div id="af-formhost">${questionFormHtml(q, errs, portal)}</div>
          <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="btn btn-primary" id="af-addq">add to bank</button>
            <button class="btn-ghost" id="af-newq">new question</button>
            <button class="btn btn-primary" id="af-save" ${bank.questions.length ? '' : 'disabled'}>save bank</button>
          </div>
          <div id="af-status" class="mono" style="font-size:12px; margin-top:8px;"></div>
          <div style="margin-top:14px;">${bank.questions.map((bq, i) => `
            <div class="mono" style="font-size:12px; padding:4px 0; border-bottom:1px solid var(--border); cursor:pointer;" data-editq="${i}">
              ${i + 1}. ${esc((bq.prompt || '').slice(0, 60))} <span style="color:var(--ink-muted);">[${esc(bq.type)} · ${bq.marks}m]</span>
            </div>`).join('')}</div>
        </div>
        <div id="af-preview">${previewHtml(q)}</div>
      </div>`;
    wire();
  };

  const wire = () => {
    const formhost = host.querySelector('#af-formhost');
    const refresh = () => {
      readForm(formhost, q);
      const errs = validateQuestion(q);
      formhost.innerHTML = questionFormHtml(q, errs, portal);
      host.querySelector('#af-preview').innerHTML = previewHtml(q);
      wireForm();
    };
    const wireForm = () => {
      formhost.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('input', () => { readForm(formhost, q); host.querySelector('#af-preview').innerHTML = previewHtml(q); });
      });
      formhost.querySelector('#af-type')?.addEventListener('change', e => {
        readForm(formhost, q);
        q = { ...blankQuestion(e.target.value), id: q.id, topic: q.topic, subtopic: q.subtopic, prompt: q.prompt, marks: q.marks };
        refresh();
      });
      formhost.querySelectorAll('.af-correct').forEach(b => b.addEventListener('click', ev => {
        ev.preventDefault();
        readForm(formhost, q);
        q.correctIndex = +b.dataset.i;
        refresh();
      }));
      formhost.querySelector('#af-addopt')?.addEventListener('click', ev => {
        ev.preventDefault();
        readForm(formhost, q);
        q.options.push('');
        refresh();
      });
      formhost.querySelector('#af-addms')?.addEventListener('click', ev => {
        ev.preventDefault();
        readForm(formhost, q);
        q.markScheme = q.markScheme || [];
        q.markScheme.push({ marks: 1, text: '' });
        refresh();
      });
      // maths/physics graders award exactly one mark per ticked point — clamp
      // multi-mark points there so authors can't write ungradeable schemes
      if (portal !== 'cs') {
        formhost.dataset.oneMarkPerPoint = '1';
        formhost.querySelectorAll('.af-ms-marks').forEach(el => {
          el.max = 1;
          el.title = 'this portal grades one mark per marking point';
        });
      }
      formhost.querySelector('#af-addmk')?.addEventListener('click', ev => {
        ev.preventDefault();
        readForm(formhost, q);
        q.mistakes = q.mistakes || [];
        q.mistakes.push(q.type === 'multiple-choice' ? { optionIndex: 0, misconception: '', correction: '' } : { pattern: '', misconception: '', correction: '' });
        refresh();
      });
    };
    wireForm();

    host.querySelector('#af-banktitle')?.addEventListener('input', e => { bank.title = e.target.value; });
    host.querySelector('#af-addq')?.addEventListener('click', () => {
      readForm(host.querySelector('#af-formhost'), q);
      const errs = validateQuestion(q);
      const status = host.querySelector('#af-status');
      if (errs.length) { status.textContent = '✗ fix validation errors first'; status.style.color = '#e0735f'; return; }
      const idx = bank.questions.findIndex(x => x.id === q.id);
      // deep copy — a shallow copy shares the options/markScheme arrays, so
      // later form edits would silently mutate the banked question
      const snap = JSON.parse(JSON.stringify(q));
      if (idx >= 0) bank.questions[idx] = snap; else bank.questions.push(snap);
      bank.topics = [...new Set(bank.questions.map(x => x.topic).filter(Boolean))];
      persistDraft();
      q = blankQuestion(q.type);
      render();
    });
    host.querySelector('#af-newq')?.addEventListener('click', () => { q = blankQuestion(q.type); render(); });
    host.querySelectorAll('[data-editq]').forEach(el => el.addEventListener('click', () => {
      q = JSON.parse(JSON.stringify(bank.questions[+el.dataset.editq]));
      render();
    }));
    host.querySelector('#af-load')?.addEventListener('click', async () => {
      const f = (host.querySelector('#af-loadfile') || {}).value;
      const status = host.querySelector('#af-status');
      if (!f) return;
      try {
        const r = await fetch(`${apiBase}/api/${portal}/author/bank?file=${encodeURIComponent(f)}`);
        if (!r.ok) { status.textContent = '✗ bank not found'; status.style.color = '#e0735f'; return; }
        bank = await r.json();
        editFile = f.replace(/\.json$/i, '');
        status.textContent = `loaded ${bank.questions.length} questions from ${editFile}`;
        status.style.color = 'var(--accent)';
        render();
      } catch { status.textContent = '✗ load failed'; }
    });
    host.querySelector('#af-save')?.addEventListener('click', async () => {
      const status = host.querySelector('#af-status');
      // if the form currently holds an edit of a banked question, fold it in —
      // saving must never silently drop the edits the author just made
      try {
        readForm(host.querySelector('#af-formhost'), q);
        const qErrs = validateQuestion(q);
        const banked = bank.questions.findIndex(x => x.id === q.id);
        if (banked >= 0) {
          const cur = JSON.stringify(bank.questions[banked]);
          const dirty = JSON.stringify(q) !== cur;
          if (dirty && qErrs.length) {
            // the author edited a banked question but it does not validate —
            // writing the bank now would silently discard those edits
            status.textContent = '✗ question "' + q.id + '" has unsaved edits that do not validate: ' + qErrs[0];
            status.style.color = '#e0735f';
            return;
          }
          if (dirty) bank.questions[banked] = JSON.parse(JSON.stringify(q));
        }
        bank.topics = [...new Set(bank.questions.map(x => x.topic).filter(Boolean))];
      } catch {}
      const errs = validateBank(bank);
      if (errs.length) { status.textContent = '✗ ' + errs[0]; status.style.color = '#e0735f'; return; }
      try {
        const r = await fetch(`${apiBase}/api/${portal}/author/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bank, file: editFile || bank.title }),
        });
        const out = await r.json();
        if (!r.ok) { status.textContent = '✗ ' + (out.details ? out.details[0] : out.error); status.style.color = '#e0735f'; return; }
        status.textContent = `✓ saved to questions/normal/${out.file}`;
        status.style.color = 'var(--accent)';
        try { localStorage.removeItem(draftKey); } catch {}
        persistDraft(); // keep the saved state as the working draft
        window.dispatchEvent(new CustomEvent('jqm-bank-saved', { detail: { portal, file: out.file } }));
      } catch { status.textContent = '✗ save failed — server unreachable?'; status.style.color = '#e0735f'; }
    });
  };

  render();
}
