// Glue between the finished run in S and the print-sheet model. The hidden
// #printSheet section is populated on demand — by the Print button and by
// any browser print (Ctrl+P) while the summary is on screen — and cleared
// after printing so stale results never leak into a later printout.
import { S } from './state.js';
import { ak } from './utils.js';
import { sheetModel, sheetHTML } from '../../shared/js/print-sheet.js';

/** Fill #printSheet from the run currently summarized on screen.
 * Returns true when a sheet was written — false leaves the page printing
 * normally (no summary visible → nothing to sheet-ify). */
function populate() {
  const host = document.getElementById('printSheet');
  if (!host) return false;
  // The summary card is the only view that renders this button.
  if (!document.getElementById('finishPrintBtn') || !S.quiz) {
    host.innerHTML = '';
    return false;
  }
  const model = sheetModel({
    title: S.quiz.title || 'Assessment',
    mode: S.runMode,
    date: new Date().toLocaleDateString('en-GB'),
    durationSeconds: S.elapsed,
    questions: (S.quiz.questions || []).map((q, i) => ({
      ref: `Q${i + 1}`,
      text: q.text || q.title || q.prompt || '',
      marks: +q.marks || 0,
      score: (S.answers[ak(q)] || {}).score || 0,
    })),
  });
  host.innerHTML = sheetHTML(model);
  return true;
}

export function printResults() {
  if (populate()) window.print();
}

window.addEventListener('beforeprint', () => {
  document.body.classList.toggle('printing-sheet', populate());
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-sheet');
  const host = document.getElementById('printSheet');
  if (host) host.innerHTML = '';
});
