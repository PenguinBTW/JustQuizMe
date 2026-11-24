// Print-sheet model for quiz/exam results — pure, DOM-free, unit-testable.
// sheetModel(run) -> { title, subtitle, rows, totals }; sheetHTML(model) ->
// the printable markup the hidden #printSheet section is filled with.

const MAX_TEXT = 140;

/** Flatten question text for a one-line table cell: strip tags/markdown
 * noise, collapse whitespace, cap at MAX_TEXT with an ellipsis. */
export function trimText(s, max = MAX_TEXT) {
  const flat = String(s ?? '')
    // only strip things that look like real tags — `a < b and c > d` is text
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/\$\$?[^$]*\$\$?|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, '(math)')
    .replace(/`{1,3}[^`]*`{1,3}/g, '(code)')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:%)\]])/g, '$1')
    .trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
}

/** verdict for a scored question: full / partial / none. */
export function verdict(score, marks) {
  const s = Math.min(marks, Math.max(0, score || 0));
  if (marks <= 0) return s > 0 ? 'full' : 'none';
  return s >= marks ? 'full' : s > 0 ? 'partial' : 'none';
}

/**
 * Build the sheet model from a finished run.
 * run: { title, mode, date?, durationSeconds?, questions: [{ ref?, text?, marks?, score? }] }
 */
export function sheetModel(run = {}) {
  const qs = Array.isArray(run.questions) ? run.questions : [];
  const rows = qs.map((q, i) => {
    const marks = +q.marks || 0;
    const score = Math.min(marks, Math.max(0, +q.score || 0));
    return {
      ref: String(q.ref ?? `Q${i + 1}`),
      text: trimText(q.text ?? q.title ?? q.prompt ?? ''),
      score,
      marks,
      verdict: verdict(score, marks),
    };
  });
  const earned = rows.reduce((a, r) => a + r.score, 0);
  const total = rows.reduce((a, r) => a + r.marks, 0);
  const pct = total ? Math.round((earned / total) * 100) : 0;
  return {
    title: String(run.title ?? 'Assessment'),
    subtitle: [run.mode ? `${run.mode} mode` : '', run.date ?? '', run.durationSeconds != null ? fmt(run.durationSeconds) : ''].filter(Boolean).join(' · '),
    rows,
    totals: { earned, total, pct },
  };
}

const fmt = (s) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;

const VERDICT_LABEL = { full: '✓ full', partial: '◐ partial', none: '—' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Render the model to the printable markup. */
export function sheetHTML(m) {
  const rows = m.rows.map((r) =>
    `<tr><td class="pr-ref">${esc(r.ref)}</td><td>${esc(r.text)}</td>` +
    `<td class="pr-marks">${r.score} / ${r.marks}</td>` +
    `<td class="pr-v pr-v-${r.verdict}">${VERDICT_LABEL[r.verdict]}</td></tr>`).join('\n');
  return `<section class="print-sheet">
  <header><h1>${esc(m.title)}</h1><p class="pr-sub">${esc(m.subtitle)}</p></header>
  <p class="pr-summary"><strong>${m.totals.earned} / ${m.totals.total}</strong> (${m.totals.pct}%)</p>
  <table class="pr-table">
    <thead><tr><th>Ref</th><th>Question</th><th>Marks</th><th>Verdict</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <footer class="pr-foot">Total ${m.totals.earned} / ${m.totals.total} · ${m.totals.pct}% · printed ${new Date().toLocaleDateString('en-GB')}</footer>
</section>`;
}
