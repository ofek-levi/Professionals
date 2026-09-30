/**
 * Cron scheduler. Modules declare jobs (`<module>.jobs.ts`) and `server.ts` registers them. Every
 * instance schedules every job; a scheduled tick is claimed in Redis under its own key (job name +
 * scheduled time, left to expire), so exactly one instance runs it even when another instance's
 * timer fires late, and a run lock keeps two runs of a job from overlapping. Jobs can be disabled
 * per process (`CRON_ENABLED=false`, `CRON_DISABLED_JOBS=a,b`) to dedicate workers.
 * Job functions receive nothing but their deps and must be idempotent (a lock can expire).
 */
import cron, { type ScheduledTask, type TaskContext } from 'node-cron';

import type { Logger } from '../../lib/logger.js';
import { KEY_SPACES, type RedisKeys } from '../keys.js';
import type { Redis } from '../redis.js';
import { claimOnce, withRedisLock } from './lock.js';

export interface CronJob {
  /** Stable name (lock key, logs, `CRON_DISABLED_JOBS`). */
  name: string;
  /** node-cron expression (UTC), e.g. `*\/5 * * * *`. */
  schedule: string;
  /** Upper bound of one run; the run lock expires after it. */
  lockTtlMs: number;
  run(): Promise<void>;
}

export interface Scheduler {
  /**
   * Runs one job now under its run lock (tests, manual triggers); with `tick`, as the scheduler
   * does for that scheduled time. Returns false when it did not run (tick taken or job running).
   */
  runNow(name: string, tick?: Date): Promise<boolean>;
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

/** A tick's claim outlives any plausible lag between instances (it is only a marker). */
const TICK_CLAIM_MS = 10 * 60_000;

export function startScheduler({ jobs, redis, keys, logger, enabled, disabledJobs }: SchedulerOptions): Scheduler {
  const byName = new Map(jobs.map((job) => [job.name, job]));
  const running = new Set<Promise<unknown>>();

  /** `tick`: the scheduled time being served (none for manual runs, which only take the run lock). */
  const execute = async (job: CronJob, tick?: Date): Promise<boolean> => {
    const startedAt = Date.now();
    if (tick && !(await claimOnce(redis, keys.key(KEY_SPACES.cronLock, job.name, 'tick', tick.getTime()), Math.max(job.lockTtlMs, TICK_CLAIM_MS)))) {
      return false;
    }
    const ran = await withRedisLock(redis, keys.key(KEY_SPACES.cronLock, job.name), job.lockTtlMs, () => job.run());
    if (ran) logger.info({ job: job.name, ms: Date.now() - startedAt }, 'cron job finished');
    return ran;
  };

  const tick = (job: CronJob, context: TaskContext) => {
    const run = execute(job, context.date).catch((error: unknown) => logger.error({ err: error, job: job.name }, 'cron job failed'));
    running.add(run);
    void run.finally(() => running.delete(run));
  };

  const tasks: ScheduledTask[] = [];
  if (enabled) {
    for (const job of jobs) {
      if (disabledJobs.includes(job.name)) continue;
      tasks.push(cron.schedule(job.schedule, (context) => tick(job, context), { name: job.name, timezone: 'UTC', noOverlap: true }));
    }
    logger.info({ jobs: tasks.length }, 'cron scheduler started');
  }

  return {
    async runNow(name, tick) {
      const job = byName.get(name);
      if (!job) throw new Error(`Unknown cron job "${name}"`);
      return execute(job, tick);
    },
    async stop() {
      for (const task of tasks) await task.stop();
      await Promise.allSettled([...running]);
    },
  };
}
