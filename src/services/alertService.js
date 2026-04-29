// src/services/alertService.js
// Encapsulates all alert-creation and notification logic
// Easily extensible: add email/Slack/webhook channels below

const Alert = require('../models/Alert');
const logger = require('../utils/logger');

const THRESHOLD = parseInt(process.env.ALERT_FAILURE_THRESHOLD || '3', 10);

/**
 * Called after every failed ping.
 * Fires an alert when consecutiveFailures reaches the configured threshold.
 *
 * @param {Object} api         MonitoredApi document
 * @param {string} errorMessage  Latest error text
 */
const checkAndFireAlert = async (api, errorMessage) => {
  // Only fire at exactly the threshold (not on every subsequent failure)
  // to avoid duplicate alerts for a single outage.
  if (api.consecutiveFailures !== THRESHOLD) return;

  try {
    const alert = await Alert.create({
      apiId: api._id,
      url: api.url,
      apiName: api.name,
      consecutiveFailures: api.consecutiveFailures,
      lastError: errorMessage,
      severity: api.consecutiveFailures >= THRESHOLD * 2 ? 'critical' : 'warning',
      notificationChannel: 'console', // swap for 'email' once SMTP is wired up
    });

    logger.warn(
      `🚨 ALERT FIRED [${alert.severity.toUpperCase()}] — ` +
        `"${api.name}" (${api.url}) failed ${api.consecutiveFailures} times in a row. ` +
        `Error: ${errorMessage}`
    );

    // ── Notification dispatch ─────────────────────────────────────────────
    // Each channel is a separate async call so one failure doesn't block others.
    await Promise.allSettled([
      dispatchConsole(alert),
      // dispatchEmail(alert),   // ← uncomment once SMTP is configured
      // dispatchSlack(alert),   // ← uncomment once SLACK_WEBHOOK_URL is set
    ]);
  } catch (err) {
    logger.error(`Failed to create alert for API ${api._id}: ${err.message}`);
  }
};

// ── Notification channels ─────────────────────────────────────────────────────

/**
 * Console channel — always enabled, zero dependencies.
 */
const dispatchConsole = async (alert) => {
  console.error(
    `\n${'═'.repeat(60)}\n` +
      `  ALERT  ${alert.severity.toUpperCase()}\n` +
      `  API   : ${alert.apiName}\n` +
      `  URL   : ${alert.url}\n` +
      `  Fails : ${alert.consecutiveFailures}\n` +
      `  Error : ${alert.lastError}\n` +
      `  Time  : ${alert.createdAt || new Date().toISOString()}\n` +
      `${'═'.repeat(60)}\n`
  );
  await Alert.findByIdAndUpdate(alert._id, { notificationSent: true });
};

/**
 * Email channel — structure ready, wire up nodemailer/SendGrid here.
 * Uncomment and fill in when SMTP credentials are available.
 */
// const dispatchEmail = async (alert) => {
//   const nodemailer = require('nodemailer');
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: parseInt(process.env.SMTP_PORT || '587', 10),
//     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
//   });
//   await transporter.sendMail({
//     from: process.env.ALERT_EMAIL_FROM,
//     to: process.env.ALERT_EMAIL_TO,
//     subject: `[${alert.severity.toUpperCase()}] API Down: ${alert.apiName}`,
//     html: `<h2>API Monitor Alert</h2>
//            <p><strong>API:</strong> ${alert.apiName}</p>
//            <p><strong>URL:</strong> ${alert.url}</p>
//            <p><strong>Consecutive Failures:</strong> ${alert.consecutiveFailures}</p>
//            <p><strong>Last Error:</strong> ${alert.lastError}</p>`,
//   });
//   await Alert.findByIdAndUpdate(alert._id, { notificationSent: true });
// };

/**
 * Slack channel — post to an Incoming Webhook URL.
 */
// const dispatchSlack = async (alert) => {
//   const axios = require('axios');
//   await axios.post(process.env.SLACK_WEBHOOK_URL, {
//     text: `*[${alert.severity.toUpperCase()}]* API *${alert.apiName}* is DOWN\n` +
//           `URL: ${alert.url}\nError: ${alert.lastError}`,
//   });
//   await Alert.findByIdAndUpdate(alert._id, { notificationSent: true });
// };

module.exports = { checkAndFireAlert };
