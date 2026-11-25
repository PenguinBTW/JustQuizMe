// modalA11y — keyboard and screen-reader basics for the .modal-backdrop pattern:
// Escape closes the topmost open modal, focus is trapped inside while open,
// focus moves into the modal on open and returns to the trigger on close.
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
  new MutationObserver(annotate).observe(root.documentElement || root, { childList: true, subtree: true });

  const focusablesIn = m => [...m.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);

  document.addEventListener('keydown', e => {
    const open = [...document.querySelectorAll('.modal-backdrop.open')].pop();
    if (!open) return;
    if (e.key === 'Escape') {
      open.classList.remove('open');
      return;
    }
    // keep Tab cycling inside the dialog — without a trap, Shift+Tab from the
    // first control reaches the page behind the modal
    if (e.key === 'Tab') {
      const items = focusablesIn(open);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !open.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !open.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // track open transitions: focus moves in only when a modal NEWLY opens
  // (not on every class mutation while open), and returns to the trigger
  // whenever it closes — Escape, close button, or programmatic dismissal
  const openState = new WeakMap();
  new MutationObserver(muts => {
    for (const mu of muts) {
      const m = mu.target;
      if (!(m instanceof HTMLElement) || !m.classList.contains('modal-backdrop')) continue;
      const isOpen = m.classList.contains('open');
      const wasOpen = openState.get(m) || false;
      if (isOpen && !wasOpen) {
        lastTrigger = document.activeElement;
        const focusable = m.querySelector('button, input, select, textarea, [tabindex]');
        if (focusable) focusable.focus();
      } else if (!isOpen && wasOpen) {
        if (lastTrigger && lastTrigger.focus && document.contains(lastTrigger)) lastTrigger.focus();
        lastTrigger = null;
      }
      openState.set(m, isOpen);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
}
