import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, Skeleton, haptics, withAlpha } from '@/components/ui';
import type { NotificationContent } from '@/features/notifications/notification-presenter';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { AppNotification } from '@/types/domain';

import { isNotificationUnread } from './notification-list-model';

export interface NotificationRowProps {
  notification: AppNotification;
  /** Localized title/body/icon/tone (from `useNotificationPresenter`). */
  content: NotificationContent;
  /** Reference time for the relative timestamp. */
  now: Date;
  /** `relative` ("5 minutes ago", for today's group) or the clock time (older groups show the day in their header). */
  timeStyle?: 'relative' | 'clock';
  onPress: (notification: AppNotification) => void;
  /** Hides the top divider (first row of a group). */
  first?: boolean;
}

/** One notification: tone-colored icon, localized title/body, relative time and unread marker. */
export function NotificationRow({ notification, content, now, onPress, timeStyle = 'relative', first = false }: NotificationRowProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('notifications');
  const format = useFormatters();
  const tone = theme.colors.tones[content.tone];
  const unread = isNotificationUnread(notification);
  const time = timeStyle === 'relative' ? format.relative(notification.createdAt, now) : format.time(notification.createdAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[unread ? t('a11y.unread') : null, content.title, content.body, time].filter(Boolean).join(', ')}
      accessibilityHint={t('a11y.openHint')}
      onPress={() => {
        haptics.light();
        onPress(notification);
      }}
      style={({ pressed }) => [
        styles.row,
        unread ? { backgroundColor: withAlpha(theme.colors.primary, theme.scheme === 'dark' ? 0.1 : 0.05) } : null,
        first ? null : styles.divider,
        pressed ? styles.pressed : null,
      ]}
      testID={`notification-${notification.id}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
        <Icon name={content.icon} size={22} color={tone.fg} />
      </View>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <AppText variant={unread ? 'bodyStrong' : 'body'} numberOfLines={2} style={styles.title}>
            {content.title}
          </AppText>
          {unread ? <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" /> : null}
        </View>
        {content.body ? (
          <AppText variant="caption" color="secondary" numberOfLines={3}>
            {content.body}
          </AppText>
        ) : null}
        <AppText variant="tiny" color={unread ? 'primary' : 'muted'} style={styles.time}>
          {time}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Placeholder row matching `NotificationRow`. */
export function NotificationRowSkeleton({ first = false }: { first?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, first ? null : styles.divider]}>
      <Skeleton circle height={44} />
      <View style={[styles.texts, styles.skeletonTexts]}>
        <Skeleton width="65%" height={14} />
        <Skeleton width="95%" height={11} />
        <Skeleton width="30%" height={10} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md + 2,
    minHeight: 72,
    backgroundColor: t.colors.surface,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
    paddingTop: t.spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
  },
  title: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: t.colors.primary,
  },
  time: {
    marginTop: t.spacing.xxs,
  },
}));
