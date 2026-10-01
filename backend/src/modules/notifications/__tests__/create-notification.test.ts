import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import {
  createCustomer,
  createJob,
  createOffer,
  createProfessional,
  createPushSession,
  createRequest,
  createSession,
} from '../../../../test/factories.js';
import { SessionModel } from '../../auth/session.model.js';
import { withTransaction } from '../../../infra/mongo.js';
import { newObjectId } from '../../../lib/ids.js';
import { UserModel } from '../../users/user.model.js';
import { createNotification, createNotifications } from '../create-notification.service.js';
import { NotificationModel } from '../notification.model.js';

describe('createNotification', () => {
  const deps = createTestDeps({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(async () => {
    await clearDatabase();
    deps.push.sent.length = 0;
    deps.realtime.clear();
  });

  async function offerReceivedFixture() {
    const customer = await createCustomer();
    const { professional } = await createProfessional();
    const request = await createRequest(customer);
    const offer = await createOffer(request, professional, { price: 450, proposedStartAt: new Date('2026-10-03T07:00:00.000Z') });
    const input = { type: 'offer_received' as const, offer, categoryId: request.categoryId, professionalName: 'Avi Fix' };
    return { customer, professional, request, offer, input };
  }

  it('stores the notification, publishes it and pushes to every signed-in install', async () => {
    const { customer, request, offer, input } = await offerReceivedFixture();
    const phone = await createPushSession(customer);
    const tablet = await createPushSession(customer);
    await createSession(customer); // signed in, push not registered

    const created = await createNotification(deps, customer._id, input);
    await deps.background.drain();

    expect(created).toEqual({
      id: expect.any(String),
      userId: customer._id.toHexString(),
      type: 'offer_received',
      params: { categoryId: 'plumbing', professionalName: 'Avi Fix', price: 450, currency: 'ILS', scheduledAt: '2026-10-03T07:00:00.000Z' },
      target: { kind: 'offer', offerId: offer._id.toHexString(), requestId: request._id.toHexString() },
      readAt: null,
      createdAt: '2026-10-01T09:00:00.000Z',
    });
    expect(await NotificationModel.countDocuments({ user: customer._id })).toBe(1);
    expect(deps.realtime.eventsFor(customer._id.toHexString())).toEqual([{ type: 'notification.created', notification: created }]);
    expect(deps.push.sent.map((message) => message.to).sort()).toEqual([phone.pushToken, tablet.pushToken].sort());
    expect(deps.push.sent[0]).toMatchObject({
      title: 'New offer: ₪450',
      body: 'Avi Fix sent an offer for your Plumbing request.'.replace('Avi Fix', '⁨Avi Fix⁩'),
      data: { notificationId: created?.id, notificationType: 'offer_received', target: created?.target },
    });
    expect(await deps.redis.zcard(deps.keys.key('push-tickets'))).toBe(2);
  });

  it('pushes in the recipient language', async () => {
    const customer = await createCustomer();
    const { user, professional } = await createProfessional();
    const request = await createRequest(customer);
    const offer = await createOffer(request, professional);
    await createPushSession(user);
    await createNotification(deps, user._id, { type: 'offer_expired', offer, categoryId: 'plumbing' });
    await deps.background.drain();
    expect(deps.push.sent[0]).toMatchObject({ title: 'תוקף ההצעה פג', body: expect.stringContaining('אינסטלציה') });
  });

  it('job_cancelled tells the customer why, in their language, under the job updates toggle', async () => {
    const customer = await createCustomer();
    const { professional } = await createProfessional();
    const request = await createRequest(customer);
    const job = await createJob(request, await createOffer(request, professional, { proposedStartAt: new Date('2026-10-03T07:00:00.000Z') }));
    await createPushSession(customer);

    const created = await createNotification(deps, customer._id, { type: 'job_cancelled', job });
    await deps.background.drain();
    expect(created).toMatchObject({
      type: 'job_cancelled',
      params: { categoryId: 'plumbing', scheduledAt: '2026-10-03T07:00:00.000Z' },
      target: { kind: 'job', jobId: job._id.toHexString() },
    });
    expect(deps.push.sent[0]).toMatchObject({
      title: 'Job cancelled',
      body: expect.stringMatching(/^Your Plumbing job on .+ was cancelled because the professional deleted their account\.$/),
    });

    await UserModel.updateOne({ _id: customer._id }, { $set: { language: 'he' } });
    await createNotification(deps, customer._id, { type: 'job_cancelled', job });
    await deps.background.drain();
    expect(deps.push.sent[1]).toMatchObject({
      title: 'העבודה בוטלה',
      body: expect.stringMatching(/^העבודה שלכם בנושא אינסטלציה \(.+\) בוטלה כי החשבון של בעל המקצוע נמחק\.$/),
    });

    await UserModel.updateOne({ _id: customer._id }, { $set: { 'notificationPreferences.jobUpdates': false } });
    expect(await createNotification(deps, customer._id, { type: 'job_cancelled', job })).toBeNull();
  });

  it('stores nothing when the category toggle is off, and skips push when push is off', async () => {
    const { customer, input } = await offerReceivedFixture();
    await createPushSession(customer);

    await UserModel.updateOne({ _id: customer._id }, { $set: { 'notificationPreferences.jobUpdates': false } });
    expect(await createNotification(deps, customer._id, input)).toBeNull();
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect(deps.realtime.published).toEqual([]);

    await UserModel.updateOne({ _id: customer._id }, { $set: { 'notificationPreferences.jobUpdates': true, 'notificationPreferences.pushEnabled': false } });
    expect(await createNotification(deps, customer._id, input)).not.toBeNull();
    await deps.background.drain();
    expect(deps.realtime.published).toHaveLength(1);
    expect(deps.push.sent).toEqual([]);
  });

  it('stores and sends nothing to a deleted account, whatever its preferences say', async () => {
    const { customer, input } = await offerReceivedFixture();
    await createPushSession(customer);
    await UserModel.updateOne({ _id: customer._id }, { $set: { deletedAt: deps.clock.now() } });
    expect(await createNotification(deps, customer._id, input)).toBeNull();
    await deps.background.drain();
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect([deps.realtime.published, deps.push.sent]).toEqual([[], []]);
  });

  it('keeps only the newest unread new_message notification per conversation', async () => {
    const customer = await createCustomer();
    const conversationId = newObjectId();
    const message = (text: string) => ({
      type: 'new_message' as const,
      conversationId,
      categoryId: 'plumbing' as const,
      senderRole: 'professional' as const,
      senderName: 'Avi Fix',
      messageText: text,
      replacesUnread: true,
    });
    await createNotification(deps, customer._id, message('First'));
    await createNotification(deps, customer._id, message('Second\n\n\n  line'));
    const stored = await NotificationModel.find({ user: customer._id }).lean();
    expect(stored.map((doc) => doc.params.messagePreview)).toEqual(['Second line']);
  });

  it('inside a transaction: persisted with it, effects only after commit', async () => {
    const { customer, input } = await offerReceivedFixture();
    await expect(
      withTransaction(deps.logger, async (tx) => {
        await createNotification(deps, customer._id, input, tx);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect(deps.realtime.published).toEqual([]);

    await withTransaction(deps.logger, async (tx) => {
      await createNotification(deps, customer._id, input, tx);
      expect(deps.realtime.published).toEqual([]);
    });
    expect(deps.realtime.published).toHaveLength(1);
  });

  it('batches recipients and drops tokens Expo reports as unregistered', async () => {
    const { customer, professional, offer, request } = await offerReceivedFixture();
    const other = await createCustomer({ notificationPreferences: { pushEnabled: true, emailEnabled: false, jobUpdates: false, messages: true, newRequests: true, reminders: true } });
    const dead = await createPushSession(customer);
    deps.push.unregistered.add(dead.pushToken);
    await createPushSession(customer, { pushToken: 'not-an-expo-token' });

    const results = await createNotifications(deps, [
      { userId: customer._id, input: { type: 'request_cancelled', request, customerName: 'Noa L.', reason: 'other' } },
      { userId: other._id, input: { type: 'offer_withdrawn', offer, categoryId: 'plumbing', professionalName: professional.displayName } },
    ]);
    await deps.background.drain();

    expect(results.map((result) => result?.type ?? null)).toEqual(['request_cancelled', null]);
    // The customer's own reason is not sent (only an account deletion is: account-deletion-effects).
    expect(results[0]?.params).not.toHaveProperty('reason');
    // The tokens go; the sessions stay signed in.
    expect(await SessionModel.countDocuments({ user: customer._id, pushToken: { $exists: true } })).toBe(0);
    expect(await SessionModel.countDocuments({ user: customer._id })).toBe(2);
  });

  it('pushes only to live sessions: not to one past its expiry that the TTL monitor has not deleted yet', async () => {
    const { customer, input } = await offerReceivedFixture();
    const live = await createPushSession(customer);
    await createPushSession(customer, { expiresAt: new Date('2026-10-01T08:59:59.000Z') });

    await createNotification(deps, customer._id, input);
    await deps.background.drain();

    expect(deps.push.sent.map((message) => message.to)).toEqual([live.pushToken]);
  });

  it('keeps the tokens and the other tickets when a request to Expo fails', async () => {
    const { customer, input } = await offerReceivedFixture();
    const reachable = await createPushSession(customer);
    const failing = await createPushSession(customer);
    deps.push.failing.add(failing.pushToken);
    await deps.redis.del(deps.keys.key('push-tickets'));

    await createNotification(deps, customer._id, input);
    await deps.background.drain(); // the failure is logged by the background runner, not thrown here

    expect(deps.push.sent.map((message) => message.to).sort()).toEqual([reachable.pushToken, failing.pushToken].sort());
    expect(await SessionModel.countDocuments({ user: customer._id, pushToken: { $exists: true } })).toBe(2);
    const tickets = await deps.redis.zrange(deps.keys.key('push-tickets'), '0', '-1');
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toContain(reachable.pushToken);
  });
});
