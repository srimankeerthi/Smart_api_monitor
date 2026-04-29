// src/controllers/apiController.js
// CRUD for MonitoredApi + manual trigger

const MonitoredApi = require('../models/MonitoredApi');
const { pingApi } = require('../services/pingService');
const { successResponse, errorResponse } = require('../utils/response');
const { cacheDel } = require('../config/redis');
const logger = require('../utils/logger');

// ── Register a new API ────────────────────────────────────────────────────────
const registerApi = async (req, res) => {
  try {
    const { name, url, method, headers, body, expectedResponseTimeMs, intervalMinutes } = req.body;

    const api = await MonitoredApi.create({
      name,
      url,
      method,
      headers,
      body,
      expectedResponseTimeMs,
      intervalMinutes,
    });

    // Bust stats cache — a new API changes uptime calculations
    await cacheDel('stats:global');

    logger.info(`API registered: ${api.name} (${api._id})`);
    return successResponse(res, api, 'API registered successfully', 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return errorResponse(res, 'Validation failed', 422, messages);
    }
    logger.error(`registerApi error: ${err.message}`);
    return errorResponse(res, 'Failed to register API', 500);
  }
};

// ── List all registered APIs ──────────────────────────────────────────────────
const listApis = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [apis, total] = await Promise.all([
      MonitoredApi.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      MonitoredApi.countDocuments(filter),
    ]);

    return successResponse(res, {
      apis,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(`listApis error: ${err.message}`);
    return errorResponse(res, 'Failed to fetch APIs', 500);
  }
};

// ── Get a single API ──────────────────────────────────────────────────────────
const getApi = async (req, res) => {
  try {
    const api = await MonitoredApi.findById(req.params.id);
    if (!api) return errorResponse(res, 'API not found', 404);
    return successResponse(res, api);
  } catch (err) {
    if (err.name === 'CastError') return errorResponse(res, 'Invalid API ID', 400);
    return errorResponse(res, 'Failed to fetch API', 500);
  }
};

// ── Update a registered API ───────────────────────────────────────────────────
const updateApi = async (req, res) => {
  try {
    const allowed = ['name', 'url', 'method', 'headers', 'body', 'expectedResponseTimeMs', 'intervalMinutes', 'isActive'];
    const updates = {};
    allowed.forEach((key) => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

    const api = await MonitoredApi.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!api) return errorResponse(res, 'API not found', 404);

    await cacheDel('stats:global');
    return successResponse(res, api, 'API updated successfully');
  } catch (err) {
    if (err.name === 'ValidationError') {
      return errorResponse(res, 'Validation failed', 422, Object.values(err.errors).map((e) => e.message));
    }
    return errorResponse(res, 'Failed to update API', 500);
  }
};

// ── Delete a registered API ───────────────────────────────────────────────────
const deleteApi = async (req, res) => {
  try {
    const api = await MonitoredApi.findByIdAndDelete(req.params.id);
    if (!api) return errorResponse(res, 'API not found', 404);

    await cacheDel('stats:global');
    logger.info(`API deleted: ${api.name} (${api._id})`);
    return successResponse(res, null, 'API deleted successfully');
  } catch (err) {
    return errorResponse(res, 'Failed to delete API', 500);
  }
};

// ── Manually trigger a ping ───────────────────────────────────────────────────
const triggerPing = async (req, res) => {
  try {
    const api = await MonitoredApi.findById(req.params.id);
    if (!api) return errorResponse(res, 'API not found', 404);
    if (!api.isActive) return errorResponse(res, 'API is inactive', 400);

    const log = await pingApi(api);
    return successResponse(res, log, 'Ping completed');
  } catch (err) {
    logger.error(`triggerPing error: ${err.message}`);
    return errorResponse(res, 'Ping failed', 500);
  }
};

module.exports = { registerApi, listApis, getApi, updateApi, deleteApi, triggerPing };
