import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { applyServerTimeouts } from '../server-timeouts.js';
import { APP_CONFIG } from '../shared/limits.js';

describe('HTTP server timeouts', () => {
  it('receive a post with every photo for longer than the app waits for it', () => {
    const server = createServer();
    applyServerTimeouts(server);
    const longestPost = APP_CONFIG.maxRequestPhotos * APP_CONFIG.photoUploadTimeoutMs;
    expect(server.requestTimeout).toBeGreaterThan(longestPost);
    // Idle sockets are closed by the load balancer first.
    expect(server.keepAliveTimeout).toBeGreaterThan(60_000);
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });
});
