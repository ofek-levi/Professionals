/**
 * Jest's Node runtime has a real `WebSocket`: the app's realtime client would dial the configured
 * backend from every test that signs in. This stand-in never connects (tests that exercise realtime
 * inject the test double's socket server through `openSocket`).
 */
export class InertWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly readyState = InertWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {}

  send(): void {}

  close(): void {}
}
