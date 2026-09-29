/**
 * View model of the notifications list: groups notifications (newest first) into calendar-day
 * sections so the screen can render "Today", "Yesterday" and dated groups.
 */
import { differenceInCalendarDays, isValid, parseISO, startOfDay } from 'date-fns';

import type { AppNotification } from '@/types/domain';

export interface NotificationDayGroup {
  /** Stable key: the local calendar day, `YYYY-MM-DD`. */
  key: string;
  /** Local midnight of the group's day. */
  day: Date;
  /** Calendar days between the group's day and `now` (0 = today, 1 = yesterday, …). */
  daysAgo: number;
  notifications: AppNotification[];
}

type NotificationDayKind = 'today' | 'yesterday' | 'older';

function toDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Groups notifications by local calendar day. The order inside each group and the order of the
 * groups follow the input (the API returns newest first). An invalid timestamp counts as `now`.
 */
export function groupNotificationsByDay(notifications: readonly AppNotification[], now: Date): NotificationDayGroup[] {
  const groups: NotificationDayGroup[] = [];
  const byKey = new Map<string, NotificationDayGroup>();

  for (const notification of notifications) {
    const created = parseISO(notification.createdAt);
    const day = startOfDay(isValid(created) ? created : now);
    const key = toDayKey(day);
    let group = byKey.get(key);
    if (!group) {
      group = { key, day, daysAgo: differenceInCalendarDays(now, day), notifications: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.notifications.push(notification);
  }
  return groups;
}

/** How the group header is labelled. */
export function getNotificationDayKind(group: Pick<NotificationDayGroup, 'daysAgo'>): NotificationDayKind {
  if (group.daysAgo <= 0) return 'today';
  if (group.daysAgo === 1) return 'yesterday';
  return 'older';
}

export function isNotificationUnread(notification: Pick<AppNotification, 'readAt'>): boolean {
  return notification.readAt === null;
}
