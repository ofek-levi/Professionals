import { countInboxUnread, isUpdateNotification } from '../inbox-counts';

const countInboxBadge = (input: Parameters<typeof countInboxUnread>[0]) => countInboxUnread(input).total;

describe('Inbox tab badge (countInboxUnread().total)', () => {
  it('adds unread chat messages to the unread updates', () => {
    expect(
      countInboxBadge({
        unreadNotifications: 2,
        unreadList: [
          { type: 'offer_received', readAt: null },
          { type: 'job_confirmed', readAt: null },
        ],
        conversations: [{ unreadCount: 3 }, { unreadCount: 0 }],
      }),
    ).toBe(5);
  });

  it('counts a chat message once, not also as its "new message" notification', () => {
    expect(
      countInboxBadge({
        unreadNotifications: 2,
        unreadList: [
          { type: 'new_message', readAt: null },
          { type: 'offer_received', readAt: null },
        ],
        conversations: [{ unreadCount: 2 }],
      }),
    ).toBe(3);
  });

  it('ignores notifications already marked read and never goes negative', () => {
    expect(countInboxBadge({ unreadNotifications: 0, unreadList: [{ type: 'new_message', readAt: null }], conversations: [] })).toBe(0);
    expect(
      countInboxBadge({ unreadNotifications: 1, unreadList: [{ type: 'new_message', readAt: '2026-09-27T07:00:00.000Z' }], conversations: [] }),
    ).toBe(1);
  });
});

describe('countInboxUnread', () => {
  it('splits the badge into the Updates and Messages segment counts', () => {
    expect(
      countInboxUnread({
        unreadNotifications: 3,
        unreadList: [
          { type: 'new_message', readAt: null },
          { type: 'offer_received', readAt: null },
          { type: 'job_confirmed', readAt: null },
        ],
        conversations: [{ unreadCount: 2 }, { unreadCount: 1 }],
      }),
    ).toEqual({ updates: 2, messages: 3, total: 5 });
  });

  it('keeps chat notifications out of Updates', () => {
    expect(isUpdateNotification({ type: 'new_message' })).toBe(false);
    expect(isUpdateNotification({ type: 'offer_received' })).toBe(true);
  });
});
