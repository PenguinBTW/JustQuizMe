// Glue between the finished run in S and the print-sheet model: builds the
// hidden #printSheet section and calls window.print().
import { S } from './state.js';
import { ak } from './utils.js';
import { sheetModel, sheetHTML } from '../../shared/js/print-sheet.js';

export function printResults() {
  const host = document.getElementById('printSheet');
  if (!host || !S.quiz) return;
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
  window.print();
}
