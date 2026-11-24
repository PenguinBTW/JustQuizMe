const express = require('express');
const { checkMathEquivalence } = require('../services/cas-evaluator');
const BookmarkService = require('../services/bookmark-service');

function createMathsRouter(quizService, saveService) {
  const router = express.Router();
  const bookmarkService = new BookmarkService(saveService.dataDir);

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
    if (!b.quizUuid || typeof b.questionIndex !== 'number') {
      return res.status(400).json({ error: 'quizUuid and questionIndex required' });
    }
    const doc = saveService.setSave(b);
    res.json({ ok: true, save: doc });
  });

  router.delete('/save', (req, res) => {
    saveService.clearSave();
    res.json({ ok: true });
  });

  router.get('/bookmarks', (req, res) => {
    res.json(bookmarkService.list());
  });

  router.post('/bookmarks/toggle', (req, res) => {
    const b = req.body || {};
    if (!b.key || !b.qid || !b.file) {
      return res.status(400).json({ error: 'key, qid, file required' });
    }
    res.json({ ok: true, ...bookmarkService.toggle(b) });
  });

  router.delete('/bookmarks', (req, res) => {
    const key = String(req.query.key || '');
    if (!key) return res.status(400).json({ error: 'key required' });
    res.json({ ok: true, ...bookmarkService.remove(key) });
  });

  // Symbolic CAS evaluation endpoint
  router.post('/cas/eval', (req, res) => {
    const { actual, expected } = req.body || {};
    const isMatch = checkMathEquivalence(actual, expected);
    res.json({ ok: true, isMatch, actual, expected });
  });

  return router;
}

module.exports = createMathsRouter;
