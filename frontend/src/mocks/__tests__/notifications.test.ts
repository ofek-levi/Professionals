import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = DEMO_CUSTOMER_IDS.noa;

describe('notifications API', () => {
  let env: TestEnvironment;
  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('lists, counts and marks notifications as read', async () => {
    const api = env.as(NOA).notifications;
    const all = await api.getNotifications();
    expect(all.totalCount).toBeGreaterThan(3);
    const times = all.items.map((notification) => Date.parse(notification.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const unread = await api.getNotifications({ unreadOnly: true });
    expect(unread.items.every((notification) => notification.readAt === null)).toBe(true);
    const { count } = await api.getUnreadCount();
    expect(count).toBe(unread.totalCount);

    const marked = await api.markNotificationAsRead(unread.items[0].id);
    expect(marked.readAt).not.toBeNull();
    expect((await api.getUnreadCount()).count).toBe(count - 1);

    const page = await api.getNotifications({ limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();

    // Keyset cursors: reading items of the first page (they leave the unread filter) does not make
    // the next page skip or repeat anything.
    const unreadFirst = await api.getNotifications({ unreadOnly: true, limit: 2 });
    const unreadIds = (await api.getNotifications({ unreadOnly: true, limit: 50 })).items.map((notification) => notification.id);
    for (const notification of unreadFirst.items) await api.markNotificationAsRead(notification.id);
    const unreadSecond = await api.getNotifications({ unreadOnly: true, limit: 2, cursor: unreadFirst.nextCursor });
    expect(unreadSecond.items.map((notification) => notification.id)).toEqual(unreadIds.slice(2, 4));

    await expect(api.markAllNotificationsAsRead()).resolves.toEqual({ success: true });
    expect((await api.getUnreadCount()).count).toBe(0);
    expect(await expectApiError(env.as(PRO_IDS.avi).notifications.markNotificationAsRead(all.items[0].id))).toMatchObject({
      status: 403,
    });
    expect(await expectApiError(api.getNotifications({ cursor: 'garbage' }))).toMatchObject({ status: 422 });
  });

  it('respects notification preferences', async () => {
    const own = await env.as(PRO_IDS.avi).professionals.getOwnProfessionalProfile();
    await env.as(PRO_IDS.avi).professionals.updateProfessionalProfile({
      notificationPreferences: { ...own.notificationPreferences, newRequests: false },
    });
    const created = await env.as(NOA).requests.createRequest({
      categoryId: 'plumbing',
      description: 'The shower drain is slow and smells bad.',
      location: {
        coordinates: { latitude: 32.0565, longitude: 34.7702 },
        addressLine: 'Vital St 5',
        city: 'Tel Aviv-Yafo',
        neighborhood: 'Florentin',
        details: null,
      },
      urgency: 'normal',
      preferredSchedule: null,
      photoIds: [],
      notes: null,
      publish: true,
    });
    const recipients = env.server.internals.db.notifications
      .filter((n) => n.type === 'new_matching_request' && n.target.kind === 'request' && n.target.requestId === created.id)
      .map((n) => n.userId);
    expect(recipients).not.toContain(PRO_IDS.avi);
    expect(recipients).toContain(PRO_IDS.yossi);
  });

  it('collapses unread chat notifications per conversation', async () => {
    const conversationId = SEED_IDS.conversations.noaLighting;
    for (const [index, text] of ['First question', 'Second question', 'Third, most recent question'].entries()) {
      await env.as(NOA).conversations.sendMessage(conversationId, { text, clientMessageId: `c-${index}` });
    }
    const messageNotifications = env.server.internals.db.notifications.filter(
      (n) => n.userId === PRO_IDS.yael && n.type === 'new_message' && n.readAt === null,
    );
    expect(messageNotifications).toHaveLength(1);
    expect(messageNotifications[0].params).toMatchObject({ customerName: 'Noa Levi', messagePreview: 'Third, most recent question' });

    // Opening the chat marks its notifications read.
    await env.as(PRO_IDS.yael).conversations.markConversationAsRead(conversationId);
    expect(
      env.server.internals.db.notifications.filter((n) => n.userId === PRO_IDS.yael && n.type === 'new_message' && n.readAt === null),
    ).toHaveLength(0);
  });
});
