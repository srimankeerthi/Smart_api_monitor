// src/routes/apiRoutes.js

const router = require('express').Router();
const {
  registerApi,
  listApis,
  getApi,
  updateApi,
  deleteApi,
  triggerPing,
} = require('../controllers/apiController');

// POST   /apis          — Register a new API
router.post('/', registerApi);

// GET    /apis          — List all registered APIs (supports ?isActive=true&page=1&limit=20)
router.get('/', listApis);

// GET    /apis/:id      — Get a single API
router.get('/:id', getApi);

// PUT    /apis/:id      — Full update
router.put('/:id', updateApi);

// PATCH  /apis/:id      — Partial update (same handler handles both)
router.patch('/:id', updateApi);

// DELETE /apis/:id      — Remove an API
router.delete('/:id', deleteApi);

// POST   /apis/:id/ping — Manually trigger an immediate ping
router.post('/:id/ping', triggerPing);

module.exports = router;
