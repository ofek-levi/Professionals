/**
 * Error raised by business rules (state machines, matching, validation) and by the mock backend.
 * It carries the API error `code` and HTTP `status`, so the mock server can serialize it directly
 * into an `ApiErrorBody` (it is the backend's HTTP error type).
 */
import type { ApiErrorBody, ApiErrorCode } from '@/types/api';

/** Default HTTP status for every API error code. */
const ERROR_STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  NETWORK_ERROR: 0,
  TIMEOUT: 408,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  INVALID_STATE_TRANSITION: 409,
  DUPLICATE_OFFER: 409,
  OFFER_EXPIRED: 409,
  REQUEST_NOT_ACCEPTING_OFFERS: 409,
  UNSUPPORTED_CATEGORY: 422,
  OUTSIDE_SERVICE_AREA: 422,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
  UNKNOWN: 500,
};

type FieldErrors = Record<string, string[]>;

type ConflictCode = Extract<
  ApiErrorCode,
  'CONFLICT' | 'DUPLICATE_OFFER' | 'OFFER_EXPIRED' | 'REQUEST_NOT_ACCEPTING_OFFERS'
>;
type ValidationCode = Extract<ApiErrorCode, 'VALIDATION_ERROR' | 'UNSUPPORTED_CATEGORY' | 'OUTSIDE_SERVICE_AREA'>;

interface DomainErrorOptions {
  status?: number;
  fieldErrors?: FieldErrors;
}

export class DomainError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;

  constructor(code: ApiErrorCode, message: string, options: DomainErrorOptions = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = options.status ?? ERROR_STATUS_BY_CODE[code];
    if (options.fieldErrors && Object.keys(options.fieldErrors).length > 0) {
      this.fieldErrors = options.fieldErrors;
    }
  }

  /** JSON body sent to the client. */
  toBody(): ApiErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
    };
  }

  static unauthorized(message = 'Authentication required'): DomainError {
    return new DomainError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'You are not allowed to perform this action'): DomainError {
    return new DomainError('FORBIDDEN', message);
  }

  static notFound(entity: string, id?: string): DomainError {
    return new DomainError('NOT_FOUND', id ? `${entity} "${id}" was not found` : `${entity} was not found`);
  }

  static conflict(message: string, code: ConflictCode = 'CONFLICT'): DomainError {
    return new DomainError(code, message);
  }

  static invalidTransition(entity: string, from: string, to: string): DomainError {
    return new DomainError('INVALID_STATE_TRANSITION', `Cannot move ${entity} from "${from}" to "${to}"`);
  }

  /**
   * 422 with field-level messages. Field messages are i18n keys of the `validation` namespace
   * (e.g. `validation:request.descriptionTooShort`).
   */
  static validation(fieldErrors: FieldErrors, message = 'The request payload is invalid', code: ValidationCode = 'VALIDATION_ERROR'): DomainError {
    return new DomainError(code, message, { fieldErrors });
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
