/** Generic API envelope types shared by all endpoints. */

export interface PaginationParams {
  /** Opaque cursor returned by the previous page. */
  cursor?: string | null;
  limit?: number;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

export const API_ERROR_CODES = [
  'NETWORK_ERROR',
  'TIMEOUT',
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'INVALID_GOOGLE_TOKEN',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'CONFLICT',
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_STATE_TRANSITION',
  'DUPLICATE_OFFER',
  'OFFER_EXPIRED',
  'REQUEST_NOT_ACCEPTING_OFFERS',
  'UNSUPPORTED_CATEGORY',
  'OUTSIDE_SERVICE_AREA',
  'RATE_LIMITED',
  'SERVER_ERROR',
  'UNKNOWN',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** JSON body returned by the backend for any non-2xx response. */
export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  /** Field-level validation errors keyed by field path (e.g. `location.addressLine`). */
  fieldErrors?: Record<string, string[]>;
}

export interface SuccessResponse {
  success: true;
}
