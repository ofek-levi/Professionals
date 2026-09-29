import type { Transport } from './transport';
import { serializeQuery } from './transport';

export interface HttpTransportOptions {
  baseUrl: string;
  timeoutMs: number;
}

/** Real network transport based on `fetch`. Used when `EXPO_PUBLIC_API_MODE=http`. */
export function createHttpTransport({ baseUrl, timeoutMs }: HttpTransportOptions): Transport {
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  return async (request) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    request.signal?.addEventListener('abort', abortFromCaller);

    try {
      const response = await fetch(`${normalizedBase}${request.path}${serializeQuery(request.query)}`, {
        method: request.method,
        headers: {
          Accept: 'application/json',
          ...(request.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...request.headers,
        },
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { code: 'SERVER_ERROR', message: 'Malformed JSON response' };
        }
      }
      return { status: response.status, data };
    } catch (error) {
      if (controller.signal.aborted) {
        return { status: 408, data: { code: 'TIMEOUT', message: 'The request timed out' } };
      }
      return {
        status: 0,
        data: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Network error' },
      };
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener('abort', abortFromCaller);
    }
  };
}
