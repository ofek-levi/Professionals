/**
 * Cron scheduler. Modules declare jobs (`<module>.jobs.ts`) and `server.ts` registers them. Each
 * tick runs under a Redis lock so only one API instance executes it; jobs can be disabled per
 * process (`CRON_ENABLED=false`, `CRON_DISABLED_JOBS=a,b`) to dedicate workers.
 * Job functions receive nothing but their deps and must be idempotent (a lock can expire).
 */
import cron, { type ScheduledTask } from 'node-cron';

import type { Logger } from '../../lib/logger.js';
import { KEY_SPACES, type RedisKeys } from '../keys.js';
import type { Redis } from '../redis.js';
import { withRedisLock } from './lock.js';

export interface CronJob {
  /** Stable name (lock key, logs, `CRON_DISABLED_JOBS`). */
  name: string;
  /** node-cron expression (UTC), e.g. `*\/5 * * * *`. */
  schedule: string;
  /** Upper bound of one run; the lock expires after it. */
  lockTtlMs: number;
  run(): Promise<void>;
}

export interface Scheduler {
  /** Runs one job now under its lock (tests, manual triggers). Returns false if locked. */
  runNow(name: string): Promise<boolean>;
  stop(): Promise<void>;
}

interface SchedulerOptions {
  jobs: CronJob[];
  redis: Redis;
  keys: RedisKeys;
  logger: Logger;
  enabled: boolean;
  disabledJobs: readonly string[];
}

export function startScheduler({ jobs, redis, keys, logger, enabled, disabledJobs }: SchedulerOptions): Scheduler {
  const byName = new Map(jobs.map((job) => [job.name, job]));
  const running = new Set<Promise<unknown>>();

  const execute = async (job: CronJob): Promise<boolean> => {
    const startedAt = Date.now();
    const ran = await withRedisLock(redis, keys.key(KEY_SPACES.cronLock, job.name), job.lockTtlMs, () => job.run());
    if (ran) logger.info({ job: job.name, ms: Date.now() - startedAt }, 'cron job finished');
    return ran;
  };

  const tick = (job: CronJob) => {
    const run = execute(job).catch((error: unknown) => logger.error({ err: error, job: job.name }, 'cron job failed'));
    running.add(run);
    void run.finally(() => running.delete(run));
  };

  const tasks: ScheduledTask[] = [];
  if (enabled) {
    for (const job of jobs) {
      if (disabledJobs.includes(job.name)) continue;
      tasks.push(cron.schedule(job.schedule, () => tick(job), { name: job.name, timezone: 'UTC', noOverlap: true }));
    }
    logger.info({ jobs: tasks.length }, 'cron scheduler started');
  }

  return {
    async runNow(name) {
      const job = byName.get(name);
      if (!job) throw new Error(`Unknown cron job "${name}"`);
      return execute(job);
    },
    async stop() {
      for (const task of tasks) await task.stop();
      await Promise.allSettled([...running]);
    },
  };
}
