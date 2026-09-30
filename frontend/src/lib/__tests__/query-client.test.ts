import { ApiError } from '@/services/api/errors';

import { createQueryClient, MAX_QUERY_RETRIES, retryDelay, shouldRetryQuery } from '../query-client';

const error = (code: ConstructorParameters<typeof ApiError>[1]['code'], status = 0) => new ApiError(status, { code, message: code });

describe('query client defaults', () => {
  it('retries transient errors at most twice', () => {
    expect(shouldRetryQuery(0, error('NETWORK_ERROR'))).toBe(true);
    expect(shouldRetryQuery(1, error('SERVER_ERROR', 500))).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, error('NETWORK_ERROR'))).toBe(false);
  });

  it('never retries client errors', () => {
    expect(shouldRetryQuery(0, error('NOT_FOUND', 404))).toBe(false);
    expect(shouldRetryQuery(0, error('VALIDATION_ERROR', 422))).toBe(false);
    expect(shouldRetryQuery(0, error('UNAUTHORIZED', 401))).toBe(false);
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(false);
  });

  it('retries a rate-limited query only after a short Retry-After, and waits that long', () => {
    const limited = (retryAfter: number | null) => new ApiError(429, { code: 'RATE_LIMITED', message: 'slow down' }, retryAfter);
    expect(shouldRetryQuery(0, limited(null))).toBe(false);
    expect(shouldRetryQuery(0, limited(900))).toBe(false);
    expect(shouldRetryQuery(0, limited(3))).toBe(true);
    expect(retryDelay(0, limited(3))).toBe(3000);
    expect(retryDelay(0, limited(0))).toBe(1000);
    expect(retryDelay(1, error('NETWORK_ERROR'))).toBe(1600);
  });

  it('backs off exponentially with a cap', () => {
    expect(retryDelay(0)).toBe(800);
    expect(retryDelay(1)).toBe(1600);
    expect(retryDelay(10)).toBe(8000);
  });

  it('configures stale/gc times and disables mutation retries', () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.gcTime).toBe(600_000);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
