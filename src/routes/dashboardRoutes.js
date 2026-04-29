// src/routes/dashboardRoutes.js

const router = require('express').Router();
const {
  getStats,
  getLogs,
  getAlerts,
  resolveAlert,
} = require('../controllers/dashboardController');

// GET    /stats              — Uptime % and avg latency per API
// Query: ?hours=24           — Window (default 24h, max 720h)
router.get('/stats', getStats);

// GET    /logs               — Paginated ping logs
// Query: ?apiId=&status=&from=&to=&page=1&limit=50
router.get('/logs', getLogs);

// GET    /alerts             — Paginated alerts
// Query: ?resolved=false&page=1&limit=20
router.get('/alerts', getAlerts);

// PATCH  /alerts/:id/resolve — Mark an alert as resolved
router.patch('/alerts/:id/resolve', resolveAlert);

module.exports = router;
