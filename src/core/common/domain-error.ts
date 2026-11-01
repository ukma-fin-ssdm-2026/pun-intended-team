// Written with the help of Claude
// Errors the business logic can raise. Core knows nothing about HTTP:
// the API layer decides which status each code becomes.
export const domainErrorCodes = [
  'NOT_FOUND',
  'CONFLICT',
  // One code per business rule
  'REFERENCE_NOT_FOUND',
  'ORGANIZATION_NOT_VERIFIED',
  'EVENT_CANCELLED',
  'EVENT_ENDS_BEFORE_START',
  'LISTING_DATE_IN_PAST',
  'USERNAME_TAKEN',
  'PROFILE_EXISTS',
  'CONTACT_REQUIRED',
  'INVALID_CREDENTIALS',
  'WRONG_PASSWORD',
  'INVALID_GOOGLE_TOKEN',
  'GOOGLE_ACCOUNT_TAKEN',
  'GOOGLE_ALREADY_LINKED',
  'INVALID_CODE',
  'PHONE_CODES_UNAVAILABLE',
  'INVALID_REFRESH_TOKEN',
  'UNDERAGE',
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}
