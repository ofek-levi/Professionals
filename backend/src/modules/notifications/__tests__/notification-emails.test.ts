import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { createCustomer, createOffer, createProfessional, createRequest } from '../../../../test/factories.js';
import { newObjectId } from '../../../lib/ids.js';
import type { UserDoc } from '../../users/user.model.js';
import { createNotification } from '../create-notification.service.js';
import { NOTIFICATION_EMAIL_LIMITS } from '../notifications.email.js';

const PREFERENCES = { pushEnabled: true, emailEnabled: true, jobUpdates: true, messages: true, newRequests: true, reminders: true };

describe('"Email updates" (notificationPreferences.emailEnabled)', () => {
  const deps = createTestDeps({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(async () => {
    await clearDatabase();
    deps.mailer.sent.length = 0;
  });

  const customerWith = (overrides: Partial<UserDoc>, verified = true) =>
    createCustomer({ ...(verified ? { emailVerifiedAt: deps.clock.now() } : {}), notificationPreferences: PREFERENCES, ...overrides });

  async function notifyOfferReceived(customer: UserDoc) {
    const { professional } = await createProfessional();
    const request = await createRequest(customer);
    const offer = await createOffer(request, professional, { price: 450 });
    await createNotification(deps, customer._id, { type: 'offer_received', offer, categoryId: 'plumbing', professionalName: 'Avi Fix' });
    await deps.background.drain();
  }

  it('emails the notification in the recipient’s language when the toggle is on', async () => {
    const english = await customerWith({ email: 'noa@example.com' });
    await notifyOfferReceived(english);
    const mail = deps.mailer.lastTo('noa@example.com');
    expect(mail).toMatchObject({ subject: 'New offer: ₪450', text: expect.stringContaining('Settings → Notifications') });
    expect(mail?.html).toContain('<html lang="en" dir="ltr">');

    const hebrew = await customerWith({ email: 'dana@example.com', language: 'he' });
    await notifyOfferReceived(hebrew);
    expect(deps.mailer.lastTo('dana@example.com')?.html).toContain('<html lang="he" dir="rtl">');
  });

  it('sends nothing when the toggle is off or the address was never verified', async () => {
    await notifyOfferReceived(await customerWith({ email: 'off@example.com', notificationPreferences: { ...PREFERENCES, emailEnabled: false } }));
    await notifyOfferReceived(await customerWith({ email: 'unverified@example.com' }, false));
    expect(deps.mailer.sent).toEqual([]);
  });

  it('emails a chat at most once per 30 minutes and a user at most 10 times an hour', async () => {
    const customer = await customerWith({ email: 'busy@example.com' });
    const conversationId = newObjectId();
    for (const text of ['Hi', 'Are you there?', 'Hello?']) {
      await createNotification(deps, customer._id, {
        type: 'new_message',
        conversationId,
        categoryId: 'plumbing',
        senderRole: 'professional',
        senderName: 'Avi Fix',
        messageText: text,
        replacesUnread: true,
      });
    }
    await deps.background.drain();
    expect(deps.mailer.sent.filter((mail) => mail.to === 'busy@example.com')).toHaveLength(1);

    for (let i = 0; i < NOTIFICATION_EMAIL_LIMITS.perUserPerHour + 3; i += 1) await notifyOfferReceived(customer);
    expect(deps.mailer.sent.filter((mail) => mail.to === 'busy@example.com')).toHaveLength(NOTIFICATION_EMAIL_LIMITS.perUserPerHour);
  });
});
