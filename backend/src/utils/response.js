/**
 * Standardised API response helpers.
 *
 * Every endpoint should use these to ensure a consistent response envelope.
 */

/**
 * Send a success response.
 *
 * @param {import('fastify').FastifyReply} reply
 * @param {number} statusCode  HTTP status (default 200)
 * @param {*}      data        Response payload
 * @param {string} [message]   Optional human-readable message
 */
export function sendSuccess(reply, statusCode = 200, data = null, message) {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== null && data !== undefined) body.data = data;

  return reply.status(statusCode).send(body);
}

/**
 * Send an error response.
 *
 * @param {import('fastify').FastifyReply} reply
 * @param {number} statusCode  HTTP status (default 500)
 * @param {string} message     Human-readable error message
 * @param {*}      [errors]    Optional validation error details
 */
export function sendError(reply, statusCode = 500, message = 'Internal server error', errors) {
  const body = { success: false, message };
  if (errors) body.errors = errors;

  return reply.status(statusCode).send(body);
}
