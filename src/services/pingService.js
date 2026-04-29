// src/services/pingService.js
// Core ping engine: hits a registered API, records the result, and
// updates consecutive-failure counters.

const axios = require('axios');
const PingLog = require('../models/PingLog');
const MonitoredApi = require('../models/MonitoredApi');
const { checkAndFireAlert } = require('./alertService');
const logger = require('../utils/logger');

/**
 * Ping a single MonitoredApi document.
 * Returns the created PingLog document.
 *
 * @param {Object} api  A Mongoose MonitoredApi document
 */
const pingApi = async (api) => {
  const startTime = Date.now();
  let pingData = {
    apiId: api._id,
    url: api.url,
    checkedAt: new Date(),
  };

  try {
    const response = await axios({
      method: api.method.toLowerCase(),
      url: api.url,
      headers: api.headers ? Object.fromEntries(api.headers) : {},
      data: api.body || undefined,
      // Timeout = 2× the expected response time (minimum 5 s) to give a fair window
      timeout: Math.max(api.expectedResponseTimeMs * 2, 5000),
      // Don't throw on 4xx/5xx — we want to record the status code
      validateStatus: () => true,
    });

    const responseTimeMs = Date.now() - startTime;
    const isHttpSuccess = response.status >= 200 && response.status < 300;
    // Degraded = responded OK but slower than expected
    const isFast = responseTimeMs <= api.expectedResponseTimeMs;
    const success = isHttpSuccess && isFast;

    let status;
    if (!isHttpSuccess) status = 'down';
    else if (!isFast) status = 'degraded';
    else status = 'up';

    Object.assign(pingData, {
      statusCode: response.status,
      responseTimeMs,
      success,
      status,
      errorMessage: isHttpSuccess ? null : `HTTP ${response.status}`,
    });

    logger.info(
      `PING [${status.toUpperCase()}] ${api.name} — ` +
        `${response.status} in ${responseTimeMs}ms (limit ${api.expectedResponseTimeMs}ms)`
    );
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');

    Object.assign(pingData, {
      responseTimeMs,
      success: false,
      status: isTimeout ? 'timeout' : 'down',
      errorMessage: err.message,
    });

    logger.warn(`PING [FAIL] ${api.name} — ${err.message}`);
  }

  // ── Persist the log ────────────────────────────────────────────────────
  const log = await PingLog.create(pingData);

  // ── Update the parent API document ────────────────────────────────────
  const updateFields = {
    lastCheckedAt: new Date(),
    currentStatus: pingData.status,
  };

  if (pingData.success) {
    // Reset failure counter on any success
    updateFields.consecutiveFailures = 0;
    await MonitoredApi.findByIdAndUpdate(api._id, updateFields);
  } else {
    // Atomically increment the failure counter
    await MonitoredApi.findByIdAndUpdate(api._id, {
      ...updateFields,
      $inc: { consecutiveFailures: 1 },
    });
    // Re-fetch to get the updated counter before alert check
    const refreshed = await MonitoredApi.findById(api._id);
    if (refreshed) await checkAndFireAlert(refreshed, pingData.errorMessage);
  }

  return log;
};

module.exports = { pingApi };
