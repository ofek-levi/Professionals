import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { createCustomer, createDevice } from '../../../../test/factories.js';
import { DeviceModel } from '../../users/device.model.js';
import { checkPushReceipts, notificationJobs } from '../notifications.jobs.js';
import { duePushTickets, savePushTickets } from '../push-tickets.js';

describe('push receipts cron', () => {
  const deps = createTestDeps({ now: '2026-10-01T09:00:00.000Z' });
  const ticketsKey = deps.keys.key('push-tickets');
  beforeEach(async () => {
    await clearDatabase();
    await deps.redis.del(ticketsKey);
    deps.push.receipts.clear();
  });

  it('is registered every 15 minutes under its fixed name', () => {
    expect(notificationJobs(deps).map(({ name, schedule }) => ({ name, schedule }))).toEqual([{ name: 'push-receipts', schedule: '*/15 * * * *' }]);
  });

  it('deletes tokens reported DeviceNotRegistered once receipts are due', async () => {
    const user = await createCustomer();
    const alive = await createDevice(user);
    const gone = await createDevice(user);
    await savePushTickets(
      deps.redis,
      deps.keys,
      [
        { ticketId: 't-ok', token: alive.token },
        { ticketId: 't-gone', token: gone.token },
        { ticketId: 't-pending', token: alive.token },
      ],
      deps.clock.now(),
    );
    deps.push.receipts.set('t-ok', { status: 'ok' });
    deps.push.receipts.set('t-gone', { status: 'error', error: 'DeviceNotRegistered' });

    deps.clock.advanceMinutes(10);
    expect(await checkPushReceipts(deps)).toBe(0); // not due yet
    expect(await deps.redis.zcard(ticketsKey)).toBe(3);

    deps.clock.advanceMinutes(6);
    expect(await checkPushReceipts(deps)).toBe(1);
    expect((await DeviceModel.find({ user: user._id }).lean()).map((device) => device.token)).toEqual([alive.token]);
    // Answered tickets are dropped; the unanswered one waits for the next run.
    expect(await duePushTickets(deps.redis, deps.keys, deps.clock.now())).toEqual([{ ticketId: 't-pending', token: alive.token }]);

    // After a day Expo no longer has the receipt: the ticket is purged.
    deps.clock.advanceMinutes(24 * 60);
    expect(await checkPushReceipts(deps)).toBe(0);
    expect(await deps.redis.zcard(ticketsKey)).toBe(0);
  });

  it('works through a backlog larger than one batch, skipping unanswered tickets', async () => {
    const user = await createCustomer();
    const gone = await createDevice(user);
    // 1000 unanswered tickets are older than the one whose receipt says the device is gone.
    const unanswered = Array.from({ length: 1000 }, (_, i) => ({ ticketId: `t-${i}`, token: `ExponentPushToken[other-${i}]` }));
    await savePushTickets(deps.redis, deps.keys, unanswered, deps.clock.now());
    deps.clock.advance(1000);
    await savePushTickets(deps.redis, deps.keys, [{ ticketId: 't-gone', token: gone.token }], deps.clock.now());
    deps.push.receipts.set('t-gone', { status: 'error', error: 'DeviceNotRegistered' });

    deps.clock.advanceMinutes(16);
    expect(await checkPushReceipts(deps)).toBe(1);
    expect(await DeviceModel.countDocuments()).toBe(0);
    expect(await deps.redis.zcard(ticketsKey)).toBe(1000);
  });

  it('keeps tokens whose receipts report other errors', async () => {
    const user = await createCustomer();
    const device = await createDevice(user);
    await savePushTickets(deps.redis, deps.keys, [{ ticketId: 't-big', token: device.token }], deps.clock.now());
    deps.push.receipts.set('t-big', { status: 'error', error: 'MessageTooBig' });
    deps.clock.advanceMinutes(16);
    expect(await checkPushReceipts(deps)).toBe(0);
    expect(await DeviceModel.countDocuments()).toBe(1);
    expect(await deps.redis.zcard(ticketsKey)).toBe(0);
  });
});
