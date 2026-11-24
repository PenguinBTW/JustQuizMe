// Shared streak-chip mounter — injects a compact streak badge into each
// portal's nav row (.room-nav or .room-tabs) whenever the stage re-renders.
// Zero edits to navigation/practice files; removed when the streak is 0.

const CHIP_ID = 'streakChip';

function chipHtml(model) {
  const { current, best, lastDay } = model;
  if (!current) return '';
  const title = `best: ${best} day${best === 1 ? '' : 's'}${lastDay ? ` · last studied ${lastDay}` : ''}`;
  return `<span id="${CHIP_ID}" class="streak-chip" title="${title}"
    style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
    border-radius:999px;font-size:12px;font-family:ui-monospace,monospace;
    color:var(--accent,#e07b39);background:color-mix(in srgb,var(--accent,#e07b39) 12%,transparent);
    border:1px solid color-mix(in srgb,var(--accent,#e07b39) 35%,transparent);">
    <span aria-hidden="true">&#9679;</span>${current}-day streak</span>`;
}

export function mountStreakChip({ getModel, stageSel = '#stage' } = {}) {
  if (typeof document === 'undefined' || typeof getModel !== 'function') return;
  const inject = () => {
    const nav = document.querySelector('.room-nav') || document.querySelector('.room-tabs')?.parentElement;
    const old = document.getElementById(CHIP_ID);
    if (!nav) { old?.remove(); return; }
    let model;
    try { model = getModel() || { current: 0, best: 0 }; } catch { model = { current: 0, best: 0 }; }
    const html = chipHtml(model);
    if (!html) { old?.remove(); return; }
    if (old) { old.outerHTML = html; return; }
    nav.insertAdjacentHTML('beforeend', html);
  };
  const stage = document.querySelector(stageSel);
  if (stage) new MutationObserver(inject).observe(stage, { childList: true, subtree: true });
  inject();
}
