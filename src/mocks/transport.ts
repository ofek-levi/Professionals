/**
 * Transport that sends API requests to the in-app mock server instead of the network, with
 * simulated latency, cancellation (AbortSignal) and transient network failures.
 */
import type { Transport, TransportRequest, TransportResponse } from '@/services/api/transport';
import type { ApiErrorBody } from '@/types/api';

import type { MockServer } from './server/types';

export interface MockTransportOptions {
  minLatencyMs: number;
  maxLatencyMs: number;
  /** Probability (0–1) that a request fails with a simulated network error. */
  failureRate: number;
  /** Random source (injectable for deterministic tests). */
  random?: () => number;
}

export interface MockTransportControls {
  setFailureRate(rate: number): void;
  getFailureRate(): number;
}

const clampRate = (rate: number) => (Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0);

function abortError(): Error {
  const error = new Error('The request was aborted');
  error.name = 'AbortError';
  return error;
}

/** Resolves after `ms`, or rejects with an `AbortError` when the signal fires first. */
function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** JSON round trip: the server never shares object references with the caller. */
function serialize(request: TransportRequest): TransportRequest {
  return {
    ...request,
    body: request.body === undefined ? undefined : (JSON.parse(JSON.stringify(request.body)) as unknown),
    headers: { ...request.headers },
  };
}

export function createMockTransport(
  server: MockServer,
  options: MockTransportOptions,
): { transport: Transport; controls: MockTransportControls } {
  let failureRate = clampRate(options.failureRate);
  const random = options.random ?? Math.random;
  const minLatency = Math.max(0, options.minLatencyMs);
  const maxLatency = Math.max(minLatency, options.maxLatencyMs);
  const latency = () => (maxLatency === minLatency ? minLatency : minLatency + random() * (maxLatency - minLatency));

  const transport: Transport = async (request): Promise<TransportResponse> => {
    // Half of the latency before the server sees the request, half on the way back.
    const total = latency();
    await delay(total / 2, request.signal);
    if (failureRate > 0 && random() < failureRate) {
      const body: ApiErrorBody = { code: 'NETWORK_ERROR', message: 'Simulated network failure' };
      return { status: 0, data: body };
    }
    const response = await server.handle(serialize(request));
    await delay(total / 2, request.signal);
    return response;
  };

  return {
    transport,
    controls: {
      setFailureRate(rate) {
        failureRate = clampRate(rate);
      },
      getFailureRate() {
        return failureRate;
      },
    },
  };
}
