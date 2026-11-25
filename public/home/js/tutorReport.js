// Combined cross-portal tutor report — a print-friendly HTML view aggregating
// per-topic rollups and recent activity across all three subjects. Tutors
// print or save-as-PDF; no server round-trip beyond the CSV endpoints.
function parseCsv(text) {
  const rows = [];
  let cur = [''], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur[cur.length - 1] += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') cur.push('');
    else if (c === '\n') { rows.push(cur); cur = ['']; }
    else cur[cur.length - 1] += c;
  }
  if (cur.length > 1 || cur[0]) rows.push(cur);
  return rows;
}

export async function openTutorReport() {
  const win = window.open('', '_blank');
  if (!win) return;
  const portals = ['maths', 'cs', 'physics'];
  const names = { maths: 'Mathematics (OCR H240)', cs: 'Computer Science (OCR H446)', physics: 'Physics (AQA)' };
  const sections = [];
  for (const portal of portals) {
    try {
      const [topicsText, attemptsText] = await Promise.all([
        fetch(`/api/${portal}/export/topics.csv`).then(r => r.ok ? r.text() : ''),
        fetch(`/api/${portal}/export/attempts.csv`).then(r => r.ok ? r.text() : ''),
      ]);
      const topics = parseCsv(topicsText).slice(1).filter(r => r.length > 2);
      const attempts = parseCsv(attemptsText).slice(1).filter(r => r.length > 5);
      if (!topics.length && !attempts.length) continue;
      const totalEarned = topics.reduce((a, r) => a + (+r[3] || 0), 0);
      const totalAvail = topics.reduce((a, r) => a + (+r[4] || 0), 0);
      const weakest = topics.filter(r => +r[4] >= 5).sort((a, b) => (+a[5] || 0) - (+b[5] || 0)).slice(0, 5);
      const esc = v => String(v == null ? '' : v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      sections.push(`
        <h2>${esc(names[portal] || portal)}</h2>
        <p class="sum">${topics.length} topics attempted · ${totalEarned}/${totalAvail} marks${totalAvail ? ` · ${Math.round(totalEarned / totalAvail * 1000) / 10}% overall` : ''}</p>
        ${weakest.length ? `<h3>Weakest topics</h3><table><tr><th>Topic</th><th>Attempts</th><th>Marks</th><th>Accuracy</th></tr>${weakest.map(r =>
          `<tr><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}/${esc(r[4])}</td><td>${esc(r[5])}%</td></tr>`).join('')}</table>` : ''}
        <h3>All topics</h3><table><tr><th>Topic</th><th>Attempts</th><th>Marks</th><th>Accuracy</th></tr>${topics.map(r =>
          `<tr><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}/${esc(r[4])}</td><td>${esc(r[5])}%</td></tr>`).join('')}</table>
      `);
    } catch {}
  }
  win.document.write(`<!doctype html><html><head><title>Tutor report — JustQuizMe</title><style>
    body{font-family:Georgia,serif;max-width:760px;margin:32px auto;padding:0 18px;color:#222;}
    h1{font-size:24px;} h2{font-size:18px;margin-top:28px;border-bottom:1px solid #ccc;padding-bottom:4px;}
    h3{font-size:14px;margin:14px 0 6px;} table{border-collapse:collapse;width:100%;font-size:12.5px;}
    td,th{border:1px solid #ddd;padding:4px 8px;text-align:left;} th{background:#f4f4f4;}
    .sum{color:#555;font-size:13px;} .meta{color:#888;font-size:11.5px;}
    @media print{button{display:none;}}
  </style></head><body>
  <button onclick="window.print()" style="float:right;padding:6px 14px;">Print / Save PDF</button>
  <h1>Progress report</h1>
  <p class="meta">Generated ${new Date().toLocaleString()} · JustQuizMe combined tutor view</p>
  ${sections.join('') || '<p>No attempts recorded yet in any portal.</p>'}
  </body></html>`);
  win.document.close();
}
