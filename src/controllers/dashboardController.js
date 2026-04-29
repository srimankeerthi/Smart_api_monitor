// src/controllers/dashboardController.js
// Read-only dashboard endpoints: /stats, /logs, /alerts

const PingLog = require('../models/PingLog');
const Alert = require('../models/Alert');
const MonitoredApi = require('../models/MonitoredApi');
const { cacheGet, cacheSet } = require('../config/redis');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '30', 10);

// ── GET /stats ────────────────────────────────────────────────────────────────
/**
 * Returns per-API uptime percentage and average latency.
 * Computes over the last 24 hours by default (customisable via ?hours=N).
 * Results are Redis-cached for CACHE_TTL seconds to keep DB load low.
 */
const getStats = async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours || '24', 10), 720); // max 30 days
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const cacheKey = `stats:global:${hours}h`;

    // ── Cache hit ──
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return successResponse(res, JSON.parse(cached), 'Stats (cached)');
    }

    // ── Aggregate logs per API ──
    // Try simple aggregation first, skip if no data
    let stats = [];
    try {
      const pipeline = [
        { $match: { checkedAt: { $gte: since } } },
        {
          $group: {
            _id: '$apiId',
            totalPings: { $sum: 1 },
            successfulPings: { $sum: { $cond: ['$success', 1, 0] } },
            avgResponseTimeMs: { $avg: '$responseTimeMs' },
            minResponseTimeMs: { $min: '$responseTimeMs' },
            maxResponseTimeMs: { $max: '$responseTimeMs' },
            lastStatus: { $last: '$status' },
          },
        },
        {
          $lookup: {
            from: 'monitoredapis',
            localField: '_id',
            foreignField: '_id',
            as: 'api',
          },
        },
        { $unwind: { path: '$api', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            apiId: '$_id',
            name: '$api.name',
            url: '$api.url',
            totalPings: 1,
            successfulPings: 1,
            uptimePercent: {
              $round: [
                { $multiply: [{ $divide: ['$successfulPings', '$totalPings'] }, 100] },
                2,
              ],
            },
            avgResponseTimeMs: { $round: ['$avgResponseTimeMs', 0] },
            minResponseTimeMs: 1,
            maxResponseTimeMs: 1,
            lastStatus: 1,
          },
        },
        { $sort: { uptimePercent: 1 } },
      ];

      stats = await PingLog.aggregate(pipeline);
    } catch (aggErr) {
      logger.error(`Aggregation error: ${aggErr.message}`);
      stats = [];
    }

    // ── Global summary ──
    const totalApis = await MonitoredApi.countDocuments({ isActive: true });
    const downApis = stats.filter((s) => s.lastStatus === 'down').length;
    const overallUptime =
      stats.length > 0
        ? (stats.reduce((sum, s) => sum + s.uptimePercent, 0) / stats.length).toFixed(2)
        : null;

    const payload = {
      summary: {
        totalActiveApis: totalApis,
        apisDown: downApis,
        apisUp: totalApis - downApis,
        overallUptimePercent: overallUptime ? parseFloat(overallUptime) : null,
        windowHours: hours,
        generatedAt: new Date().toISOString(),
      },
      apis: stats,
    };

    await cacheSet(cacheKey, JSON.stringify(payload), CACHE_TTL);
    return successResponse(res, payload, 'Stats fetched successfully');
  } catch (err) {
    logger.error(`getStats error: ${err.message}`);
    return errorResponse(res, 'Failed to fetch stats', 500);
  }
};

// ── GET /logs ─────────────────────────────────────────────────────────────────
/**
 * Paginated ping logs. Filterable by apiId, status, date range.
 */
const getLogs = async (req, res) => {
  try {
    const { apiId, status, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (apiId) filter.apiId = apiId;
    if (status) filter.status = status;
    if (from || to) {
      filter.checkedAt = {};
      if (from) filter.checkedAt.$gte = new Date(from);
      if (to) filter.checkedAt.$lte = new Date(to);
    }

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(parseInt(limit), 200);
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `logs:${JSON.stringify({ filter, page: pageNum, limit: limitNum })}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return successResponse(res, JSON.parse(cached), 'Logs (cached)');

    const [logs, total] = await Promise.all([
      PingLog.find(filter)
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('apiId', 'name url'), // Include API name for readability
      PingLog.countDocuments(filter),
    ]);

    const payload = {
      logs,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    };

    await cacheSet(cacheKey, JSON.stringify(payload), CACHE_TTL);
    return successResponse(res, payload, 'Logs fetched successfully');
  } catch (err) {
    logger.error(`getLogs error: ${err.message}`);
    return errorResponse(res, 'Failed to fetch logs', 500);
  }
};

// ── GET /alerts ───────────────────────────────────────────────────────────────
/**
 * List alerts. Filter by resolved status.
 * PATCH /alerts/:id/resolve to mark as resolved.
 */
const getAlerts = async (req, res) => {
  try {
    const { resolved, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('apiId', 'name url currentStatus'),
      Alert.countDocuments(filter),
    ]);

    return successResponse(res, {
      alerts,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    logger.error(`getAlerts error: ${err.message}`);
    return errorResponse(res, 'Failed to fetch alerts', 500);
  }
};

// ── PATCH /alerts/:id/resolve ─────────────────────────────────────────────────
const resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) return errorResponse(res, 'Alert not found', 404);
    return successResponse(res, alert, 'Alert resolved');
  } catch (err) {
    return errorResponse(res, 'Failed to resolve alert', 500);
  }
};

module.exports = { getStats, getLogs, getAlerts, resolveAlert };
