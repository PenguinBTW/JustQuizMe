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
    else if (q.options.some(o => !String(typeof o === 'object' && o !== null ? o.text || '' : o ?? '').trim())) errs.push('options: entries must be non-empty');
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

// author-entered metadata is rendered into portal pages — strip markup so a
// crafted topic/title can't carry script into learners' browsers
function stripTags(v) {
  return typeof v === 'string' ? v.replace(/<[^>]*>/g, '') : v;
}

function sanitizeBankMeta(bank) {
  const out = { ...bank, title: stripTags(bank.title) };
  out.questions = (bank.questions || []).map(q => q && typeof q === 'object'
    ? { ...q, topic: stripTags(q.topic), subtopic: stripTags(q.subtopic) }
    : q);
  if (Array.isArray(bank.topics)) out.topics = bank.topics.map(stripTags);
  return out;
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

  bank = sanitizeBankMeta(bank);
  let final = bank;
  if (fs.existsSync(full)) {
    // title collisions must not silently replace someone else's bank: the
    // incoming uuid must match the file's, otherwise this is a different bank
    // that happens to share a title-derived filename
    try {
      const existing = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (existing && existing.uuid && bank.uuid && existing.uuid !== bank.uuid) {
        const e = new Error(`file '${fname}' already exists as a different bank — use edit-existing or a distinct title`);
        e.errors = [e.message];
        throw e;
      }
      // merge by question id: concurrent authors editing different questions
      // of the same bank don't erase each other's work
      const merged = { ...existing, ...bank };
      const byId = new Map();
      for (const q of existing.questions || []) if (q && q.id) byId.set(q.id, q);
      for (const q of bank.questions || []) if (q && q.id) byId.set(q.id, q);
      merged.questions = [...byId.values()];
      const mErrs = validateBank(merged);
      if (mErrs.length) {
        const e = new Error('merged bank invalid');
        e.errors = mErrs;
        throw e;
      }
      final = merged;
    } catch (err) {
      if (err.errors) throw err;
      // unreadable existing file — fall through to replace-with-backup
    }
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
