// Written with the help of Claude
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { ErrorCode, ErrorResponse, ValidationIssue } from '../schemas/errors.js';

// The only place that builds error bodies, so every error has the ErrorResponse shape.
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: ValidationIssue[],
): void {
  const body: ErrorResponse = { error: { code, message, details } };
  res.status(status).json(body);
}

/** Requests that matched no route. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Route not found');
};

/** Errors thrown anywhere in a handler, including a body that is not valid JSON. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    sendError(res, 400, 'INVALID_JSON', 'The request body is not valid JSON');
    return;
  }
  console.error(err);
  sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};
