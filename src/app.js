// src/app.js
// Express application factory — wires up middleware and routes
// Kept separate from server.js so it can be imported in tests without binding a port.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const requestLogger = require('./middleware/requestLogger');
const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const apiRoutes = require('./routes/apiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Adjust origin to your frontend URL in production
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(rateLimiter);

// ── Health check (no auth / rate limit) ──────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/apis', apiRoutes);

// ── Dashboard routes ──────────────────────────────────────────────────────────
app.use('/', dashboardRoutes);

// ── Root route - Simple HTML Dashboard ───────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Smart API Monitor</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
    .btn:hover { background: #0056b3; }
    .status { color: green; font-weight: bold; }
  </style>
</head>
<body>
  <h1>🚀 Smart API Monitor</h1>
  <div class="card">
    <p class="status">✓ Server Running</p>
    <p>Environment: development</p>
  </div>
  <div class="card">
    <h2>Available Pages</h2>
    <a class="btn" href="/apis">📡 View APIs</a>
    <a class="btn" href="/stats">📊 View Stats</a>
    <a class="btn" href="/logs">📝 View Logs</a>
    <a class="btn" href="/alerts">🔔 View Alerts</a>
    <a class="btn" href="/health">❤️ Health Check</a>
  </div>
</body>
</html>
  `);
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global error handler ──────────────────────────────────────────────────────
// Must be last — Express identifies error handlers by their 4-arg signature
app.use(errorHandler);

module.exports = app;
