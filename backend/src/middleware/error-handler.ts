/**
 * Last middleware: every error becomes `{ code, message, fieldErrors? }`. `ApiError`s keep their
 * code/status; known framework errors are mapped; anything else is a logged 500 without details.
 */
import type { NextFunction, Request, Response } from 'express';

import { ApiError, isApiError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';
import { vm } from '../shared/validation-messages.js';

interface HttpLikeError {
  type?: string;
  status?: number;
  code?: number | string;
}

function toApiError(error: unknown): ApiError | null {
  if (isApiError(error)) return error;
  const httpError = (error ?? {}) as HttpLikeError;
  // body-parser: malformed JSON / body over the limit.
  if (httpError.type === 'entity.parse.failed') return ApiError.validation({ root: [vm('invalid')] }, 'Malformed JSON body');
  if (httpError.type === 'entity.too.large') {
    return new ApiError('VALIDATION_ERROR', 'The request body is too large', { status: 413, fieldErrors: { root: [vm('invalid')] } });
  }
  // A unique index caught a race the service did not pre-check.
  if (httpError.code === 11000) return ApiError.conflict('This change conflicts with the current state');
  return null;
}

export function errorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const apiError = toApiError(error);
    if (apiError?.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(Math.max(1, Math.ceil(apiError.retryAfterSeconds))));
    if (apiError && apiError.status < 500) {
      res.status(apiError.status).json(apiError.toBody());
      return;
    }
    if (apiError) {
      // Summarised on the request's log line (see http-logger).
      res.err = apiError;
      res.status(apiError.status).json(apiError.toBody());
      return;
    }
    logger.error({ err: error, reqId: req.id, method: req.method, path: req.path }, 'unhandled error');
    res.err = error instanceof Error ? error : new Error('Non-error value thrown');
    if (res.headersSent) return;
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
  };
}

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError('NOT_FOUND', `Route ${req.method} ${req.path} was not found`));
}
