// src/jobs/monitorScheduler.js
// Node-cron job that runs every N seconds and pings APIs whose
// intervalMinutes have elapsed since lastCheckedAt.

const cron = require('node-cron');
const MonitoredApi = require('../models/MonitoredApi');
const { pingApi } = require('../services/pingService');
const logger = require('../utils/logger');

let schedulerTask = null;

/**
 * Determine the cron expression from SCHEDULER_INTERVAL_SECONDS.
 * node-cron supports second-level precision with 6-field expressions.
 */
const buildCronExpression = () => {
  const interval = parseInt(process.env.SCHEDULER_INTERVAL_SECONDS || '30', 10);
  if (interval < 60) {
    // Every N seconds: "*/N * * * * *"
    return `*/${interval} * * * * *`;
  }
  // Every N minutes (round down): "0 */M * * *"
  const minutes = Math.floor(interval / 60);
  return `0 */${minutes} * * *`;
};

/**
 * Find all active APIs that are due for a check and ping them.
 * "Due" means: lastCheckedAt is null OR
 *              now >= lastCheckedAt + intervalMinutes
 */
const runSchedulerTick = async () => {
  try {
    const now = new Date();
    const apis = await MonitoredApi.find({ isActive: true });

    const dueApis = apis.filter((api) => {
      if (!api.lastCheckedAt) return true; // Never been checked
      const nextCheck = new Date(api.lastCheckedAt);
      nextCheck.setMinutes(nextCheck.getMinutes() + api.intervalMinutes);
      return now >= nextCheck;
    });

    if (dueApis.length === 0) return;

    logger.info(`Scheduler tick: ${dueApis.length} API(s) due for check`);

    // Run pings concurrently but cap parallelism to avoid overwhelming the system
    // Split into chunks of 10
    const CHUNK = 10;
    for (let i = 0; i < dueApis.length; i += CHUNK) {
      const chunk = dueApis.slice(i, i + CHUNK);
      await Promise.allSettled(chunk.map((api) => pingApi(api)));
    }
  } catch (err) {
    logger.error(`Scheduler tick error: ${err.message}`);
  }
};

/**
 * Start the scheduler.  Safe to call multiple times — idempotent.
 */
const startScheduler = () => {
  if (schedulerTask) {
    logger.warn('Scheduler already running — ignoring duplicate start call');
    return;
  }

  const expr = buildCronExpression();
  logger.info(`Starting monitor scheduler with cron: "${expr}"`);

  schedulerTask = cron.schedule(expr, runSchedulerTick, {
    scheduled: true,
    timezone: 'UTC',
  });

  logger.info('Monitor scheduler started');
};

const stopScheduler = () => {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    logger.info('Monitor scheduler stopped');
  }
};

module.exports = { startScheduler, stopScheduler, runSchedulerTick };
