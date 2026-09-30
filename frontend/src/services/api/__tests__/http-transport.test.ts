/**
 * The network transport: JSON and multipart bodies, query strings, exposed headers and the
 * mapping of timeouts, network failures and caller aborts.
 */
import { createHttpTransport } from '../http-transport';

const BASE = 'http://localhost:4000/v1/';

interface Sent {
  url: string;
  init: RequestInit;
}

function mockFetch(respond: (sent: Sent) => Promise<Response> | Response) {
  const calls: Sent[] = [];
  const fetchMock = jest.fn((url: string, init: RequestInit) => {
    const sent = { url, init };
    calls.push(sent);
    return Promise.resolve(respond(sent));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return calls;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? '' : JSON.stringify(body), { status, headers });

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
});

describe('http transport', () => {
  it('sends JSON with a JSON content type and parses the answer', async () => {
    const calls = mockFetch(() => json(201, { id: 'req_1' }));
    const transport = createHttpTransport({ baseUrl: BASE, timeoutMs: 1000 });
    const response = await transport({
      method: 'POST',
      path: '/requests',
      query: { categoryIds: ['plumbing', 'electrical'], limit: 20, cursor: null },
      body: { description: 'Leak' },
      headers: { Authorization: 'Bearer token' },
    });
    expect(response).toEqual({ status: 201, data: { id: 'req_1' }, headers: {} });
    expect(calls[0].url).toBe('http://localhost:4000/v1/requests?categoryIds=plumbing,electrical&limit=20');
    expect(calls[0].init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ description: 'Leak' }),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    });
  });

  it('sends FormData untouched, so fetch writes the multipart content type with its boundary', async () => {
    const calls = mockFetch(() => json(201, { id: 'upl_1', url: 'https://images.test/upl_1.jpg', width: 10, height: 10 }));
    const transport = createHttpTransport({ baseUrl: BASE, timeoutMs: 1000 });
    const form = new FormData();
    form.append('file', { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' } as unknown as Blob);
    await transport({ method: 'POST', path: '/uploads/images', body: form, headers: {} });
    expect(calls[0].init.body).toBe(form);
    expect(calls[0].init.headers).not.toHaveProperty('Content-Type');
  });

  it('sends no body and no content type for GET/DELETE', async () => {
    const calls = mockFetch(() => json(200, { success: true }));
    const transport = createHttpTransport({ baseUrl: BASE, timeoutMs: 1000 });
    await transport({ method: 'DELETE', path: '/me/devices/ExponentPushToken%5Bx%5D', headers: {} });
    expect(calls[0].init.body).toBeUndefined();
    expect(calls[0].init.headers).not.toHaveProperty('Content-Type');
  });

  it('exposes Retry-After and survives empty or malformed bodies', async () => {
    mockFetch(() => json(429, { code: 'RATE_LIMITED', message: 'Slow down' }, { 'Retry-After': '30' }));
    const transport = createHttpTransport({ baseUrl: BASE, timeoutMs: 1000 });
    expect(await transport({ method: 'GET', path: '/requests', headers: {} })).toMatchObject({
      status: 429,
      headers: { 'retry-after': '30' },
    });
    mockFetch(() => new Response(null, { status: 204 }));
    expect(await transport({ method: 'GET', path: '/x', headers: {} })).toMatchObject({ status: 204, data: null });
    mockFetch(() => new Response('<html>', { status: 502 }));
    expect(await transport({ method: 'GET', path: '/x', headers: {} })).toMatchObject({ status: 502, data: { code: 'SERVER_ERROR' } });
  });

  it('maps a network failure to NETWORK_ERROR (status 0)', async () => {
    mockFetch(() => Promise.reject(new TypeError('Network request failed')));
    const transport = createHttpTransport({ baseUrl: BASE, timeoutMs: 1000 });
    expect(await transport({ method: 'GET', path: '/me', headers: {} })).toEqual({
      status: 0,
      data: { code: 'NETWORK_ERROR', message: 'Network request failed' },
    });
  });

  it('times out with 408 TIMEOUT (per-request limit for uploads)', async () => {
    jest.useFakeTimers();
    mockFetch(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const transport = createHttpTransport({ baseUrl: BASE, timeoutMs: 1000 });
    const pending = transport({ method: 'POST', path: '/uploads/images', body: {}, headers: {}, timeoutMs: 90_000 });
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    jest.advanceTimersByTime(89_000);
    await expect(pending).resolves.toEqual({ status: 408, data: { code: 'TIMEOUT', message: 'The request timed out' } });
  });

  it('rethrows when the caller aborts (React Query cancellation, bounded logout)', async () => {
    mockFetch(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const transport = createHttpTransport({ baseUrl: BASE, timeoutMs: 1000 });
    const controller = new AbortController();
    const pending = transport({ method: 'POST', path: '/auth/logout', body: {}, headers: {}, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
