// Quick-resume chip mounter — shared across portals.
// Watches the DOM: while a run is live it snapshots the anchor; on the portal's
// home view it offers a "Resume · <title>" chip with a × dismiss.
import { saveAnchor, loadAnchor, clearAnchor } from './resume.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mountResume({ portal, isHome, host, snapshot, isDone, resume, doc = document, store = globalThis.localStorage }) {
  const chipSel = '.jqm-resume-chip';
  if (!doc.getElementById('jqm-resume-css')) {
    const st = doc.createElement('style');
    st.id = 'jqm-resume-css';
    st.textContent = `
.jqm-resume-chip{display:flex;align-items:stretch;gap:0;margin:0 0 14px;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:10px;overflow:hidden;background:var(--surface,rgba(255,255,255,.04))}
.jqm-resume-chip .chip-main{flex:1;display:flex;align-items:center;gap:8px;padding:9px 14px;background:transparent;border:0;color:var(--ink,#eee);font:inherit;font-size:13px;cursor:pointer;text-align:left}
.jqm-resume-chip .chip-main:hover{background:var(--hover,rgba(255,255,255,.06))}
.jqm-resume-chip .chip-ic{opacity:.8}
.jqm-resume-chip .chip-meta{margin-left:auto;font-size:11.5px;opacity:.65;font-variant-numeric:tabular-nums}
.jqm-resume-chip .chip-x{padding:0 12px;background:transparent;border:0;border-left:1px solid var(--border,rgba(255,255,255,.12));color:var(--ink,#eee);font-size:14px;cursor:pointer;opacity:.6}
.jqm-resume-chip .chip-x:hover{opacity:1}`;
    doc.head.appendChild(st);
  }

  let lastSig;

  function render() {
    const a = loadAnchor(portal, store);
    const want = !!(a && isHome());
    const have = !!doc.querySelector(chipSel);
    const sig = want ? `${a.quizUuid}|${a.qIndex}|${a.savedAt}` : null;
    if (want === have && sig === lastSig) return; // steady state — no DOM churn
    doc.querySelectorAll(chipSel).forEach((n) => n.remove());
    lastSig = sig;
    if (!want) return;
    const h = host();
    if (!h) return;
    const left = a.total - a.qIndex;
    const chip = doc.createElement('div');
    chip.className = 'jqm-resume-chip';
    chip.innerHTML =
      `<button type="button" class="chip-main" title="Resume at question ${a.qIndex + 1}">` +
      `<span class="chip-ic">↻</span> Resume · <b>${esc(a.title)}</b> ` +
      `<span class="chip-meta">Q${a.qIndex + 1} of ${a.total} · ${left} left</span></button>` +
      `<button type="button" class="chip-x" title="Forget saved position">×</button>`;
    chip.querySelector('.chip-main').addEventListener('click', () => {
      const cur = loadAnchor(portal, store);
      if (cur) resume(cur);
    });
    chip.querySelector('.chip-x').addEventListener('click', (e) => {
      e.stopPropagation();
      clearAnchor(portal, store);
      render();
    });
    h.insertBefore(chip, h.firstChild);
  }

  function tick() {
    if (isDone && isDone()) clearAnchor(portal, store);
    const snap = snapshot && snapshot();
    if (snap) saveAnchor(snap, store);
    render();
  }

  const mo = new MutationObserver(tick);
  mo.observe(doc.body, { childList: true, subtree: true });
  tick();
}
