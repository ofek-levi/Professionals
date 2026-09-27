import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Skeleton } from '@/components/ui';
import type { NotificationContent } from '@/features/notifications/notification-presenter';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { AppNotification } from '@/types/domain';

import { getNotificationDayKind, type NotificationDayGroup } from './notification-list-model';
import { NotificationRow, NotificationRowSkeleton } from './notification-row';

export interface NotificationDayGroupCardProps {
  group: NotificationDayGroup;
  now: Date;
  present: (notification: AppNotification) => NotificationContent;
  onPressNotification: (notification: AppNotification) => void;
}

/** "Today" / "Yesterday" / "Wednesday, Sep 23" header with the day's notifications in one card. */
export function NotificationDayGroupCard({ group, now, present, onPressNotification }: NotificationDayGroupCardProps) {
  const styles = useStyles();
  const label = useDayLabel(group, now);
  const timeStyle = getNotificationDayKind(group) === 'today' ? 'relative' : 'clock';
  return (
    <View style={styles.group}>
      <AppText variant="captionStrong" color="muted" accessibilityRole="header" style={styles.label}>
        {label}
      </AppText>
      <Card padding="none" style={styles.card}>
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
      </Card>
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

/** Loading placeholder: a day label and a card of skeleton rows. */
export function NotificationGroupSkeleton({ rows = 4 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Skeleton width={90} height={12} style={styles.label} />
      <Card padding="none" style={styles.card}>
        {Array.from({ length: rows }, (_, index) => (
          <NotificationRowSkeleton key={index} first={index === 0} />
        ))}
      </Card>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  group: {
    gap: t.spacing.sm,
  },
  label: {
    paddingHorizontal: t.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    overflow: 'hidden',
  },
}));
