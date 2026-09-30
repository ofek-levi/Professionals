/**
 * A transport sends a normalized HTTP-like request and resolves with a normalized response.
 * It must NOT throw for HTTP error statuses (the client maps those to `ApiError`), only for
 * network-level failures.
 *
 * The app uses `createHttpTransport` (services/api/http-transport.ts); tests plug in a test double.
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

export interface TransportRequest {
  method: HttpMethod;
  /** Path relative to the API base URL, always starting with `/`. */
  path: string;
  query?: Record<string, QueryValue>;
  /** A JSON-serializable value, or `FormData` for multipart uploads (sent as is). */
  body?: unknown;
  headers: Record<string, string>;
  signal?: AbortSignal;
  /** Overrides the transport's default time limit (e.g. for uploads). */
  timeoutMs?: number;
}

export interface TransportResponse {
  status: number;
  data: unknown;
  /** Response headers the client reads, lower-cased (`retry-after`). */
  headers?: Readonly<Record<string, string>>;
}

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

/** `true` for a multipart body (`fetch` sets its content type with the boundary). */
export function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

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
