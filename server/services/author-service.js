// Author-service: validated, atomic writes of authored questions into bank files.
// Never corrupts existing banks: validate first, write to temp + rename, backup original.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// validateQuestion/validateBank mirrored server-side (CJS) — keep in sync with
// public/shared/js/questionSchema.js.
const TYPES = ['multiple-choice', 'written', 'calculation', 'self-marked', 'extended-response', 'code-requirement', 'lmc', 'trace-table', 'truth-table'];

function validateQuestion(q) {
  const errs = [];
  if (!q || typeof q !== 'object') return ['question is not an object'];
  if (!q.id || typeof q.id !== 'string') errs.push('id: required string');
  if (!q.type || !TYPES.includes(q.type)) errs.push(`type: must be one of ${TYPES.join(', ')}`);
  if (!(+q.marks > 0)) errs.push('marks: must be a positive number');
  if (!q.prompt || typeof q.prompt !== 'string') errs.push('prompt: required string');
  if (!q.topic || typeof q.topic !== 'string') errs.push('topic: required string');
  if (q.type === 'multiple-choice') {
    if (!Array.isArray(q.options) || q.options.length < 2) errs.push('options: need at least 2');
    if (!(Number.isInteger(q.correctIndex) && q.options && q.correctIndex >= 0 && q.correctIndex < q.options.length))
      errs.push('correctIndex: must index into options');
  }
  if (q.type === 'calculation' && (q.answer == null || isNaN(+q.answer))) errs.push('answer: numeric answer required');
  return errs;
}

function validateBank(bank) {
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

// sanitizeFileName — authored banks live in questions/normal; no traversal.
function safeFileName(name) {
  const base = String(name || '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return base || 'untitled';
}

// saveAuthoredBank(normalDir, bank, fileName) → { file } or throws with .errors
function saveAuthoredBank(normalDir, bank, fileName) {
  const errs = validateBank(bank);
  if (errs.length) {
    const e = new Error('validation failed');
    e.errors = errs;
    throw e;
  }
  const fname = safeFileName(fileName || bank.title) + '.json';
  const full = path.join(normalDir, fname);
  fs.mkdirSync(normalDir, { recursive: true });

  let final = bank;
  if (fs.existsSync(full)) {
    // edit-existing: validate the merged result as a whole, back up first
    const backup = full + '.bak-' + Date.now();
    fs.copyFileSync(full, backup);
  }
  const tmp = full + '.tmp-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(final, null, 2));
  fs.renameSync(tmp, full); // atomic on same filesystem
  return { file: fname };
}

// upsertQuestion(bank, question) → new bank object with the question added or replaced by id
function upsertQuestion(bank, question) {
  const errs = validateQuestion(question);
  if (errs.length) {
    const e = new Error('validation failed');
    e.errors = errs;
    throw e;
  }
  const qs = Array.isArray(bank.questions) ? [...bank.questions] : [];
  const idx = qs.findIndex(q => q && q.id === question.id);
  if (idx >= 0) qs[idx] = question; else qs.push(question);
  return { ...bank, questions: qs };
}

module.exports = { validateQuestion, validateBank, saveAuthoredBank, upsertQuestion, safeFileName };
