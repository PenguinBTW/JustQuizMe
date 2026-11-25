const express = require('express');
const { checkMathEquivalence } = require('../services/cas-evaluator');

function createMathsRouter(quizService, saveService) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, subject: 'Mathematics', board: 'OCR H240' });
  });

  router.get('/quizzes', (req, res) => {
    res.json(quizService.listQuizzes());
  });

  router.get('/quiz', (req, res) => {
    const { category = 'normal', file = '' } = req.query;
    const quiz = quizService.getQuiz(String(category), String(file));
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    res.json(quiz);
  });

  router.get('/scores', (req, res) => {
    res.json(saveService.getScores());
  });

  router.post('/scores', (req, res) => {
    const b = req.body || {};
    if (!b.quizUuid || typeof b.score !== 'number' || typeof b.total !== 'number') {
      return res.status(400).json({ error: 'quizUuid, score, total required' });
    }
    const entry = saveService.addScore(b);
    res.json({ ok: true, entry });
  });

  router.get('/save', (req, res) => {
    res.json(saveService.getSave());
  });

  router.post('/save', (req, res) => {
    const b = req.body || {};
    if (!b.seriesContinuation && (!b.quizUuid || typeof b.questionIndex !== 'number')) {
      return res.status(400).json({ error: 'quizUuid and questionIndex required' });
    }
    const doc = saveService.setSave(b);
    res.json({ ok: true, save: doc });
  });

  router.delete('/save', (req, res) => {
    saveService.clearSave();
    res.json({ ok: true });
  });

  // Symbolic CAS evaluation endpoint
  router.post('/cas/eval', (req, res) => {
    const { actual, expected } = req.body || {};
    const isMatch = checkMathEquivalence(actual, expected);
    res.json({ ok: true, isMatch, actual, expected });
  });

  
  // author studio: validated atomic bank writes
  const { saveAuthoredBank, upsertQuestion, safeFileName } = require('../services/author-service');
  router.post('/author/save', (req, res) => {
    // authoring writes are loopback-only: the platform is a local single-user
    // tool, and bank writes must never be drivable from another machine
    const rawIp = String(req.ip || (req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/i, '');
    const isLoopback = rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === 'localhost';
    if (!isLoopback) {
      return res.status(403).json({ error: 'authoring is local-only' });
    }
    // browsers send cross-origin POSTs to localhost even without CORS permission
    // (no-cors writes execute blind) — any Origin that is not this machine is a drive-by.
    // DNS-rebinding defense: the Host header itself must be loopback. A
    // same-origin check alone cannot distinguish a hosts-file alias from an
    // attacker-controlled domain rebound to 127.0.0.1 — so by default only
    // loopback hosts may write. Users who genuinely serve the portal over a
    // local alias opt in explicitly via JQM_AUTHOR_HOSTS="alias1,alias2".
    const hostName = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
    const extraHosts = String(process.env.JQM_AUTHOR_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
    const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', ...extraHosts]);
    if (!allowedHosts.has(hostName)) {
      return res.status(403).json({ error: 'authoring writes require a loopback host (set JQM_AUTHOR_HOSTS for aliases)' });
    }
    const origin = req.headers.origin;
    if (origin) {
      // cross-origin writes are drive-bys regardless of which host they name
      let originHost = null;
      try { originHost = new URL(origin).hostname.toLowerCase(); } catch {}
      if (!originHost || !allowedHosts.has(originHost)) {
        return res.status(403).json({ error: 'cross-origin writes rejected' });
      }
    }
    try {
      const b = req.body || {};
      const bank = b.bank;
      if (!bank || typeof bank !== 'object') return res.status(400).json({ error: 'bank object required' });
      let final = bank;
      const fname = safeFileName(b.file || bank.title) + '.json';
      const full = require('path').join(quizService.normalDir, fname);
      const fs = require('fs');
      if (fs.existsSync(full) && b.question) {
        // edit-existing: merge the authored question into the existing bank
        const existing = JSON.parse(fs.readFileSync(full, 'utf8'));
        final = upsertQuestion(existing, b.question);
      } else if (b.question) {
        final = upsertQuestion(bank, b.question);
      }
      const out = saveAuthoredBank(quizService.normalDir, final, b.file || bank.title);
      res.json({ ok: true, ...out });
    } catch (e) {
      if (e.errors) return res.status(422).json({ error: 'validation failed', details: e.errors });
      res.status(500).json({ error: String(e.message || e) });
    }
  });

  router.get('/author/bank', (req, res) => {
    // edit-existing: load a bank for the author form
    const fs = require('fs');
    const path = require('path');
    const fname = safeFileName(String(req.query.file || '').replace(/\.json$/i, '')) + '.json';
    const full = path.join(quizService.normalDir, fname);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'bank not found' });
    try { res.json(JSON.parse(fs.readFileSync(full, 'utf8'))); }
    catch (e) { res.status(500).json({ error: 'bank file unreadable' }); }
  });

  return router;
}

module.exports = createMathsRouter;
