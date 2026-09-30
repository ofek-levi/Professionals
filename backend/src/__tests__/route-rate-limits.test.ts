/**
 * Every route has a rate limit of its own besides the global `/v1` one (`middleware/rate-limit.ts`),
 * and several routes share a bucket only where that is the intent. A new route without a limiter
 * fails here.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp, createTestDeps } from '../../test/app.js';
import { signInCustomer } from '../../test/auth.js';
import { createApp } from '../app.js';
import { KEY_SPACES } from '../infra/keys.js';
import { RATE_LIMITS, rateLimitName } from '../middleware/rate-limit.js';

/** Buckets several routes share on purpose: name → how many routes use it. */
const SHARED_BUCKETS: Record<string, number> = {
  /** `GET /geo/search` and `GET /geo/reverse`: one per-IP budget for the address picker. */
  'geo-ip': 2,
  /** `POST /requests`, `PATCH /requests/:requestId`, `PUT /me/avatar`: one budget of image posts. */
  'images-user': 3,
};

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle: unknown;
}

interface RouteLimiters {
  route: string;
  limiters: string[];
}

/** The routes of an Express router stack (mounted routers included) with their limiters' names. */
function routeLimiters(stack: RouteLayer[]): RouteLimiters[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map((method) => method.toUpperCase()).join('|');
      const limiters = layer.route.stack.map((handler) => rateLimitName(handler.handle)).filter((name) => name !== undefined);
      return [{ route: `${methods} ${layer.route.path}`, limiters }];
    }
    const nested = (layer.handle as { stack?: RouteLayer[] }).stack;
    return nested ? routeLimiters(nested) : [];
  });
}

describe('route rate limits', () => {
  describe.each([
    ['off (tests)', 'false'],
    ['on', 'true'],
  ])('with rate limiting %s', (_label, enabled) => {
    const app = createApp(createTestDeps({ env: { RATE_LIMIT_ENABLED: enabled } }));
    const routes = routeLimiters((app.router as unknown as { stack: RouteLayer[] }).stack);

    it('finds every route', () => {
      expect(routes.length).toBeGreaterThan(60);
      expect(routes.map((entry) => entry.route)).toEqual(
        expect.arrayContaining(['GET /health', 'GET /ready', 'POST /auth/login', 'GET /jobs', 'POST /conversations/:conversationId/messages']),
      );
    });

    it('gives every route a limiter of its own besides the global one', () => {
      expect(routes.filter((entry) => entry.limiters.length === 0).map((entry) => entry.route)).toEqual([]);
    });

    it('shares a bucket between routes only on purpose', () => {
      const routesPerBucket = new Map<string, number>();
      for (const entry of routes) for (const name of new Set(entry.limiters)) routesPerBucket.set(name, (routesPerBucket.get(name) ?? 0) + 1);
      expect(Object.fromEntries([...routesPerBucket].filter(([, count]) => count > 1))).toEqual(SHARED_BUCKETS);
    });
  });

  describe('on the API', () => {
    const { app, deps } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true', TRUST_PROXY: 'true' } });
    beforeEach(clearDatabase);

    it('counts each route of a signed-in user in its own bucket, per user', async () => {
      const [first, second] = [await signInCustomer(deps), await signInCustomer(deps)];
      const readAll = (headers: Record<string, string>) => request(app).post('/v1/notifications/read-all').set(headers);
      for (let i = 0; i < RATE_LIMITS.userWrites.limit; i += 1) await readAll(first.headers).expect(200);
      const limited = await readAll(first.headers).expect(429);
      expect(limited.body).toEqual({ code: 'RATE_LIMITED', message: expect.any(String) });
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      // Another route of the same user, and the same route of another user, have their own budgets.
      await request(app).get('/v1/notifications/unread-count').set(first.headers).expect(200);
      await readAll(second.headers).expect(200);
    });

    it('answers the pages opened from auth emails with an HTML 429 page in the browser’s language', async () => {
      const ip = '198.51.100.7';
      const page = () => request(app).get('/v1/auth/verify-email?token=unknown').set('X-Forwarded-For', ip).set('Accept-Language', 'he');
      for (let i = 0; i < RATE_LIMITS.emailLinkPagesPerIp.limit; i += 1) await page().expect(400);
      const limited = await page().expect(429).expect('Content-Type', /html/);
      expect(limited.text).toContain('lang="he"');
      expect(limited.text).toContain('יותר מדי ניסיונות');
      expect(limited.headers['cache-control']).toBe('no-store');
    });

    it('limits health checks per IP in the instance’s memory', async () => {
      const ip = '198.51.100.8';
      for (let i = 0; i < RATE_LIMITS.healthPerIp.limit; i += 1) await request(app).get('/health').set('X-Forwarded-For', ip).expect(200);
      await request(app).get('/health').set('X-Forwarded-For', ip).expect(429);
      await request(app).get('/health').set('X-Forwarded-For', '198.51.100.9').expect(200);
      const keys = await deps.redis.keys(`${deps.keys.key(KEY_SPACES.rateLimit, 'health-ip')}*`);
      expect(keys).toEqual([]);
    });
  });
});
