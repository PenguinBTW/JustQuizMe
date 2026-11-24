// JustQuizMe Export CSV — shared mount + download for every portal's Stats view.
// The Stats view re-renders into #stage on each mount, so an observer re-injects
// the button whenever the stats room-nav appears — same self-mount pattern as
// the Stats tab itself (zero edits to contended view files).

import { buildScoresCsv } from './scoresCsv.js';

const BTN_ID = 'statsExportCsvBtn';

function downloadCsv(csv, portal) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `justquizme-scores-${portal}-${stamp}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// mountCsvExport({ portal, stage, getScores, uuidIndex })
// stage: the portal's #stage element; getScores() → runs array; uuidIndex() →
// uuid → topics[] map (same shape each portal's stats.js builds).
export function mountCsvExport({ portal, stage, getScores, uuidIndex }) {
  if (!stage) return;

  const inject = () => {
    if (!stage.querySelector('[data-stats-room="stats"]')) return;
    const nav = stage.querySelector('.room-nav');
    if (!nav || nav.querySelector(`#${BTN_ID}`)) return;
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.className = 'pill accent';
    btn.type = 'button';
    btn.textContent = 'Export CSV';
    btn.title = 'Download all recorded runs as CSV';
    btn.style.cursor = 'pointer';
    btn.style.marginLeft = '12px';
    btn.onclick = () => {
      let idx = {};
      try { idx = uuidIndex() || {}; } catch { idx = {}; }
      const csv = buildScoresCsv(getScores() || [], { portal, uuidIndex: idx });
      downloadCsv(csv, portal);
    };
    nav.appendChild(btn);
  };

  new MutationObserver(inject).observe(stage, { childList: true, subtree: true });
  inject();
}
