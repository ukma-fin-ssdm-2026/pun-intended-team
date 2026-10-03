// Written with the help of Claude
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DomainError } from '../../core/common/domain-error.js';
import { ApiException } from './api-exception.js';
import type { ErrorCode, ErrorResponse } from './schemas/errors.js';

// Nest and Nest packages throw HttpException with a status but no code,
// e.g. the router (404), @nestjs/passport (401) or @nestjs/throttler (429).
const codeByStatus: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
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
    return new ApiException(exception.code, exception.message);
  }
  if (exception instanceof HttpException) {
    if (exception.getStatus() === HttpStatus.FORBIDDEN) {
      return new ApiException('NOT_FOUND', 'Not found');
    }
    const code = codeByStatus[exception.getStatus()];
    if (code) {
      return new ApiException(code, exception.message);
    }
  }
  return undefined;
}
