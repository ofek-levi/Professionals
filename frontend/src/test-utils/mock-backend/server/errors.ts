/**
 * Maps anything thrown by a handler to an HTTP-like transport response. `DomainError` is the mock
 * backend's HTTP error type (code + status + fieldErrors).
 */
import { isDomainError } from '@/features/shared/domain-error';
import type { TransportResponse } from '@/services/api/transport';
import type { ApiErrorBody } from '@/types/api';

export function errorToResponse(error: unknown): TransportResponse {
  if (isDomainError(error)) return { status: error.status, data: error.toBody() };
  // An unexpected error is a bug in the test double: the test sees the 500 and its message.
  const body: ApiErrorBody = {
    code: 'SERVER_ERROR',
    message: error instanceof Error ? `Internal test double error: ${error.message}` : 'Internal test double error',
  };
  return { status: 500, data: body };
}
