/**
 * One log line per request (pino-http) without secrets: no headers, the URL masked by `redactUrl`
 * (tokens, address searches, coordinates).
 * Levels: 5xx error, 503 (a provider is not configured or unreachable) and 429 warn, other 4xx
 * info (expired tokens and validation errors are normal traffic, not operator alerts).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { pinoHttp } from 'pino-http';

import { redactUrl, type Logger } from '../lib/logger.js';

const QUIET_PATHS = new Set(['/health', '/ready']);

export function httpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    // `requestId()` ran first and set `req.id`.
    genReqId: (req: IncomingMessage) => req.id,
    autoLogging: { ignore: (req: IncomingMessage) => QUIET_PATHS.has(req.url ?? '') },
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) => {
      if (res.statusCode === 503 || res.statusCode === 429) return 'warn';
      if (error || res.statusCode >= 500) return 'error';
      return 'info';
    },
    // The error handler logs unhandled errors with their stack once; the request line keeps a
    // summary (pino-http would otherwise attach a synthetic "failed with status code" error).
    customErrorObject: (_req: IncomingMessage, _res: ServerResponse, error: Error, value: Record<string, unknown>) => {
      const { err: _stack, ...line } = value;
      return { ...line, error: { name: error.name, message: error.message } };
    },
    serializers: {
      req: (req: IncomingMessage) => ({ id: req.id, method: req.method, url: redactUrl(req.url ?? '') }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
    },
  });
}
