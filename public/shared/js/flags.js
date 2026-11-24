// Shared question issue-flagging: affordance, dialog, POST/GET helpers.
// Portal-agnostic — callers pass a context object; the module owns its own DOM
// and styles so no portal stylesheet needs to know about it.

const REASONS = [
  { id: 'wrong-answer', label: 'Wrong answer / mark scheme' },
  { id: 'broken-figure', label: 'Broken figure / table' },
  { id: 'typo', label: 'Typo / wording' },
  { id: 'other', label: 'Other' },
];

const STYLE_ID = 'jqm-flag-styles';
const DIALOG_ID = 'jqmFlagDialog';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .jqm-flag-overlay{position:fixed;inset:0;background:rgba(8,10,14,.55);z-index:9000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)}
    .jqm-flag-card{background:var(--surface,#14161c);border:1px solid var(--border,#2a2f3a);border-radius:14px;padding:22px 24px;width:min(430px,92vw);box-shadow:0 18px 60px rgba(0,0,0,.5);font-family:inherit}
    .jqm-flag-card h3{margin:0 0 4px;font-size:16px;font-weight:600}
    .jqm-flag-card .jqm-flag-sub{font-size:12px;opacity:.65;margin-bottom:14px}
    .jqm-flag-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
    .jqm-flag-chip{padding:6px 12px;border-radius:999px;border:1px solid var(--border,#2a2f3a);background:transparent;color:inherit;font-size:12.5px;cursor:pointer;font-family:inherit}
    .jqm-flag-chip.sel{background:var(--accent,#4a7dff);border-color:var(--accent,#4a7dff);color:#fff}
    .jqm-flag-card textarea{width:100%;min-height:84px;box-sizing:border-box;border-radius:10px;border:1px solid var(--border,#2a2f3a);background:transparent;color:inherit;padding:10px;font-family:inherit;font-size:13px;resize:vertical}
    .jqm-flag-row{display:flex;justify-content:flex-end;gap:10px;margin-top:14px;align-items:center}
    .jqm-flag-err{color:#ff7a7a;font-size:12px;margin-right:auto;display:none}
    .jqm-flag-ok{color:#5fd08a;font-size:12.5px;margin-right:auto;display:none}
    .jqm-flag-btn{font-size:12px}
  `;
  document.head.appendChild(s);
}

export async function postFlag(payload) {
  const res = await fetch('/api/flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchFlags() {
  const res = await fetch('/api/flags');
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const list = await res.json();
  return Array.isArray(list) ? list : [];
}

/**
 * Show a subtle "N flagged" count inside `el` (an <a> or any element).
 * Hidden when the count is 0 or the request fails.
 */
export async function mountFlagBadge(el, { text = 'flagged' } = {}) {
  if (!el) return;
  let flags;
  try {
    flags = await fetchFlags();
  } catch {
    el.hidden = true;
    el.style.display = 'none';
    return;
  }
  // style.display as well as hidden — class display rules (e.g. inline-flex) beat the attribute
  if (flags.length === 0) { el.hidden = true; el.style.display = 'none'; return; }
  el.hidden = false;
  el.style.display = '';
  el.textContent = `⚑ ${flags.length} ${text}`;
}

/**
 * Open the flag dialog for a question.
 * ctx: { portal, fileBase, questionId, questionLabel }
 * Returns a Promise resolving to true when a flag was submitted.
 */
export function openFlagDialog(ctx) {
  ensureStyles();
  return new Promise((resolve) => {
    document.getElementById(DIALOG_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'jqm-flag-overlay';
    overlay.id = DIALOG_ID;
    overlay.innerHTML = `
      <div class="jqm-flag-card" role="dialog" aria-modal="true" aria-label="Flag question issue">
        <h3>Flag an issue</h3>
        <div class="jqm-flag-sub">${ctx.questionLabel ? ctx.questionLabel + ' · ' : ''}${ctx.portal}</div>
        <div class="jqm-flag-chips"></div>
        <textarea placeholder="Optional note — what's wrong?" maxlength="2000"></textarea>
        <div class="jqm-flag-row">
          <span class="jqm-flag-err"></span>
          <span class="jqm-flag-ok">✓ Flagged</span>
          <button class="btn-ghost jqm-flag-btn" data-act="cancel">Cancel</button>
          <button class="btn jqm-flag-btn" data-act="submit" disabled>Flag it</button>
        </div>
      </div>`;

    const card = overlay.querySelector('.jqm-flag-card');
    const chips = overlay.querySelector('.jqm-flag-chips');
    const submit = overlay.querySelector('[data-act="submit"]');
    const err = overlay.querySelector('.jqm-flag-err');
    const ok = overlay.querySelector('.jqm-flag-ok');
    const note = overlay.querySelector('textarea');
    const prevFocus = document.activeElement;
    let reason = null;
    let pending = false;
    let okTimer = null;
    let closed = false;

    REASONS.forEach((r) => {
      const b = document.createElement('button');
      b.className = 'jqm-flag-chip';
      b.type = 'button';
      b.textContent = r.label;
      b.onclick = () => {
        if (pending) return;
        reason = r.id;
        chips.querySelectorAll('.jqm-flag-chip').forEach((c) => c.classList.toggle('sel', c === b));
        submit.disabled = false;
      };
      chips.appendChild(b);
    });

    const close = (result) => {
      if (closed) return; // Esc during a pending submit must not re-close into a later dialog
      closed = true;
      if (okTimer) clearTimeout(okTimer); // a later dialog must not inherit this dialog's timer
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { close(false); return; }
      if (e.key !== 'Tab') return;
      // keep focus inside the dialog — Tab must not reach the runner behind the overlay
      const focusables = [...card.querySelectorAll('button:not([disabled]), textarea')];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!card.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('[data-act="cancel"]').onclick = () => close(false);

    submit.onclick = async () => {
      if (pending) return;
      pending = true;
      submit.disabled = true;
      err.style.display = 'none';
      try {
        await postFlag({
          portal: ctx.portal,
          fileBase: ctx.fileBase || '',
          category: ctx.category,
          questionId: ctx.questionId,
          reason,
          note: note.value,
        });
        ok.style.display = 'inline';
        okTimer = setTimeout(() => close(true), 700);
      } catch (e) {
        pending = false;
        err.textContent = 'Flag failed: ' + e.message;
        err.style.display = 'inline';
        submit.disabled = false;
      }
    };

    document.body.appendChild(overlay);
    note.focus();
  });
}

/**
 * Insert the "⚑" flag button into the runner `.q-chrome`, just before
 * `#chromeRight` — used by every portal's shared wireQ hook so the chrome
 * markup in assessment.js stays untouched.
 * `getCtx` is evaluated on each click so live runner state (idx, meta) is used.
 * Returns the button element, or null when the chrome isn't rendered.
 */
// Which bank does a question's source file live in? Deck meta.category describes
// how the run was launched (a synthesized CS topic deck is 'normal' even though
// every question came from 'past-paper'), so for flagged reports we resolve the
// bank from the file itself when we can.
export function resolveFlagBank(fileBase, quizzes) {
  if (!fileBase || !quizzes) return undefined;
  for (const [category, list] of Object.entries(quizzes)) {
    if ((list || []).some((m) => m && m.file === fileBase)) return category;
  }
  return undefined;
}

export function attachChromeFlagButton(getCtx) {
  const chromeRight = document.getElementById('chromeRight');
  const chrome = chromeRight?.parentElement;
  if (!chrome || document.getElementById('flagQBtn')) return null;
  const b = document.createElement('button');
  b.id = 'flagQBtn';
  b.className = 'btn-ghost mono';
  b.type = 'button';
  b.title = 'Flag an issue with this question';
  b.style.cssText = 'font-size:12px;';
  b.textContent = '⚑';
  b.addEventListener('click', () => openFlagDialog(getCtx()));
  chrome.insertBefore(b, chromeRight);
  return b;
}
