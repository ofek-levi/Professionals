/**
 * A transport sends a normalized HTTP-like request and resolves with a normalized response.
 * It must NOT throw for HTTP error statuses (the client maps those to `ApiError`), only for
 * network-level failures.
 *
 * Implementations:
 *  - `createHttpTransport` (services/api/http-transport.ts) – real `fetch` based backend.
 *  - `createMockTransport` (mocks/transport.ts) – in-app mock backend.
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

export interface TransportRequest {
  method: HttpMethod;
  /** Path relative to the API base URL, always starting with `/`. */
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  data: unknown;
}

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

/** Serializes query params the same way for every transport (`a=1&ids=x,y`). */
export function serializeQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      parts.push(`${encodeURIComponent(key)}=${value.map((v) => encodeURIComponent(String(v))).join(',')}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
