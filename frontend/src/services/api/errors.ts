import type { ApiErrorBody, ApiErrorCode } from '@/types/api';
import { API_ERROR_CODES } from '@/types/api';

const RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'RATE_LIMITED',
  'SERVER_ERROR',
]);

/** Normalized error thrown by the API client for every failed request. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: Record<string, string[]> | undefined;
  /** From `Retry-After` on a 429: seconds to wait before trying again (`null` when not sent). */
  readonly retryAfterSeconds: number | null;

  constructor(status: number, body: ApiErrorBody, retryAfterSeconds: number | null = null) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** Transient failures that are safe to retry automatically. */
  get isRetryable(): boolean {
    return RETRYABLE_CODES.has(this.code);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * `Retry-After` in seconds: delay-seconds, or an HTTP date relative to `now`. `null` when absent or
 * unreadable.
 */
export function parseRetryAfter(value: string | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now) / 1000));
}

/** Parses an unknown response body into an `ApiErrorBody`. */
export function parseErrorBody(status: number, data: unknown): ApiErrorBody {
  if (data && typeof data === 'object') {
    const candidate = data as Partial<ApiErrorBody>;
    if (isApiErrorCode(candidate.code)) {
      return {
        code: candidate.code,
        message: typeof candidate.message === 'string' ? candidate.message : 'Request failed',
        fieldErrors: candidate.fieldErrors,
      };
    }
  }
  return { code: codeFromStatus(status), message: `Request failed with status ${status}` };
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 0) return 'NETWORK_ERROR';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408) return 'TIMEOUT';
  if (status === 409) return 'CONFLICT';
  if (status === 400 || status === 413 || status === 422) return 'VALIDATION_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

/** Converts anything thrown into an `ApiError` so the UI handles a single error type. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new ApiError(0, { code: 'TIMEOUT', message: error.message });
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new ApiError(0, { code: 'UNKNOWN', message });
}
