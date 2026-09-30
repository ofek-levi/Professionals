/** Timeouts of the HTTP server (`server.ts`). */
import type { Server } from 'node:http';

import { API_LIMITS } from './shared/limits.js';

export function applyServerTimeouts(server: Server): void {
  // Slightly above typical load-balancer idle timeouts so the LB closes idle sockets first.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  // A request's photos arrive in one body (up to 6 × 8 MB): longer than Node's 5 min default.
  server.requestTimeout = API_LIMITS.requestTimeoutMs;
}
