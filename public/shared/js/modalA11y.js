// modalA11y — keyboard and screen-reader basics for the .modal-backdrop pattern:
// Escape closes the topmost open modal, and open modals carry dialog semantics.
// Focus is moved into the modal on open and returned to the trigger on close.
export function wireModalA11y(root = document) {
  let lastTrigger = null;
  const annotate = () => {
    root.querySelectorAll('.modal-backdrop').forEach(m => {
      const card = m.querySelector('.modal-card') || m.firstElementChild;
      if (card && !card.getAttribute('role')) {
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
      }
    });
  };
  annotate();
  // annotate late-added modals too
  new MutationObserver(annotate).observe(root.documentElement || root, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal-backdrop.open')].pop();
    if (!open) return;
    open.classList.remove('open');
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  });

  // move focus into a modal when it opens; remember what had focus before
  new MutationObserver(muts => {
    for (const mu of muts) {
      const m = mu.target;
      if (!(m instanceof HTMLElement) || !m.classList.contains('modal-backdrop')) continue;
      if (m.classList.contains('open')) {
        lastTrigger = document.activeElement;
        const focusable = m.querySelector('button, input, select, textarea, [tabindex]');
        if (focusable) focusable.focus();
      }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
}
