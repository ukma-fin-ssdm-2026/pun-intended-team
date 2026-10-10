// Written with the help of Claude
import { z } from 'zod';
import { domainErrorCodes } from '../../../core/common/domain-error.js';

export const ErrorCode = z
  .enum([
    // Raised by the API layer itself
    'VALIDATION_ERROR',
    'UNAUTHENTICATED',
    'PAYLOAD_TOO_LARGE',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    // Raised by the business logic in core
    ...domainErrorCodes,
  ])
  .meta({ id: 'ErrorCode', description: 'Machine-readable code; clients branch on it, not on the message' });

export const ValidationLocation = z
  .enum(['params', 'query', 'body'])
  .meta({ id: 'ValidationLocation', description: 'Part of the request the invalid field is in' });

const ValidationIssueFields = z.object({
  location: ValidationLocation,
  field: z.string(),
  message: z.string(),
});

export const ValidationIssue = ValidationIssueFields.meta({
  id: 'ValidationIssue',
  description: 'One invalid field of the request',
});

const ErrorResponseFields = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z
      .array(ValidationIssue)
      .optional()
      .describe('Every invalid field, for validation errors that can name them'),
  }),
});

export const errorExample: ErrorResponse = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'The request is invalid',
    details: [{ location: 'params', field: 'id', message: 'Invalid UUID' }],
  },
};

export const ErrorResponse = ErrorResponseFields.meta({
  id: 'ErrorResponse',
  description: 'The body of every error response',
  example: errorExample,
});

export type ErrorCode = z.infer<typeof ErrorCode>;
export type ValidationIssue = z.infer<typeof ValidationIssueFields>;
export type ErrorResponse = z.infer<typeof ErrorResponseFields>;
