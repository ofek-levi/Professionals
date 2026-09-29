/**
 * MongoDB connection (one mongoose connection per process, pooled) and the transaction helper.
 *
 * Query hardening: `strictQuery` drops filter paths that are not in the schema. Operator
 * injection is stopped before queries are built: every input is parsed by zod into primitives and
 * `middleware/reject-operator-keys.ts` refuses `$`-prefixed keys. Mongoose's global
 * `sanitizeFilter` is deliberately off: it would also neutralise our own `$in`/`$gt` filters
 * unless each one were wrapped in `mongoose.trusted()`.
 */
import mongoose, { type ClientSession } from 'mongoose';

import type { Logger } from '../lib/logger.js';

mongoose.set('strictQuery', true);
// Indexes are created explicitly at startup (`syncIndexes`), not lazily on first use.
mongoose.set('autoIndex', false);

export interface MongoOptions {
  uri: string;
  dbName?: string | undefined;
  maxPoolSize: number;
}

export async function connectMongo(options: MongoOptions): Promise<typeof mongoose> {
  return mongoose.connect(options.uri, {
    dbName: options.dbName,
    maxPoolSize: options.maxPoolSize,
    minPoolSize: Math.min(2, options.maxPoolSize),
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    retryWrites: true,
  });
}

/**
 * Creates the collections and makes their indexes match the schemas (idempotent; indexes removed
 * from a schema are dropped). Runs at startup; a failure is logged loudly but does not stop the
 * process (e.g. another instance is building the same index during a rolling deploy).
 */
export async function syncIndexes(logger: Logger): Promise<void> {
  for (const model of Object.values(mongoose.models)) {
    try {
      await model.createCollection().catch(() => undefined);
      await model.syncIndexes();
      logger.debug({ model: model.modelName }, 'indexes synced');
    } catch (error) {
      logger.error({ err: error, model: model.modelName }, 'index sync failed');
    }
  }
}

export async function pingMongo(): Promise<boolean> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected || !db) return false;
  await db.admin().ping();
  return true;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

/** Unit of work inside a transaction. Side effects (realtime, push) go to `afterCommit`. */
export interface Tx {
  session: ClientSession;
  /** Runs `effect` once the transaction committed (never on abort or retry). */
  afterCommit(effect: () => void | Promise<void>): void;
}

/**
 * Runs `work` in a MongoDB transaction (retried on transient errors by the driver) and then its
 * `afterCommit` effects. Pass `tx.session` to every read and write inside `work`.
 */
export async function withTransaction<T>(logger: Logger, work: (tx: Tx) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  let effects: (() => void | Promise<void>)[] = [];
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      effects = []; // a retried attempt starts clean
      result = await work({ session, afterCommit: (effect) => effects.push(effect) });
    });
  } finally {
    await session.endSession();
  }
  for (const effect of effects) {
    try {
      await effect();
    } catch (error) {
      logger.error({ err: error }, 'after-commit effect failed');
    }
  }
  return result as T;
}
