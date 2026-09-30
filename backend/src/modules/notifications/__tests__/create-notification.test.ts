import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { createCustomer, createDevice, createOffer, createProfessional, createRequest, createSession } from '../../../../test/factories.js';
import { SessionModel } from '../../auth/session.model.js';
import { withTransaction } from '../../../infra/mongo.js';
import { newObjectId } from '../../../lib/ids.js';
import { DeviceModel } from '../../users/device.model.js';
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

  it('stores the notification, publishes it and pushes to every device', async () => {
    const { customer, request, offer, input } = await offerReceivedFixture();
    const phone = await createDevice(customer);
    const tablet = await createDevice(customer);

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
    expect(deps.push.sent.map((message) => message.to).sort()).toEqual([phone.token, tablet.token].sort());
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
    await createDevice(user);
    await createNotification(deps, user._id, { type: 'offer_expired', offer, categoryId: 'plumbing' });
    await deps.background.drain();
    expect(deps.push.sent[0]).toMatchObject({ title: 'תוקף ההצעה פג', body: expect.stringContaining('אינסטלציה') });
  });

  it('stores nothing when the category toggle is off, and skips push when push is off', async () => {
    const { customer, input } = await offerReceivedFixture();
    await createDevice(customer);

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
    const dead = await createDevice(customer);
    deps.push.unregistered.add(dead.token);
    await createDevice(customer, { token: 'not-an-expo-token' });

    const results = await createNotifications(deps, [
      { userId: customer._id, input: { type: 'request_cancelled', request, customerName: 'Noa L.' } },
      { userId: other._id, input: { type: 'offer_withdrawn', offer, categoryId: 'plumbing', professionalName: professional.displayName } },
    ]);
    await deps.background.drain();

    expect(results.map((result) => result?.type ?? null)).toEqual(['request_cancelled', null]);
    expect(await DeviceModel.countDocuments({ user: customer._id })).toBe(0);
  });

  it('never pushes to a device whose session ended without a logout (TTL expiry, offline sign-out), and deletes it', async () => {
    const { customer, input } = await offerReceivedFixture();
    const live = await createDevice(customer);
    // Its session expired (the TTL monitor has not deleted it yet).
    await createDevice(customer, { session: (await createSession(customer, { expiresAt: new Date('2026-10-01T08:59:59.000Z') }))._id });
    const deleted = await createDevice(customer);
    await SessionModel.deleteOne({ _id: deleted.session }); // what the TTL monitor does

    await createNotification(deps, customer._id, input);
    await deps.background.drain();

    expect(deps.push.sent.map((message) => message.to)).toEqual([live.token]);
    expect((await DeviceModel.find({ user: customer._id }, { token: 1 }).lean()).map((device) => device.token)).toEqual([live.token]);
  });

  it('keeps a device that a new session registered again while the fan-out ran', async () => {
    const { customer, input } = await offerReceivedFixture();
    const device = await createDevice(customer);
    await SessionModel.deleteOne({ _id: device.session });
    const renewed = await createSession(customer);
    const deleteMany = DeviceModel.deleteMany.bind(DeviceModel);
    // The phone signs in again (same token, new session) after the fan-out read its devices.
    const spy = vi.spyOn(DeviceModel, 'deleteMany').mockImplementationOnce(((filter: Parameters<typeof deleteMany>[0]) =>
      DeviceModel.updateOne({ _id: device._id }, { $set: { session: renewed._id } }).then(() => deleteMany(filter))) as never);
    try {
      await createNotification(deps, customer._id, input);
      await deps.background.drain();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
    expect(deps.push.sent).toEqual([]);
    expect(await DeviceModel.findById(device._id).lean()).toMatchObject({ session: renewed._id });
  });

  it('keeps devices and the other tickets when a request to Expo fails', async () => {
    const { customer, input } = await offerReceivedFixture();
    const reachable = await createDevice(customer);
    const failing = await createDevice(customer);
    deps.push.failing.add(failing.token);
    await deps.redis.del(deps.keys.key('push-tickets'));

    await createNotification(deps, customer._id, input);
    await deps.background.drain(); // the failure is logged by the background runner, not thrown here

    expect(deps.push.sent.map((message) => message.to).sort()).toEqual([reachable.token, failing.token].sort());
    expect(await DeviceModel.countDocuments({ user: customer._id })).toBe(2);
    const tickets = await deps.redis.zrange(deps.keys.key('push-tickets'), '0', '-1');
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toContain(reachable.token);
  });
});
