/** Maps anything thrown by a handler to an HTTP-like transport response. */
import { isDomainError } from '@/features/shared/domain-error';
import type { TransportResponse } from '@/services/api/transport';
import type { ApiErrorBody } from '@/types/api';

/** `DomainError` is the mock backend's HTTP error type (code + status + fieldErrors). */
export { DomainError as MockHttpError, isDomainError as isMockHttpError } from '@/features/shared/domain-error';

export function errorToResponse(error: unknown): TransportResponse {
  if (isDomainError(error)) return { status: error.status, data: error.toBody() };
  // An unexpected error is a bug in the mock backend – surface it to developers.
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.NODE_ENV !== 'test') {
    console.error('[mock-server] Unhandled error', error);
  }
  const body: ApiErrorBody = {
    code: 'SERVER_ERROR',
    message: error instanceof Error ? `Internal mock server error: ${error.message}` : 'Internal mock server error',
  };
  return { status: 500, data: body };
}
