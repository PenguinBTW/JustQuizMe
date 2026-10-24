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
