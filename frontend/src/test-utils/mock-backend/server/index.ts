/**
 * In-process test double of the backend (backend/docs/API.md), for Jest only.
 *
 * `handle()` runs scheduled tasks (offer expiry, reminders) with the injected clock, authenticates
 * the bearer token, routes to a handler inside a transaction, deep-clones the JSON response and maps
 * thrown `DomainError`s to `{ status, data: ApiErrorBody }`. Multipart bodies (`FormData`) reach the
 * handler as they are; JSON bodies are cloned (the server never shares objects with the caller).
 */
import { DomainError } from '@/features/shared/domain-error';
import { isFormData } from '@/services/api/transport';
import type { SessionTokens } from '@/types/api';

import { seedDatabase } from '../data/seed';
import { authenticate, authenticateOptional } from './auth';
import { createUnitOfWorkRunner, type UnitOfWorkRunner } from './context';
import { cloneJson, MockDatabase } from './db';
import { errorToResponse } from './errors';
import { createEventBus } from './event-bus';
import { ROUTES } from './handlers';
import { languageFromHeaders, QueryReader, RouteResponse, Router, splitPath } from './router';
import { runScheduledTasks } from './services/scheduler';
import { issueAccessToken, startSession } from './sessions';
import type { MockServer, MockServerOptions } from './types';

/** Test access to the server internals (arranging fixtures, signing in without a password). */
export interface MockServerInternals {
  readonly db: MockDatabase;
  now(): Date;
  /** Runs work in a unit of work (transaction, event delivery) – e.g. to arrange test fixtures. */
  run: UnitOfWorkRunner;
  /** A new session of `userId`: the tokens `POST /auth/login` would answer. */
  startSession(userId: string): SessionTokens;
  /** A fresh access token of a live session (`null` once it was signed out or revoked). */
  issueAccessToken(sessionId: string): string | null;
}

export interface InternalMockServer extends MockServer {
  readonly internals: MockServerInternals;
}

export function createMockServer(options: MockServerOptions = {}): InternalMockServer {
  const clock = options.now ?? (() => new Date());
  const db = new MockDatabase();
  const bus = createEventBus();
  const router = new Router(ROUTES);
  const run = createUnitOfWorkRunner({ db, clock, bus });
  seedDatabase(db, clock());

  return {
    events: bus,

    async handle(request) {
      const { path, search } = splitPath(request.path);
      try {
        const match = router.match(request.method, path);
        if (!match) throw DomainError.notFound('Endpoint', `${request.method} ${path}`);
        const query = QueryReader.from(request.query, search);
        const body = isFormData(request.body) ? request.body : cloneJson(request.body);
        run((ctx) => runScheduledTasks(ctx));
        const result = run(
          (ctx) =>
            match.route.invoke({
              ctx,
              actor:
                match.route.auth === 'public'
                  ? authenticateOptional(ctx.db, request.headers, ctx.now())
                  : authenticate(ctx.db, request.headers, ctx.now()),
              params: match.params,
              query,
              body,
              headers: request.headers,
              language: languageFromHeaders(request.headers),
            }),
          { transactional: request.method !== 'GET' },
        );
        const response = result instanceof RouteResponse ? result : new RouteResponse(200, result);
        return { status: response.status, data: cloneJson(response.data ?? null), headers: response.headers };
      } catch (error) {
        return errorToResponse(error);
      }
    },

    internals: {
      db,
      now: clock,
      run,
      startSession: (userId) => run((ctx) => startSession(ctx, userId)),
      issueAccessToken: (sessionId) => run((ctx) => issueAccessToken(ctx, sessionId), { transactional: false }),
    },
  };
}
