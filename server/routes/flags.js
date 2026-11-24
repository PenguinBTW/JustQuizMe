// Question issue flags — shared across all portals.
// POST /api/flags appends {portal, fileBase, questionId, reason, note, at}
// to data/flags.json; GET /api/flags returns the stored list.
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const FLAGS_FILE = path.join(config.DATA_DIR, 'flags.json');

const PORTALS = new Set(['cs', 'maths', 'physics', 'home']);
const REASONS = new Set(['wrong-answer', 'broken-figure', 'typo', 'other']);
const MAX_NOTE = 2000;

function readFlags() {
  try {
    const raw = fs.readFileSync(FLAGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    return null; // corrupt file — caller decides (500), never silently clobber
  }
}

function writeFlags(list) {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  const tmp = FLAGS_FILE + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FLAGS_FILE); // same-dir rename: atomic on POSIX
}

function validateFlag(body) {
  if (!body || typeof body !== 'object') return 'payload must be an object';
  const { portal, fileBase, questionId, reason, note } = body;
  if (!PORTALS.has(portal)) return `portal must be one of ${[...PORTALS].join(', ')}`;
  if (typeof fileBase !== 'string' || fileBase.length > 200 || /[/\\]|\.\./.test(fileBase)) {
    return 'fileBase must be a plain filename string (<=200 chars, no path separators)';
  }
  if (typeof questionId !== 'string' && typeof questionId !== 'number') return 'questionId must be a string or number';
  if (String(questionId).length > 120) return 'questionId too long';
  if (!REASONS.has(reason)) return `reason must be one of ${[...REASONS].join(', ')}`;
  if (typeof note !== 'string' || note.length > MAX_NOTE) return `note must be a string <=${MAX_NOTE} chars`;
  return null;
}

function createFlagsRouter() {
  const router = express.Router();

  router.get('/flags', (req, res) => {
    const flags = readFlags();
    if (flags === null) {
      return res.status(500).json({ error: 'flags store is corrupt and could not be read' });
    }
    res.json(flags);
  });

  router.post('/flags', (req, res) => {
    const bad = validateFlag(req.body);
    if (bad) return res.status(400).json({ error: bad });
    const flags = readFlags();
    if (flags === null) {
      return res.status(500).json({ error: 'flags store is corrupt and could not be read' });
    }
    flags.push({
      portal: req.body.portal,
      fileBase: req.body.fileBase,
      questionId: req.body.questionId,
      reason: req.body.reason,
      note: req.body.note.trim(),
      at: new Date().toISOString()
    });
    try {
      writeFlags(flags);
    } catch (err) {
      return res.status(500).json({ error: 'failed to persist flag: ' + err.message });
    }
    res.json({ ok: true, count: flags.length });
  });

  return router;
}

module.exports = createFlagsRouter;
module.exports._internals = { FLAGS_FILE, readFlags, writeFlags, validateFlag };
