// Written with the help of Claude
import { ExpressAdapter } from '@nestjs/platform-express';
import { ApiException } from './api-exception.ts';

/**
 * Turns errors raised by Express itself, before any handler runs, into
 * ApiException. Nest calls mapException with the original error, so the
 * body parser's `type` is still there to tell the cases apart.
 */
export class ApiExpressAdapter extends ExpressAdapter {
  override mapException(error: unknown): unknown {
    switch (bodyParserErrorType(error)) {
      case 'entity.parse.failed':
        return new ApiException('VALIDATION_ERROR', 'The request body is not valid JSON');
      case 'entity.too.large':
        return new ApiException('PAYLOAD_TOO_LARGE', 'The request body is too large');
    }
    // Express throws URIError for a path with broken percent-encoding, e.g. /events/%FF.
    if (error instanceof URIError) {
      return new ApiException('VALIDATION_ERROR', 'The request URL is malformed');
    }
    return super.mapException(error);
  }
}

function bodyParserErrorType(error: unknown): unknown {
  return (error as { type?: unknown } | null)?.type;
}
