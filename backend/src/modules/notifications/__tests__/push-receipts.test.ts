import type { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { createCustomer, createPushSession } from '../../../../test/factories.js';
import { SessionModel } from '../../auth/session.model.js';
import { checkPushReceipts, notificationJobs } from '../notifications.jobs.js';
import { duePushTickets, savePushTickets } from '../push-tickets.js';

const pushTokensOf = async (user: Types.ObjectId) =>
  (await SessionModel.find({ user, pushToken: { $exists: true } }, { pushToken: 1 }).lean()).map((session) => session.pushToken);

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

  it('removes tokens reported DeviceNotRegistered from their session once receipts are due', async () => {
    const user = await createCustomer();
    const alive = await createPushSession(user);
    const gone = await createPushSession(user);
    await savePushTickets(
      deps.redis,
      deps.keys,
      [
        { ticketId: 't-ok', token: alive.pushToken },
        { ticketId: 't-gone', token: gone.pushToken },
        { ticketId: 't-pending', token: alive.pushToken },
      ],
      deps.clock.now(),
    );
    deps.push.receipts.set('t-ok', { status: 'ok' });
    deps.push.receipts.set('t-gone', { status: 'error', error: 'DeviceNotRegistered' });

    // The set expires a day after the last push even if no instance ever runs this cron.
    const ttl = await deps.redis.ttl(ticketsKey);
    expect(ttl).toBeGreaterThan(24 * 60 * 60 - 60);
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60);

    deps.clock.advanceMinutes(10);
    expect(await checkPushReceipts(deps)).toBe(0); // not due yet
    expect(await deps.redis.zcard(ticketsKey)).toBe(3);

    deps.clock.advanceMinutes(6);
    expect(await checkPushReceipts(deps)).toBe(1);
    expect(await pushTokensOf(user._id)).toEqual([alive.pushToken]);
    expect(await SessionModel.countDocuments({ user: user._id })).toBe(2); // still signed in
    // Answered tickets are dropped; the unanswered one waits for the next run.
    expect(await duePushTickets(deps.redis, deps.keys, deps.clock.now())).toEqual([{ ticketId: 't-pending', token: alive.pushToken }]);

    // After a day Expo no longer has the receipt: the ticket is purged.
    deps.clock.advanceMinutes(24 * 60);
    expect(await checkPushReceipts(deps)).toBe(0);
    expect(await deps.redis.zcard(ticketsKey)).toBe(0);
  });

  it('works through a backlog larger than one batch, skipping unanswered tickets', async () => {
    const user = await createCustomer();
    const gone = await createPushSession(user);
    // 1000 unanswered tickets are older than the one whose receipt says the app is gone.
    const unanswered = Array.from({ length: 1000 }, (_, i) => ({ ticketId: `t-${i}`, token: `ExponentPushToken[other-${i}]` }));
    await savePushTickets(deps.redis, deps.keys, unanswered, deps.clock.now());
    deps.clock.advance(1000);
    await savePushTickets(deps.redis, deps.keys, [{ ticketId: 't-gone', token: gone.pushToken }], deps.clock.now());
    deps.push.receipts.set('t-gone', { status: 'error', error: 'DeviceNotRegistered' });

    deps.clock.advanceMinutes(16);
    expect(await checkPushReceipts(deps)).toBe(1);
    expect(await pushTokensOf(user._id)).toEqual([]);
    expect(await deps.redis.zcard(ticketsKey)).toBe(1000);
  });

  it('keeps tokens whose receipts report other errors', async () => {
    const user = await createCustomer();
    const phone = await createPushSession(user);
    await savePushTickets(deps.redis, deps.keys, [{ ticketId: 't-big', token: phone.pushToken }], deps.clock.now());
    deps.push.receipts.set('t-big', { status: 'error', error: 'MessageTooBig' });
    deps.clock.advanceMinutes(16);
    expect(await checkPushReceipts(deps)).toBe(0);
    expect(await pushTokensOf(user._id)).toEqual([phone.pushToken]);
    expect(await deps.redis.zcard(ticketsKey)).toBe(0);
  });
});
