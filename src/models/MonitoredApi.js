// src/models/MonitoredApi.js
// Represents an API endpoint registered by the user for monitoring

const mongoose = require('mongoose');

const monitoredApiSchema = new mongoose.Schema(
  {
    // Human-friendly name for this endpoint
    name: {
      type: String,
      required: [true, 'API name is required'],
      trim: true,
      maxlength: [100, 'Name must be ≤ 100 characters'],
    },

    // The URL to ping
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true,
      match: [/^https?:\/\/.+/, 'URL must start with http:// or https://'],
    },

    // HTTP method to use
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
      default: 'GET',
      uppercase: true,
    },

    // Optional request headers (e.g. Authorization, Content-Type)
    headers: {
      type: Map,
      of: String,
      default: {},
    },

    // Optional request body (for POST/PUT)
    body: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Expected maximum response time in milliseconds
    expectedResponseTimeMs: {
      type: Number,
      default: 2000,
      min: [100, 'Expected response time must be at least 100 ms'],
    },

    // How often to ping this API (in minutes, minimum 1)
    intervalMinutes: {
      type: Number,
      default: 5,
      min: [1, 'Interval must be at least 1 minute'],
    },

    // Whether monitoring is active for this endpoint
    isActive: {
      type: Boolean,
      default: true,
    },

    // Timestamp of the last ping attempt
    lastCheckedAt: {
      type: Date,
      default: null,
    },

    // Consecutive failure count — reset to 0 on success
    consecutiveFailures: {
      type: Number,
      default: 0,
    },

    // Latest resolved status
    currentStatus: {
      type: String,
      enum: ['unknown', 'up', 'down', 'degraded'],
      default: 'unknown',
    },
  },
  {
    timestamps: true, // Adds createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: next scheduled ping time
monitoredApiSchema.virtual('nextCheckAt').get(function () {
  if (!this.lastCheckedAt) return null;
  const next = new Date(this.lastCheckedAt);
  next.setMinutes(next.getMinutes() + this.intervalMinutes);
  return next;
});

// Index for fast queries during scheduler loop
monitoredApiSchema.index({ isActive: 1, lastCheckedAt: 1 });

module.exports = mongoose.model('MonitoredApi', monitoredApiSchema);
