// Written with the help of Claude
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DomainError } from '../../core/common/domain-error.ts';
import { ApiException } from './api-exception.ts';
import type { ErrorCode, ErrorResponse } from './schemas/errors.ts';

// Nest and Nest packages throw HttpException with a status but no code,
// e.g. the router (404), @nestjs/passport (401) or @nestjs/throttler (429).
// Their own messages ("Cannot GET /path") are replaced with ours.
const errorByStatus: Partial<Record<number, { code: ErrorCode; message: string }>> = {
  [HttpStatus.BAD_REQUEST]: { code: 'VALIDATION_ERROR', message: 'The request is invalid' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHENTICATED', message: 'A valid access token is required' },
  // The API never answers 403: never reveal that the resource exists (api-design.md, No 403).
  [HttpStatus.FORBIDDEN]: { code: 'NOT_FOUND', message: 'Not found' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Not found' },
  [HttpStatus.CONFLICT]: { code: 'CONFLICT', message: 'The request conflicts with the current state' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large' },
  [HttpStatus.TOO_MANY_REQUESTS]: { code: 'RATE_LIMITED', message: 'Too many requests' },
};

// The only place that builds error bodies, so every error has the ErrorResponse shape.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, code, message, details } = toApiException(exception) ?? this.unexpected(exception);
    const body: ErrorResponse = { error: { code, message, details } };
    this.adapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), body, status);
  }

  private unexpected(exception: unknown): ApiException {
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error(exception);
    }
    return new ApiException('INTERNAL_ERROR', 'Something went wrong');
  }
}

/** The ApiException an expected error stands for; undefined for anything unexpected. */
function toApiException(exception: unknown): ApiException | undefined {
  if (exception instanceof ApiException) {
    return exception;
  }
  if (exception instanceof DomainError) {
    const { code, message, field } = exception;
    return new ApiException(code, message, field ? [{ location: 'body', field, message }] : undefined);
  }
  if (exception instanceof HttpException) {
    const error = errorByStatus[exception.getStatus()];
    if (error) {
      return new ApiException(error.code, error.message);
    }
  }
  return undefined;
}
