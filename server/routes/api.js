const express = require('express');
const { calculateAllMetrics } = require('../services/metrics-service');
const { buildBankHealthReport } = require('../services/bank-health');

function createApiRouter(services) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json({
      cs: { online: true, route: '/cs', name: 'Computer Science' },
      maths: { online: true, route: '/maths', name: 'Mathematics' },
      physics: { online: true, route: '/physics', name: 'Physics' },
      timestamp: Date.now()
    });
  });

  router.get('/metrics', (req, res) => {
    try {
      const metrics = calculateAllMetrics(services);
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: 'Failed to calculate metrics: ' + err.message });
    }
  });

  // Read-only scan of each portal's question-bank manifests: quiz/question
  // totals, missing required fields, marks distribution, duplicate ids.
  router.get('/bank-health', (req, res) => {
    try {
      const subjects = {};
      for (const [key, svc] of Object.entries(services)) {
        subjects[key] = {
          name: svc.quizService.config.name,
          spec: svc.quizService.config.spec,
          questionsDir: svc.quizService.questionsDir
        };
      }
      res.json(buildBankHealthReport(subjects));
    } catch (err) {
      res.status(500).json({ error: 'Failed to scan question banks: ' + err.message });
    }
  });

  return router;
}

module.exports = createApiRouter;
