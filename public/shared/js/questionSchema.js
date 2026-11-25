// Question schema validation — shared client/server logic, schema v1 per
// docs/QUESTION_SCHEMA.md. Pure functions, no deps, honest errors list.

const TYPES = ['multiple-choice', 'written', 'calculation', 'self-marked', 'extended-response', 'code-requirement', 'lmc', 'trace-table', 'truth-table', 'symbolic-exact'];

// validateQuestion(q) → string[] of problems ([] = valid). Never throws.
export function validateQuestion(q) {
  const errs = [];
  if (!q || typeof q !== 'object') return ['question is not an object'];
  if (!q.id || typeof q.id !== 'string') errs.push('id: required string');
  if (!q.type || !TYPES.includes(q.type)) errs.push(`type: must be one of ${TYPES.join(', ')}`);
  if (!(+q.marks > 0)) errs.push('marks: must be a positive number');
  if (!q.prompt || typeof q.prompt !== 'string') errs.push('prompt: required string');
  if (!q.topic || typeof q.topic !== 'string') errs.push('topic: required string');

  if (q.type === 'multiple-choice') {
    if (!Array.isArray(q.options) || q.options.length < 2) errs.push('options: need at least 2');
    else if (q.options.some(o => !String(typeof o === 'object' && o !== null ? o.text || '' : o ?? '').trim())) errs.push('options: entries must be non-empty');
    if (!(Number.isInteger(q.correctIndex) && q.options && q.correctIndex >= 0 && q.correctIndex < q.options.length))
      errs.push('correctIndex: must index into options');
  }
    if (q.type === 'calculation') {
    if (q.answer != null && typeof q.answer !== 'number') errs.push('answer: must be a number');
    if (q.tolerancePercent != null && typeof q.tolerancePercent !== 'number') errs.push('tolerancePercent: must be a number');
  }
  if (q.type === 'trace-table' && (!Array.isArray(q.expectedRows) || !q.expectedRows.length)) {
    errs.push('expectedRows: trace-table questions require at least one expected row — without one the grader can award no marks');
  }
  if (q.type === 'written' || q.type === 'extended-response' || q.type === 'self-marked') {
    if (q.markScheme != null) {
      if (!Array.isArray(q.markScheme)) errs.push('markScheme: must be an array');
      else q.markScheme.forEach((m, i) => {
        if (!m || typeof m.text !== 'string' || !m.text.trim()) errs.push(`markScheme[${i}]: text required (non-empty)`);
        if (!(+m.marks > 0)) errs.push(`markScheme[${i}]: marks must be positive`);
      });
      const msTotal = (q.markScheme || []).reduce((s, m) => s + (+m.marks || 0), 0);
      if (Array.isArray(q.markScheme) && q.markScheme.length && msTotal !== +q.marks)
        errs.push(`markScheme marks sum to ${msTotal}, question is ${q.marks}`);
    }
  }
  if (q.type === 'calculation') {
    if (q.answer == null || isNaN(+q.answer)) errs.push('answer: numeric answer required');
  }
  if (q.mistakes != null) {
    if (!Array.isArray(q.mistakes)) errs.push('mistakes: must be an array');
    else q.mistakes.forEach((m, i) => {
      if (!m || typeof m !== 'object') { errs.push(`mistakes[${i}]: must be an object`); return; }
      if (!m.misconception) errs.push(`mistakes[${i}]: misconception required`);
      if (q.type === 'multiple-choice' && m.optionIndex != null) {
        if (!Number.isInteger(m.optionIndex) || !q.options || m.optionIndex < 0 || m.optionIndex >= q.options.length)
          errs.push(`mistakes[${i}]: optionIndex out of range`);
      } else if (q.type !== 'multiple-choice' && m.pattern != null && typeof m.pattern !== 'string') {
        errs.push(`mistakes[${i}]: pattern must be a string`);
      }
      if (m.optionIndex == null && m.pattern == null)
        errs.push(`mistakes[${i}]: needs optionIndex (MCQ) or pattern (text types)`);
    });
  }
  return errs;
}

// validateBank(bank) → string[] — metadata + every question.
export function validateBank(bank) {
  const errs = [];
  if (!bank || typeof bank !== 'object') return ['bank is not an object'];
  if (!bank.uuid) errs.push('uuid required');
  if (!bank.title) errs.push('title required');
  if (!Array.isArray(bank.questions) || !bank.questions.length) errs.push('questions: at least one required');
  (bank.questions || []).forEach((q, i) => {
    for (const e of validateQuestion(q)) errs.push(`q${i + 1}: ${e}`);
  });
  const ids = new Set();
  (bank.questions || []).forEach(q => {
    if (q && q.id) { if (ids.has(q.id)) errs.push(`duplicate question id: ${q.id}`); ids.add(q.id); }
  });
  return errs;
}
