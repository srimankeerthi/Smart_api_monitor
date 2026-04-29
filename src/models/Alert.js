// src/models/Alert.js
// Stores fired alerts — one per failure-streak breach

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    apiId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonitoredApi',
      required: true,
      index: true,
    },

    // Snapshot of the URL so the alert is self-contained
    url: { type: String, required: true },

    // Human-friendly API name at the time the alert fired
    apiName: { type: String, required: true },

    // How many consecutive failures triggered this alert
    consecutiveFailures: { type: Number, required: true },

    // The error message from the most recent failure
    lastError: { type: String, default: null },

    // Alert severity
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      default: 'warning',
    },

    // Whether an operator has acknowledged / resolved this alert
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },

    // Placeholder for notification delivery status
    notificationSent: { type: Boolean, default: false },
    notificationChannel: {
      type: String,
      enum: ['email', 'slack', 'webhook', 'console'],
      default: 'console',
    },
  },
  { timestamps: true }
);

// Index for fetching unresolved alerts quickly
alertSchema.index({ resolved: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
