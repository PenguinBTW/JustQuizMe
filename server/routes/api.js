const express = require('express');
const { calculateAllMetrics } = require('../services/metrics-service');

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

  // Cross-subject revision overview: raw score histories per subject in one
  // place. The stores live side-by-side under data/ on this server, so this is
  // honest aggregation — mastery math happens client-side via the shared module.
  router.get('/overview', (req, res) => {
    try {
      const out = {};
      for (const key of ['cs', 'maths', 'physics']) {
        const svc = services[key] && services[key].saveService;
        let scores = [];
        try { scores = svc ? svc.getScores() : []; } catch { scores = []; }
        out[key] = { scores: Array.isArray(scores) ? scores : (scores && Array.isArray(scores.scores) ? scores.scores : []) };
      }
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: 'Failed to build overview: ' + err.message });
    }
  });

  router.get('/metrics', (req, res) => {
    try {
      const metrics = calculateAllMetrics(services);
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: 'Failed to calculate metrics: ' + err.message });
    }
  });

  return router;
}

module.exports = createApiRouter;
