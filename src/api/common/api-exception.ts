// Written with the help of Claude
import type { ErrorCode, ValidationIssue } from './schemas/errors.js';

const errorStatus: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** Thrown anywhere in the API; ApiExceptionFilter turns it into an ErrorResponse. */
export class ApiException extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ValidationIssue[],
  ) {
    super(message);
    this.status = errorStatus[code];
  }
}
