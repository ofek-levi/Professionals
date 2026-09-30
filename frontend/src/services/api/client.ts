import { ApiError, parseErrorBody, parseRetryAfter } from './errors';
import type { HttpMethod, QueryValue, Transport, TransportResponse } from './transport';

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * A public auth endpoint (sign-in, sign-up, refresh, logout…): sent without the bearer token, and
   * a 401 is the answer itself (wrong password, dead refresh token), never a reason to refresh.
   */
  anonymous?: boolean;
  /** Overrides the transport's time limit (uploads). */
  timeoutMs?: number;
}

/** How the client authenticates requests (the session's token manager in the app). */
export interface ApiClientAuth {
  /** A valid access token (refreshed first when it is about to expire), or `null` when signed out. */
  getAccessToken(): Promise<string | null> | string | null;
  /**
   * An authenticated request answered 401 with `rejectedToken`. Resolves the token to retry with
   * (after one shared refresh), or `null` when the session is over.
   */
  handleUnauthorized?(rejectedToken: string): Promise<string | null>;
}

export interface ApiClientOptions {
  transport: Transport;
  /** Omitted: every request is anonymous. */
  auth?: ApiClientAuth;
  /** Sent as `Accept-Language` so the backend can localize server generated text. */
  getLanguage?: () => string | undefined;
}

interface PreparedRequest {
  method: HttpMethod;
  path: string;
  body: unknown;
  options: RequestOptions;
}

/**
 * Thin, typed HTTP client. Endpoint modules call `get/post/patch/delete` with a path and receive
 * parsed JSON typed as `T`. Any non-2xx status is thrown as an `ApiError`.
 *
 * Authenticated requests carry the session's access token; a 401 triggers one refresh (shared by
 * every request that failed with the same token) and a single retry with the new token.
 */
export class ApiClient {
  private transport: Transport;
  private readonly options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
    this.transport = options.transport;
  }

  /** Swap the transport at runtime (tests). */
  setTransport(transport: Transport): void {
    this.transport = transport;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'GET', path, body: undefined, options: options ?? {} });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'POST', path, body: body ?? {}, options: options ?? {} });
  }

  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'PATCH', path, body, options: options ?? {} });
  }

  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body, options: options ?? {} });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>({ method: 'DELETE', path, body: undefined, options: options ?? {} });
  }

  private async request<T>(request: PreparedRequest): Promise<T> {
    const { auth } = this.options;
    const token = request.options.anonymous || !auth ? null : await auth.getAccessToken();
    let response = await this.send(request, token);

    if (response.status === 401 && token && auth?.handleUnauthorized) {
      const nextToken = await auth.handleUnauthorized(token);
      if (nextToken && nextToken !== token) response = await this.send(request, nextToken);
    }

    if (response.status >= 200 && response.status < 300) return response.data as T;
    throw new ApiError(
      response.status,
      parseErrorBody(response.status, response.data),
      parseRetryAfter(response.headers?.['retry-after']),
    );
  }

  private send({ method, path, body, options }: PreparedRequest, token: string | null): Promise<TransportResponse> {
    const language = this.options.getLanguage?.();
    return this.transport({
      method,
      path,
      query: options.query,
      body,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(language ? { 'Accept-Language': language } : {}),
        ...options.headers,
      },
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
  }
}
