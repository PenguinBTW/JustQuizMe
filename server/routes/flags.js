// Question issue flags — shared across all portals.
// POST /api/flags appends {portal, fileBase, questionId, reason, note, at}
// to data/flags.json; GET /api/flags returns the stored list.
const crypto = require('crypto');
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
    // valid JSON that isn't a flags array is still corrupt — never clobber it
    return Array.isArray(parsed) ? parsed : null;
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
  const { portal, fileBase, category, questionId, reason, note } = body;
  if (!PORTALS.has(portal)) return `portal must be one of ${[...PORTALS].join(', ')}`;
  if (typeof fileBase !== 'string' || fileBase.length > 200 || /[/\\]|\.\./.test(fileBase)) {
    return 'fileBase must be a plain filename string (<=200 chars, no path separators)';
  }
  if (category !== undefined && (typeof category !== 'string' || category.length > 80)) {
    return 'category must be a string <=80 chars';
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
      id: crypto.randomUUID(),
      portal: req.body.portal,
      fileBase: req.body.fileBase,
      ...(typeof req.body.category === 'string' ? { category: req.body.category } : {}),
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

  // Unflag: removes exactly the flagged report the client selected. `id` is
  // the primary key (assigned at POST); callers holding a row written before
  // ids existed may send {portal, fileBase, questionId, at} instead — the
  // first row matching all of those fields is removed.
  router.delete('/flags', (req, res) => {
    const body = req.body;
    const byId = body && typeof body.id === 'string' && body.id.length > 0;
    const byFields =
      body && typeof body === 'object' && typeof body.at === 'string' && body.at;
    if (!body || typeof body !== 'object' || (!byId && !byFields)) {
      return res.status(400).json({ error: 'expected {id} or {portal, fileBase, questionId, at}' });
    }
    const flags = readFlags();
    if (flags === null) {
      return res.status(500).json({ error: 'flags store is corrupt and could not be read' });
    }
    const i = flags.findIndex((f) =>
      byId
        ? f.id === body.id
        : f.portal === body.portal &&
          f.fileBase === body.fileBase &&
          String(f.questionId) === String(body.questionId) &&
          f.at === body.at
    );
    if (i < 0) return res.status(404).json({ error: 'no matching flag' });
    flags.splice(i, 1);
    try {
      writeFlags(flags);
    } catch (err) {
      return res.status(500).json({ error: 'failed to persist unflag: ' + err.message });
    }
    res.json({ ok: true, count: flags.length });
  });

  return router;
}

module.exports = createFlagsRouter;
module.exports._internals = { FLAGS_FILE, readFlags, writeFlags, validateFlag };
