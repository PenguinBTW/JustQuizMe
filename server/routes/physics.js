const express = require('express');

function createPhysicsRouter(quizService, saveService) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, subject: 'Physics', board: 'AQA 7408' });
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

  return router;
}

module.exports = createPhysicsRouter;
