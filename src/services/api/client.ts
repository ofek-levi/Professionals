import { ApiError, parseErrorBody } from './errors';
import type { HttpMethod, QueryValue, Transport } from './transport';

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * A 401 answer is an expected result of this request (e.g. wrong password on `POST /auth/login`)
   * rather than an expired session, so `onUnauthorized` is not called. Set by the public sign-in
   * endpoints only; every other endpoint (including future authenticated `/auth/*` ones) keeps the
   * global sign-out.
   */
  skipUnauthorizedHandler?: boolean;
}

export interface ApiClientOptions {
  transport: Transport;
  /** Returns the current access token (or null when signed out). */
  getAccessToken?: () => string | null;
  /**
   * Called when the backend answers 401 (e.g. to sign the user out). Not called for requests sent
   * with `skipUnauthorizedHandler` (the public sign-in endpoints, where a 401 means "wrong
   * credentials" for a caller that is not signed in).
   */
  onUnauthorized?: () => void;
  /** Sent as `Accept-Language` so the backend can localize server generated text. */
  getLanguage?: () => string | undefined;
}

/**
 * Thin, typed HTTP client. Endpoint modules call `get/post/patch/delete` with a path and receive
 * parsed JSON typed as `T`. Any non-2xx status is thrown as an `ApiError`.
 */
export class ApiClient {
  private transport: Transport;
  private readonly options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
    this.transport = options.transport;
  }

  /** Swap the transport at runtime (e.g. tests or switching between mock and HTTP). */
  setTransport(transport: Transport): void {
    this.transport = transport;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body ?? {}, options);
  }

  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  private async request<T>(method: HttpMethod, path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const token = this.options.getAccessToken?.() ?? null;
    const language = this.options.getLanguage?.();
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(language ? { 'Accept-Language': language } : {}),
      ...options?.headers,
    };

    const response = await this.transport({
      method,
      path,
      query: options?.query,
      body,
      headers,
      signal: options?.signal,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.data as T;
    }

    const error = new ApiError(response.status, parseErrorBody(response.status, response.data));
    if (error.status === 401 && !options?.skipUnauthorizedHandler) this.options.onUnauthorized?.();
    throw error;
  }
}
