import type { AppNotification } from '@/types/domain';

import { getNotificationDayKind, groupNotificationsByDay, isNotificationUnread } from '../notification-list-model';

const NOW = new Date(2026, 8, 27, 15, 0);

function notification(id: string, createdAt: Date | string, readAt: string | null = null): AppNotification {
  return {
    id,
    userId: 'user-1',
    type: 'offer_received',
    params: {},
    target: { kind: 'none' },
    readAt,
    createdAt: typeof createdAt === 'string' ? createdAt : createdAt.toISOString(),
  };
}

describe('groupNotificationsByDay', () => {
  it('groups by local calendar day and keeps the API order (newest first)', () => {
    const items = [
      notification('a', new Date(2026, 8, 27, 14, 0)),
      notification('b', new Date(2026, 8, 27, 0, 5)),
      notification('c', new Date(2026, 8, 26, 23, 55)),
      notification('d', new Date(2026, 8, 20, 9, 0)),
    ];
    const groups = groupNotificationsByDay(items, NOW);
    expect(groups.map((group) => group.key)).toEqual(['2026-09-27', '2026-09-26', '2026-09-20']);
    expect(groups.map((group) => group.notifications.map((item) => item.id))).toEqual([['a', 'b'], ['c'], ['d']]);
    expect(groups.map((group) => group.daysAgo)).toEqual([0, 1, 7]);
  });

  it('returns no groups for an empty list', () => {
    expect(groupNotificationsByDay([], NOW)).toEqual([]);
  });

  it('treats an invalid timestamp as today', () => {
    const groups = groupNotificationsByDay([notification('x', 'not-a-date')], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].daysAgo).toBe(0);
  });
});

describe('getNotificationDayKind', () => {
  it('labels today, yesterday and older days', () => {
    expect(getNotificationDayKind({ daysAgo: 0 })).toBe('today');
    expect(getNotificationDayKind({ daysAgo: -1 })).toBe('today');
    expect(getNotificationDayKind({ daysAgo: 1 })).toBe('yesterday');
    expect(getNotificationDayKind({ daysAgo: 2 })).toBe('older');
  });
});

describe('isNotificationUnread', () => {
  it('is unread until readAt is set', () => {
    expect(isNotificationUnread({ readAt: null })).toBe(true);
    expect(isNotificationUnread({ readAt: NOW.toISOString() })).toBe(false);
  });
});
