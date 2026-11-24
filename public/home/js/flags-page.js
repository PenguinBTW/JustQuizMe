// Flagged-questions listing for the launchpad, with unflag.
import { fetchFlags, deleteFlag } from '/shared/js/flags.js';
import { groupByPortal } from '/shared/js/flagStore.js';

const REASON_LABELS = {
  'wrong-answer': 'Wrong answer / mark scheme',
  'broken-figure': 'Broken figure / table',
  'typo': 'Typo / wording',
  'other': 'Other',
};
const PORTAL_NAMES = { cs: 'Computer Science', maths: 'Mathematics', physics: 'Physics', home: 'Launchpad' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function flagRow(f, idx) {
  const when = f.at ? new Date(f.at).toLocaleString() : '';
  return `
    <div class="card" style="padding:14px 18px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap;">
        <span class="mono" style="font-size:12.5px; font-weight:600;">${esc(REASON_LABELS[f.reason] || f.reason)}</span>
        <span style="display:flex; align-items:center; gap:10px;">
          <span class="mono" style="font-size:11.5px; color:var(--ink-muted, #66707f);">${esc(when)}</span>
          <button class="btn jqm-unflag" data-flag-idx="${idx}" style="font-size:11.5px; padding:4px 10px;">Unflag</button>
        </span>
      </div>
      <div class="mono" style="font-size:12px; color:var(--ink-secondary, #8892a4); margin-top:6px;">
        ${esc(f.fileBase || '(mixed)')}${f.category ? ` · ${esc(f.category)}` : ''} · Q: ${esc(f.questionId)}
      </div>
      ${f.note ? `<p style="font-size:13.5px; margin:8px 0 0;">${esc(f.note)}</p>` : ''}
    </div>`;
}

async function render(root) {
  let flags;
  try {
    flags = await fetchFlags();
  } catch (e) {
    root.innerHTML = `<div class="card" style="padding:32px; text-align:center;">
      <p style="color:var(--ink-secondary, #8892a4);">Couldn't load flagged reports (${esc(e.message)}). Try reloading.</p>
    </div>`;
    return;
  }

  if (!flags.length) {
    root.innerHTML = `<div class="card" style="padding:32px; text-align:center;">
      <p style="color:var(--ink-secondary, #8892a4);">No questions flagged yet. Use the ⚑ Flag button in any question runner.</p>
    </div>`;
    return;
  }

  // data-flag-idx indexes into `flags` (fetch order) — groupByPortal only
  // buckets references, so indexes stay aligned through the render.
  const byPortal = groupByPortal(flags);
  const idxOf = new Map(flags.map((f, i) => [f, i]));

  root.innerHTML = Object.entries(byPortal).map(([portal, list]) => `
    <h2 class="serif" style="font-size:20px; margin:26px 0 12px;">
      ${esc(PORTAL_NAMES[portal] || portal)} <span class="mono" style="font-size:13px; color:var(--ink-muted,#66707f);">(${list.length})</span>
    </h2>
    ${list.slice().reverse().map((f) => flagRow(f, idxOf.get(f))).join('')}
  `).join('');

  root.querySelectorAll('.jqm-unflag').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const flag = flags[Number(btn.dataset.flagIdx)];
      if (!flag) return;
      btn.disabled = true;
      btn.textContent = 'Removing…';
      try {
        await deleteFlag(flag);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = `Failed — ${e.message}`;
        return;
      }
      render(root);
    });
  });
}

render(document.getElementById('flagsRoot'));
