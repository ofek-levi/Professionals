/** API error codes (copied from the app's `frontend/src/types/api/common.ts`). */
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

/** Codes the server answers with (the others are client-side only: network, timeout, unknown). */
export type ServerErrorCode = Exclude<ApiErrorCode, 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN'>;
