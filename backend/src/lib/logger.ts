/**
 * Structured logging (pino). Secrets never reach the log: known sensitive fields are redacted and
 * logged URLs are masked: `token` query parameters (realtime, email links) and the push token in the
 * path of `DELETE /me/devices/:token`.
 */
import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.newPassword',
  '*.refreshToken',
  '*.accessToken',
  '*.idToken',
  '*.googleIdToken',
  '*.token',
  '*.pushToken',
];

/** Masks secret query parameters (`?token=…`) and the push token of `/me/devices/:token` in a URL or path. */
export function redactUrl(url: string): string {
  return url
    .replace(/([?&](?:token|access_token|refreshToken)=)[^&#]*/gi, '$1[REDACTED]')
    .replace(/(\/me\/devices\/)[^/?#]+/i, '$1[REDACTED]');
}

export function createLogger(options: { level: LoggerOptions['level']; pretty?: boolean }): Logger {
  return pino({
    level: options.level ?? 'info',
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(options.pretty ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } } } : {}),
  });
}

/** Logger that drops everything (tests). */
export function createSilentLogger(): Logger {
  return pino({ level: 'silent' });
}
