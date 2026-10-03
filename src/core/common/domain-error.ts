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
