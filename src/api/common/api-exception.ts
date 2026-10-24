// Written with the help of Claude
import type { ErrorCode, ValidationIssue } from './schemas/errors.ts';

const errorStatus: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  REFERENCE_NOT_FOUND: 422,
  ORGANIZATION_NOT_VERIFIED: 422,
  EVENT_CANCELLED: 422,
  EVENT_ENDS_BEFORE_START: 422,
  LISTING_DATE_IN_PAST: 422,
  USERNAME_TAKEN: 409,
  PROFILE_EXISTS: 409,
  INVALID_CODE: 422,
  WRONG_PASSWORD: 422,
  INVALID_GOOGLE_TOKEN: 422,
  GOOGLE_ACCOUNT_TAKEN: 409,
  GOOGLE_ALREADY_LINKED: 409,
  UNDERAGE: 422,
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
