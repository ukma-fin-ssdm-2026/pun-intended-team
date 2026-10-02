// Written with the help of Claude
import { z } from 'zod';

// Draft error format, to be agreed in #83 and described in docs/api/api-design.md.

export const ErrorCode = z
  .enum(['VALIDATION_ERROR', 'INVALID_JSON', 'NOT_FOUND', 'INTERNAL_ERROR'])
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
    details: z.array(ValidationIssue).optional().describe('Present only for validation errors'),
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
