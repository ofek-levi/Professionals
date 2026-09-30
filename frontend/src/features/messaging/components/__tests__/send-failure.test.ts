import { ApiError } from '@/services/api/errors';

import { canRetrySend, sendFailureReason } from '../send-failure';

const apiError = (status: number, code: ConstructorParameters<typeof ApiError>[1]['code']) => new ApiError(status, { code, message: 'x' });

describe('sendFailureReason', () => {
  it('tells a closed chat and a refused message (never retried) from a lost connection or a rate limit', () => {
    expect(sendFailureReason(apiError(409, 'CONFLICT'))).toBe('closed');
    expect(sendFailureReason(apiError(422, 'VALIDATION_ERROR'))).toBe('rejected');
    expect(sendFailureReason(apiError(403, 'FORBIDDEN'))).toBe('rejected');
    expect(sendFailureReason(apiError(429, 'RATE_LIMITED'))).toBe('rateLimited');
    expect(sendFailureReason(apiError(0, 'NETWORK_ERROR'))).toBe('offline');
    expect(sendFailureReason(apiError(408, 'TIMEOUT'))).toBe('offline');
    expect(sendFailureReason(apiError(503, 'SERVER_ERROR'))).toBe('offline');
    expect(sendFailureReason(new TypeError('Network request failed'))).toBe('offline');
    expect(['offline', 'rateLimited', 'closed', 'rejected'].map((reason) => canRetrySend(reason as never))).toEqual([true, true, false, false]);
  });
});
