import type { Transport } from './transport';
import { isFormData, serializeQuery } from './transport';

export interface HttpTransportOptions {
  baseUrl: string;
  timeoutMs: number;
}

/** Headers copied into `TransportResponse.headers`. */
const EXPOSED_HEADERS = ['retry-after'] as const;

function pickHeaders(headers: Headers): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of EXPOSED_HEADERS) {
    const value = headers.get(name);
    if (value !== null) picked[name] = value;
  }
  return picked;
}

/**
 * The network transport (`fetch`). JSON bodies are sent with a JSON content type; `FormData` goes
 * out untouched so `fetch` writes the multipart content type with its boundary.
 */
export function createHttpTransport({ baseUrl, timeoutMs }: HttpTransportOptions): Transport {
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  return async (request) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? timeoutMs);
    const abortFromCaller = () => controller.abort();
    request.signal?.addEventListener('abort', abortFromCaller);
    const multipart = isFormData(request.body);
    const json = request.body !== undefined && !multipart;

    try {
      const response = await fetch(`${normalizedBase}${request.path}${serializeQuery(request.query)}`, {
        method: request.method,
        headers: {
          Accept: 'application/json',
          ...(json ? { 'Content-Type': 'application/json' } : {}),
          ...request.headers,
        },
        body: multipart ? (request.body as FormData) : json ? JSON.stringify(request.body) : undefined,
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
      return { status: response.status, data, headers: pickHeaders(response.headers) };
    } catch (error) {
      if (controller.signal.aborted && !request.signal?.aborted) {
        return { status: 408, data: { code: 'TIMEOUT', message: 'The request timed out' } };
      }
      if (request.signal?.aborted) throw error;
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
