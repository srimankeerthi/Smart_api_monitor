// src/server.js
// Entry point — loads .env, connects to DB + Redis, starts scheduler,
// then binds the HTTP server.

require('dotenv').config();

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/database');
const { getRedisClient } = require('./config/redis');
const { startScheduler, stopScheduler } = require('./jobs/monitorScheduler');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT || '3000', 10);

let server;

const bootstrap = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Connect to Redis (lazy — first command triggers connection)
  try {
    const redis = getRedisClient();
    await redis.connect(); // ioredis lazyConnect requires explicit connect()
    logger.info('Redis client ready');
  } catch (err) {
    // Redis is optional — app degrades gracefully without it
    logger.warn(`Redis unavailable: ${err.message} — caching disabled`);
  }

  // 3. Start the monitoring scheduler
  startScheduler();

  // 4. Start HTTP server
  server = app.listen(PORT, () => {
    logger.info(`Smart API Monitor running on http://localhost:${PORT} [${process.env.NODE_ENV}]`);
    logger.info('Available endpoints:');
    logger.info('  POST   /apis                  — Register API');
    logger.info('  GET    /apis                  — List APIs');
    logger.info('  GET    /apis/:id              — Get API');
    logger.info('  PUT    /apis/:id              — Update API');
    logger.info('  DELETE /apis/:id              — Delete API');
    logger.info('  POST   /apis/:id/ping         — Trigger manual ping');
    logger.info('  GET    /stats?hours=24        — Uptime & latency stats');
    logger.info('  GET    /logs                  — Ping logs');
    logger.info('  GET    /alerts                — Alerts');
    logger.info('  PATCH  /alerts/:id/resolve    — Resolve alert');
    logger.info('  GET    /health                — Health check');
  });
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  stopScheduler();
  if (server) {
    server.close(async () => {
      await disconnectDB();
      try { await getRedisClient().quit(); } catch {}
      logger.info('Shutdown complete');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Catch unhandled promise rejections — log and exit so the process manager restarts
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.stack}`);
  shutdown('uncaughtException');
});

bootstrap().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
