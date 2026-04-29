// src/models/PingLog.js
// Records every ping result — the raw audit trail

const mongoose = require('mongoose');

const pingLogSchema = new mongoose.Schema(
  {
    // Reference to the monitored API
    apiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonitoredApi',
      required: true,
      index: true,
    },

    // Snapshot of the URL at ping time (in case the API config changes later)
    url: { type: String, required: true },

    // HTTP status code returned (null on network error)
    statusCode: { type: Number, default: null },

    // Round-trip time in milliseconds
    responseTimeMs: { type: Number, default: null },

    // Whether the ping was considered successful
    // Success = HTTP 2xx AND responseTime ≤ expectedResponseTimeMs
    success: { type: Boolean, required: true },

    // Human-readable outcome category
    status: {
      type: String,
      enum: ['up', 'down', 'timeout', 'degraded'],
      required: true,
    },

    // Error message when success=false
    errorMessage: { type: String, default: null },

    // When this ping was initiated
    checkedAt: { type: Date, default: Date.now, index: true },
  },
  {
    // Use capped collection or TTL index in production to auto-prune old logs
    timestamps: false,
  }
);

// TTL index: automatically delete logs older than 30 days
// Change 2592000 to your desired retention period in seconds
pingLogSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 2592000 });

// Compound index for dashboard queries (filter by API, sort by time)
pingLogSchema.index({ apiId: 1, checkedAt: -1 });

module.exports = mongoose.model('PingLog', pingLogSchema);
