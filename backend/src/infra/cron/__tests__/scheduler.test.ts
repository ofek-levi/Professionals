import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../../test/app.js';
import { withRedisLock } from '../lock.js';
import { startScheduler, type CronJob } from '../scheduler.js';

describe('cron', () => {
  const deps = createTestDeps();

  it('withRedisLock lets one holder run and releases afterwards', async () => {
    const key = deps.keys.key('lock', 'unit');
    let release: () => void = () => undefined;
    const first = withRedisLock(deps.redis, key, 10_000, () => new Promise<void>((resolve) => (release = resolve)));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await withRedisLock(deps.redis, key, 10_000, () => Promise.resolve())).toBe(false);
    release();
    expect(await first).toBe(true);
    expect(await deps.redis.exists(key)).toBe(0);
    expect(await withRedisLock(deps.redis, key, 10_000, () => Promise.resolve())).toBe(true);
  });

  it('runNow executes a job under its lock; concurrent runs are skipped', async () => {
    let runs = 0;
    const job: CronJob = {
      name: 'test-job',
      schedule: '*/5 * * * *',
      lockTtlMs: 10_000,
      run: async () => {
        runs += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
    };
    const scheduler = startScheduler({ jobs: [job], redis: deps.redis, keys: deps.keys, logger: deps.logger, enabled: false, disabledJobs: [] });
    const results = await Promise.all([scheduler.runNow('test-job'), scheduler.runNow('test-job')]);
    expect(results.sort()).toEqual([false, true]);
    expect(runs).toBe(1);
    await expect(scheduler.runNow('unknown')).rejects.toThrow('Unknown cron job');
    await scheduler.stop();
  });
});
