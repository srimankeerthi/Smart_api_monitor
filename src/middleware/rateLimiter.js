// src/middleware/rateLimiter.js
// express-rate-limit — protects all routes from abuse

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // default 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),              // default 100 req/window
  standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,    // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests — please slow down.',
  },
  // Skip health-check endpoint from rate limiting
  skip: (req) => req.path === '/health',
});

module.exports = limiter;
