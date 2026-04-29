// src/utils/logger.js
// Centralised Winston logger — writes to console + rotating log files

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure log directory exists
const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = format;

// Custom line format: [2024-06-01 12:00:00] INFO  Some message
const lineFormat = printf(({ level, message, timestamp, stack }) => {
  return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${stack || message}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // Capture full stack traces
    lineFormat
  ),
  transports: [
    // Console output with colours (disabled in test environment)
    new transports.Console({
      silent: process.env.NODE_ENV === 'test',
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), lineFormat),
    }),
    // All logs → combined.log
    new transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
    // Error logs → error.log
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

module.exports = logger;
