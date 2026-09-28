import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Skeleton } from '@/components/ui';
import type { NotificationContent } from '@/features/notifications/notification-presenter';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { AppNotification } from '@/types/domain';

import { getNotificationDayKind, type NotificationDayGroup } from './notification-list-model';
import { NotificationRow, NotificationRowSkeleton } from './notification-row';

interface NotificationDayGroupProps {
  group: NotificationDayGroup;
  now: Date;
  present: (notification: AppNotification) => NotificationContent;
  onPressNotification: (notification: AppNotification) => void;
}

/** "Today" / "Yesterday" / "Wednesday, Sep 23" label followed by that day's notifications. */
export function NotificationDayGroupList({ group, now, present, onPressNotification }: NotificationDayGroupProps) {
  const styles = useStyles();
  const label = useDayLabel(group, now);
  const timeStyle = getNotificationDayKind(group) === 'today' ? 'relative' : 'clock';
  return (
    <View style={styles.group}>
      <AppText variant="captionStrong" color="muted" accessibilityRole="header">
        {label}
      </AppText>
      <View>
        {group.notifications.map((notification, index) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            content={present(notification)}
            now={now}
            timeStyle={timeStyle}
            first={index === 0}
            onPress={onPressNotification}
          />
        ))}
      </View>
    </View>
  );
}

function useDayLabel(group: NotificationDayGroup, now: Date): string {
  const { t } = useTranslation(['notifications', 'common']);
  const format = useFormatters();
  switch (getNotificationDayKind(group)) {
    case 'today':
      return t('common:time.today');
    case 'yesterday':
      return t('common:time.yesterday');
    case 'older':
      return t('notifications:groups.weekdayDate', {
        weekday: format.date(group.day, 'weekday'),
        date: format.date(group.day, group.day.getFullYear() === now.getFullYear() ? 'dayMonth' : 'medium'),
      });
  }
}

/** Loading placeholder: a day label and skeleton rows. */
export function NotificationGroupSkeleton({ rows = 3 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Skeleton width={80} height={12} />
      <View>
        {Array.from({ length: rows }, (_, index) => (
          <NotificationRowSkeleton key={index} first={index === 0} />
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  group: {
    gap: t.spacing.xxs,
  },
}));
