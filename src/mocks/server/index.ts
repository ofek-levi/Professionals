/**
 * In-app mock backend implementing the REST contract of docs/ARCHITECTURE.md.
 *
 * `handle()` awaits `ready()`, runs scheduled tasks (offer expiry, reminders) with the injected
 * clock, authenticates the bearer token, routes to a handler inside a transaction, deep-clones the
 * JSON response and maps thrown `DomainError`s to `{ status, data: ApiErrorBody }`.
 */
import { DomainError } from '@/features/shared/domain-error';
import { apiConfig } from '@/services/api/config';

import { seedDatabase } from '../data/seed';
import { authenticate, authenticateOptional } from './auth';
import { createUnitOfWorkRunner, type ServerHooks, type UnitOfWorkRunner } from './context';
import {
  cloneJson,
  createAsyncStorageDatabaseStorage,
  createDebouncedSaver,
  MOCK_DB_SCHEMA_VERSION,
  MockDatabase,
  type DatabaseStorage,
} from './db';
import { errorToResponse } from './errors';
import { createEventBus } from './event-bus';
import { ROUTES } from './handlers';
import { languageFromHeaders, QueryReader, RouteResponse, Router, splitPath } from './router';
import { runScheduledTasks } from './services/scheduler';
import { createSimulator, type Simulator } from './services/simulator';
import type { MockServer, MockServerOptions } from './types';

export interface CreateMockServerOptions extends MockServerOptions {
  /** Storage used when `persist` is true (defaults to AsyncStorage). */
  storage?: DatabaseStorage;
  /** Debounce of persisted saves in ms (default 300). */
  persistDebounceMs?: number;
  /**
   * Persisted demo data seeded longer ago than this is replaced by a fresh seed at launch (default
   * 12 h). Seed timestamps are relative to the seeding time, so showcase offers would otherwise
   * expire and the demo scenario fall apart for anyone returning the next day.
   */
  maxSeedAgeMs?: number;
}

const DEFAULT_MAX_SEED_AGE_MS = 12 * 60 * 60 * 1000;

/** Test/dev access to the server internals. The app itself only uses the `MockServer` contract. */
export interface MockServerInternals {
  readonly db: MockDatabase;
  now(): Date;
  /** Runs work in a unit of work (transaction, event delivery) – e.g. to arrange test fixtures. */
  run: UnitOfWorkRunner;
  /** Writes pending changes to storage immediately. */
  flushPersistence(): Promise<void>;
}

export interface InternalMockServer extends MockServer {
  readonly internals: MockServerInternals;
}

const defaultSchedule = (callback: () => void, delayMs: number) => {
  setTimeout(callback, delayMs);
};

export function createMockServer(options: CreateMockServerOptions = {}): InternalMockServer {
  const clock = options.now ?? (() => new Date());
  const persist = options.persist ?? false;
  const schedule = options.schedule ?? defaultSchedule;
  let simulationEnabled = options.simulation ?? true;

  const db = new MockDatabase();
  const bus = createEventBus();
  const router = new Router(ROUTES);
  const storage = options.storage ?? createAsyncStorageDatabaseStorage();
  const saver = createDebouncedSaver(() => storage.save(db.snapshot(clock())), options.persistDebounceMs ?? 300);

  // The simulator needs the runner and the runner needs the hooks: resolve lazily.
  let simulator: Simulator | null = null;
  const hooks: ServerHooks = {
    onRequestPublished: (ctx, requestId) => simulator?.onRequestPublished(ctx, requestId),
    onMessageSent: (ctx, message) => simulator?.onMessageSent(ctx, message),
  };
  const run = createUnitOfWorkRunner({ db, clock, bus, hooks });
  simulator = createSimulator({ run, schedule, isEnabled: () => simulationEnabled });

  let readyPromise: Promise<void> | null = null;

  async function load(): Promise<void> {
    if (persist) {
      const snapshot = await storage.load();
      const maxSeedAgeMs = options.maxSeedAgeMs ?? DEFAULT_MAX_SEED_AGE_MS;
      const usable =
        snapshot !== null &&
        snapshot.version === MOCK_DB_SCHEMA_VERSION &&
        clock().getTime() - Date.parse(snapshot.seededAt) < maxSeedAgeMs;
      if (snapshot && usable) {
        db.restore(snapshot);
      } else {
        seedDatabase(db, clock());
        await saver.flush();
      }
      db.onChange(() => saver.schedule());
    } else {
      seedDatabase(db, clock());
    }
  }

  const ready = () => {
    if (!readyPromise) readyPromise = load();
    return readyPromise;
  };

  const server: InternalMockServer = {
    ready,
    events: bus,

    async handle(request) {
      await ready();
      const { path, search } = splitPath(request.path);
      try {
        const match = router.match(request.method, path);
        if (!match) throw DomainError.notFound('Endpoint', `${request.method} ${path}`);
        const query = QueryReader.from(request.query, search);
        const body = cloneJson(request.body);
        run((ctx) => runScheduledTasks(ctx));
        const result = run(
          (ctx) =>
            match.route.invoke({
              ctx,
              actor:
                match.route.auth === 'public'
                  ? authenticateOptional(ctx.db, request.headers)
                  : authenticate(ctx.db, request.headers),
              params: match.params,
              query,
              body,
              headers: request.headers,
              language: languageFromHeaders(request.headers),
            }),
          { transactional: request.method !== 'GET' },
        );
        const response = result instanceof RouteResponse ? result : new RouteResponse(200, result);
        return { status: response.status, data: cloneJson(response.data ?? null) };
      } catch (error) {
        return errorToResponse(error);
      }
    },

    async reset() {
      await ready();
      saver.cancel();
      simulator?.reset();
      seedDatabase(db, clock());
      if (persist) await saver.flush();
    },

    setSimulationEnabled(enabled) {
      simulationEnabled = enabled;
    },

    isSimulationEnabled() {
      return simulationEnabled;
    },

    internals: {
      db,
      now: clock,
      run,
      flushPersistence: () => (persist ? saver.flush() : Promise.resolve()),
    },
  };
  return server;
}

let singleton: InternalMockServer | null = null;

/** The app-wide mock server (persistence per `apiConfig`, simulator on). */
export function getMockServer(): InternalMockServer {
  if (!singleton) singleton = createMockServer({ persist: apiConfig.mock.persist, simulation: true });
  return singleton;
}

export type { MockServer, MockServerOptions } from './types';
