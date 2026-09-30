/**
 * `ApiError` is the only error type that reaches clients with its own code and message; anything
 * else becomes a 500 `SERVER_ERROR` without internals (see `middleware/error-handler.ts`).
 */
import type { ServerErrorCode } from '../shared/error-codes.js';

export type FieldErrors = Record<string, string[]>;

/** Default HTTP status per error code. */
const HTTP_STATUS_BY_CODE: Record<ServerErrorCode, number> = {
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_GOOGLE_TOKEN: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  EMAIL_ALREADY_REGISTERED: 409,
  INVALID_STATE_TRANSITION: 409,
  DUPLICATE_OFFER: 409,
  OFFER_EXPIRED: 409,
  REQUEST_NOT_ACCEPTING_OFFERS: 409,
  UNSUPPORTED_CATEGORY: 422,
  OUTSIDE_SERVICE_AREA: 422,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

type ConflictCode = Extract<
  ServerErrorCode,
  'CONFLICT' | 'DUPLICATE_OFFER' | 'OFFER_EXPIRED' | 'REQUEST_NOT_ACCEPTING_OFFERS' | 'EMAIL_ALREADY_REGISTERED'
>;
type ValidationCode = Extract<ServerErrorCode, 'VALIDATION_ERROR' | 'UNSUPPORTED_CATEGORY' | 'OUTSIDE_SERVICE_AREA'>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors | undefined;

  constructor(
    readonly code: ServerErrorCode,
    message: string,
    options: { status?: number; fieldErrors?: FieldErrors } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? HTTP_STATUS_BY_CODE[code];
    this.fieldErrors = options.fieldErrors && Object.keys(options.fieldErrors).length > 0 ? options.fieldErrors : undefined;
  }

  toBody(): { code: ServerErrorCode; message: string; fieldErrors?: FieldErrors } {
    return { code: this.code, message: this.message, ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}) };
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError('UNAUTHORIZED', message);
  }

  /** Same answer for an unknown email, a wrong password and a Google-only account. */
  static invalidCredentials(message = 'The email or password is incorrect'): ApiError {
    return new ApiError('INVALID_CREDENTIALS', message);
  }

  static invalidGoogleToken(message = 'The Google sign-in could not be verified'): ApiError {
    return new ApiError('INVALID_GOOGLE_TOKEN', message);
  }

  static forbidden(message = 'You are not allowed to perform this action'): ApiError {
    return new ApiError('FORBIDDEN', message);
  }

  static notFound(entity: string): ApiError {
    return new ApiError('NOT_FOUND', `${entity} was not found`);
  }

  static conflict(message: string, code: ConflictCode = 'CONFLICT', fieldErrors?: FieldErrors): ApiError {
    return new ApiError(code, message, { fieldErrors });
  }

  static invalidTransition(entity: string, from: string, to: string): ApiError {
    return new ApiError('INVALID_STATE_TRANSITION', `Cannot move ${entity} from "${from}" to "${to}"`);
  }

  /** Field messages are `validation:<key>` i18n keys (see `shared/validation-messages.ts`). */
  static validation(fieldErrors: FieldErrors, message = 'The request payload is invalid', code: ValidationCode = 'VALIDATION_ERROR'): ApiError {
    return new ApiError(code, message, { fieldErrors });
  }

  static rateLimited(message = 'Too many requests, please try again later'): ApiError {
    return new ApiError('RATE_LIMITED', message);
  }

  /** A provider is not configured or unreachable (503 with the generic `SERVER_ERROR` code). */
  static unavailable(message: string): ApiError {
    return new ApiError('SERVER_ERROR', message, { status: 503 });
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** MongoDB duplicate-key error: a unique index rejected a (usually concurrent) write. */
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
