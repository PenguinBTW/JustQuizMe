// Bank health page — fetches /api/bank-health and renders one card per portal.
const root = document.getElementById('bankHealthRoot');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function statCell(label, value) {
  return `<div class="card-stat-item">
    <span class="card-stat-val mono">${esc(value)}</span>
    <span class="card-stat-lbl">${esc(label)}</span>
  </div>`;
}

function missingFieldsBlock(portal) {
  if (portal.totalQuizzes === 0) {
    return '<p class="mono" style="font-size:12px; color:var(--ink-muted,#6b7280);">no quiz manifests found in normal/ or past-paper/</p>';
  }
  const entries = Object.entries(portal.missingFields).filter(([, n]) => n > 0);
  if (!entries.length) return '<p class="mono" style="font-size:12px; color:var(--cs);">✓ no missing fields</p>';
  return `<ul style="margin:6px 0 0; padding-left:18px; font-size:13px; color:var(--ink-secondary,#8892a4);">
    ${entries
      .map(([field, n]) => {
        const samples = (portal.missingFieldSamples[field] || []).slice(0, 8);
        const extra = n - samples.length;
        return `<li><strong>${esc(field)}</strong>: ${n} question${n === 1 ? '' : 's'}
          <div class="mono" style="font-size:11px; color:var(--ink-muted,#6b7280);">${samples.map(esc).join(', ')}${extra > 0 ? `, +${extra} more` : ''}</div>
        </li>`;
      })
      .join('')}
  </ul>`;
}

function marksDistBlock(portal) {
  const entries = Object.entries(portal.marksDistribution).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!entries.length) return '';
  const max = Math.max(...entries.map(([, n]) => n));
  return `<div style="margin-top:10px;">
    <span class="mono" style="font-size:11px; color:var(--ink-muted,#6b7280); text-transform:uppercase; letter-spacing:.1em;">Marks distribution</span>
    ${entries
      .map(([marks, n]) => {
        const pct = Math.round((n / max) * 76); // cap below 100% so the count never clips
        return `<div style="display:flex; align-items:center; gap:8px; font-size:12px;">
          <span class="mono" style="width:42px; text-align:right;">${esc(marks)}m</span>
          <span style="flex:0 0 ${pct}%; min-width:2px; height:10px; background:var(--accent,#4a7dff); border-radius:2px;"></span>
          <span class="mono">${n}</span>
        </div>`;
      })
      .join('')}
  </div>`;
}

function duplicatesBlock(portal) {
  if (!portal.duplicateIds.length) return '';
  return `<div style="margin-top:10px;">
    <span class="mono" style="font-size:11px; color:#e7622b; text-transform:uppercase; letter-spacing:.1em;">Duplicate question ids</span>
    <ul style="margin:6px 0 0; padding-left:18px; font-size:12px; color:var(--ink-secondary,#8892a4);">
      ${portal.duplicateIds
        .map(
          (d) =>
            `<li><strong>${esc(d.id)}</strong> ×${d.count} in ${esc(d.file)}</li>`
        )
        .join('')}
    </ul>
  </div>`;
}

function skippedBlock(portal) {
  if (!portal.skippedFiles.length) return '';
  return `<div style="margin-top:10px; font-size:12px; color:var(--ink-secondary,#8892a4);">
    <span class="mono" style="font-size:11px; color:var(--ink-muted,#6b7280); text-transform:uppercase; letter-spacing:.1em;">Skipped files</span>
    <ul style="margin:6px 0 0; padding-left:18px;">
      ${portal.skippedFiles.map((f) => `<li>${esc(f.file)} (${esc(f.reason)})</li>`).join('')}
    </ul>
  </div>`;
}

function renderPortal(key, portal) {
  if (portal.missingDir) {
    return `<div class="fleet-card" style="padding:18px;">
      <div class="card-subject-name">${esc(portal.name || key)}</div>
      <p class="mono" style="font-size:12px; color:var(--ink-muted,#6b7280);">question bank not present on this machine</p>
    </div>`;
  }
  return `<div class="fleet-card" style="padding:18px;">
    <div class="card-subject-name">${esc(portal.name || key)}</div>
    <div class="card-subject-spec mono" style="margin-bottom:10px;">${esc(portal.spec || '')}</div>
    <div class="card-stats-row">
      ${statCell('Quizzes', portal.totalQuizzes)}
      ${statCell('Questions', portal.totalQuestions)}
      ${statCell('Marks', portal.totalMarks)}
    </div>
    ${missingFieldsBlock(portal)}
    ${marksDistBlock(portal)}
    ${duplicatesBlock(portal)}
    ${skippedBlock(portal)}
  </div>`;
}

async function main() {
  let report;
  try {
    const res = await fetch('/api/bank-health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    report = await res.json();
  } catch (err) {
    root.innerHTML = `<p class="mono" style="color:#e7622b;">Failed to load bank health: ${esc(err.message)}</p>`;
    return;
  }

  const cards = Object.entries(report.portals)
    .map(([key, portal]) => renderPortal(key, portal))
    .join('');
  root.innerHTML = `<div class="fleet-grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:16px;">${cards}</div>
    <p class="mono" style="font-size:11px; color:var(--ink-muted,#6b7280); margin-top:16px;">generated ${esc(report.generatedAt)}</p>`;
}

main();
