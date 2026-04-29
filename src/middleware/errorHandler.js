// src/middleware/errorHandler.js
// Global Express error handler — must be the LAST app.use() call

const logger = require('../utils/logger');

/**
 * Catches any error thrown from route handlers (via next(err) or throw in async).
 * Returns a consistent JSON error shape.
 */
const errorHandler = (err, req, res, next) => {
  // Avoid double-responding
  if (res.headersSent) return next(err);

  logger.error(`${req.method} ${req.originalUrl} — ${err.stack || err.message}`);

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ success: false, message: 'Invalid resource ID' });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ success: false, message: 'Validation failed', errors: messages });
  }

  // JWT / auth errors (ready for when auth is added)
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ success: false, message: 'Unauthorised' });
  }

  // Default 500
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * 404 handler — mount BEFORE errorHandler but AFTER all routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = { errorHandler, notFoundHandler };
