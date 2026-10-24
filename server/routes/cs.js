const express = require('express');
const { runOcrPseudocode } = require('../services/runners/ocr-pseudo');
const { runCsharpCode } = require('../services/runners/csharp-runner');
const { runLMC } = require('../services/runners/lmc-runner');

function createCsRouter(quizService, saveService) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, subject: 'Computer Science', board: 'OCR H446' });
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

  // Runner execution endpoints
  router.post('/execute/ocr-pseudo', (req, res) => {
    const { code = '', requirements = [], options = {} } = req.body || {};
    try {
      const result = runOcrPseudocode(code, requirements, options);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, compileError: err.message, results: [], stdout: '' });
    }
  });

  router.post('/execute/csharp', async (req, res) => {
    const { code = '', requirements = [], options = {} } = req.body || {};
    try {
      const result = await runCsharpCode(code, requirements, options);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, compileError: err.message, results: [], stdout: '' });
    }
  });

  router.post('/execute/lmc', (req, res) => {
    const { code = '', requirements = [], options = {} } = req.body || {};
    try {
      const result = runLMC(code, requirements, options);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, compileError: err.message, results: [], stdout: '' });
    }
  });

  router.post('/execute/batch', async (req, res) => {
    const { submissions = [] } = req.body || {};
    const results = {};

    for (const item of submissions) {
      const { questionId, language, code, requirements, options } = item;
      if (!questionId) continue;

      try {
        if (language === 'csharp') {
          results[questionId] = await runCsharpCode(code || '', requirements || [], options || {});
        } else if (language === 'lmc') {
          results[questionId] = runLMC(code || '', requirements || [], options || {});
        } else {
          results[questionId] = runOcrPseudocode(code || '', requirements || [], options || {});
        }
      } catch (err) {
        results[questionId] = {
          success: false,
          compileError: err.message,
          totalScore: 0,
          maxScore: (requirements || []).reduce((s, r) => s + (r.marks || 0), 0),
          results: [],
          stdout: ''
        };
      }
    }

    res.json({ ok: true, results });
  });

  return router;
}

module.exports = createCsRouter;
