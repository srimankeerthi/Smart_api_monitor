// src/middleware/requestLogger.js
// Morgan HTTP request logger piped into Winston

const morgan = require('morgan');
const logger = require('../utils/logger');

// Pipe Morgan tokens into Winston's info level
const stream = {
  write: (message) => logger.info(message.trim()),
};

// Compact format: METHOD /path STATUS ms — ip
const format =
  ':method :url :status :res[content-length] bytes — :response-time ms — :remote-addr';

const requestLogger = morgan(format, { stream });

module.exports = requestLogger;
