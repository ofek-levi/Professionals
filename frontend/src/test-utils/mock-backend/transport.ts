/**
 * Transport that sends API requests to the in-process test double instead of the network, the way
 * `createHttpTransport` would: JSON bodies are serialized (the server never shares objects with the
 * caller), `FormData` goes through as it is, and an aborted signal rejects with an `AbortError`.
 * Every request is recorded (`TransportLog`) so tests can assert what the app sent.
 */
import { isFormData, type Transport, type TransportRequest } from '@/services/api/transport';

import type { MockServer } from './server/types';

export interface RecordedRequest {
  method: TransportRequest['method'];
  /** Path without the query string. */
  path: string;
  query: TransportRequest['query'];
  /** The JSON body as sent, or the `FormData`. */
  body: unknown;
  headers: Record<string, string>;
  /** The answer's status. */
  status: number;
}

export interface TransportLog {
  readonly requests: readonly RecordedRequest[];
  /** Requests to `path` (optionally only `method`). */
  to(path: string, method?: TransportRequest['method']): RecordedRequest[];
  clear(): void;
}

function abortError(): Error {
  const error = new Error('The request was aborted');
  error.name = 'AbortError';
  return error;
}

function serialize(request: TransportRequest): TransportRequest {
  return {
    ...request,
    body:
      request.body === undefined || isFormData(request.body) ? request.body : (JSON.parse(JSON.stringify(request.body)) as unknown),
    headers: { ...request.headers },
  };
}

export function createMockTransport(server: MockServer): { transport: Transport; log: TransportLog } {
  const requests: RecordedRequest[] = [];
  const transport: Transport = async (request) => {
    if (request.signal?.aborted) throw abortError();
    const sent = serialize(request);
    const response = await server.handle(sent);
    requests.push({
      method: sent.method,
      path: sent.path.split('?')[0],
      query: sent.query,
      body: sent.body,
      headers: sent.headers,
      status: response.status,
    });
    if (request.signal?.aborted) throw abortError();
    return response;
  };
  return {
    transport,
    log: {
      requests,
      to: (path, method) => requests.filter((entry) => entry.path === path && (!method || entry.method === method)),
      clear: () => {
        requests.length = 0;
      },
    },
  };
}
