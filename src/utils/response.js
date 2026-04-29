// src/utils/response.js
// Standardised JSON response shapes so every endpoint looks the same

/**
 * Send a success response.
 * @param {Response} res   Express response object
 * @param {*}        data  Payload to return
 * @param {string}   message  Human-readable message
 * @param {number}   statusCode  HTTP status (default 200)
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send an error response.
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const body = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

module.exports = { successResponse, errorResponse };
