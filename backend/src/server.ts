/**
 * Process entry point: validate env → connect MongoDB (indexes) and Redis → HTTP + WebSocket →
 * cron. SIGTERM/SIGINT stop accepting connections, close sockets, stop cron, let in-flight
 * requests and background work finish, close MongoDB/Redis and exit within SHUTDOWN_TIMEOUT_MS.
 */
import { createServer } from 'node:http';

import './models.js';
import { createApp } from './app.js';
import { envWarnings, parseEnv, EnvError, type Env } from './config/env.js';
import { allCronJobs } from './cron-jobs.js';
import { createDeps } from './deps.js';
import { startScheduler } from './infra/cron/index.js';
import { KEY_SPACES } from './infra/keys.js';
import { connectMongo, disconnectMongo, ensureIndexes } from './infra/mongo.js';
import { attachRealtimeServer } from './infra/realtime/index.js';
import { closeRedis, createRedis } from './infra/redis.js';
import { isSessionDenied, sessionRevokedChannel } from './infra/session-denylist.js';
import { createLogger, type Logger } from './lib/logger.js';
import { realtimeUpgradeLimiter } from './middleware/rate-limit.js';
import { applyServerTimeouts } from './server-timeouts.js';

function loadEnv(): Env {
  try {
    return parseEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger: Logger = createLogger({ level: env.logLevel, pretty: env.appEnv === 'development' && process.stdout.isTTY });
  for (const warning of envWarnings(env)) logger.warn(warning);

  await connectMongo(env.mongo);
  await ensureIndexes(logger);
  const redis = createRedis(env.redis.url, `api-${env.appEnv}`);
  const subscriber = redis.duplicate({ connectionName: `api-${env.appEnv}-sub` });

  const deps = createDeps({ env, logger, redis });
  const app = createApp(deps);
  const server = createServer(app);
  applyServerTimeouts(server);

  const realtime = await attachRealtimeServer({
    httpServer: server,
    subscriber,
    channel: deps.keys.key(KEY_SPACES.realtimeChannel),
    tokens: env.jwt,
    clock: deps.clock,
    logger,
    isSessionRevoked: (sessionId) => isSessionDenied(deps, sessionId),
    revocationChannel: sessionRevokedChannel(deps.keys),
    allowUpgrade: realtimeUpgradeLimiter(deps),
  });
  const scheduler = startScheduler({
    jobs: allCronJobs(deps),
    redis,
    keys: deps.keys,
    logger,
    enabled: env.cron.enabled,
    disabledJobs: env.cron.disabledJobs,
  });

  await new Promise<void>((resolve) => server.listen(env.port, resolve));
  logger.info({ port: env.port, appEnv: env.appEnv }, 'API listening');

  let shuttingDown = false;
  const shutdown = async (signal: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => {
      logger.error('shutdown timed out, exiting');
      process.exit(1);
    }, env.shutdownTimeoutMs);
    force.unref();
    try {
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      // Sockets and cron stop side by side; in-flight requests finish, then the work they started.
      await Promise.all([realtime.close(), scheduler.stop()]);
      await closed;
      await deps.background.drain();
      await Promise.all([closeRedis(subscriber), closeRedis(redis), disconnectMongo()]);
      logger.info('shutdown complete');
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
      exitCode = 1;
    }
    process.exit(exitCode);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled promise rejection'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    void shutdown('uncaughtException', 1);
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`Failed to start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
