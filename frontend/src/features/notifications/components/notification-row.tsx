import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, Skeleton, haptics } from '@/components/ui';
import type { NotificationContent } from '@/features/notifications/notification-presenter';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { AppNotification } from '@/types/domain';

import { isNotificationUnread } from './notification-list-model';

interface NotificationRowProps {
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

const ICON_SIZE = 40;

/** One notification: tone-colored icon, localized title/body, time and an unread dot. */
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
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={`notification-${notification.id}`}
    >
      <View style={[styles.icon, { backgroundColor: tone.bg }]}>
        <Icon name={content.icon} size={20} color={tone.fg} />
      </View>
      <View style={[styles.texts, first ? null : styles.divider]}>
        <View style={styles.line}>
          <AppText variant={unread ? 'bodyStrong' : 'body'} numberOfLines={2} style={styles.flex}>
            {content.title}
          </AppText>
          <AppText variant="caption" color={unread ? 'primary' : 'muted'} tabular style={styles.time}>
            {time}
          </AppText>
        </View>
        <View style={styles.line}>
          {content.body ? (
            <AppText variant="caption" color="secondary" numberOfLines={2} style={styles.flex}>
              {content.body}
            </AppText>
          ) : (
            <View style={styles.flex} />
          )}
          {unread ? <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Placeholder row matching `NotificationRow`. */
export function NotificationRowSkeleton({ first = false }: { first?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Skeleton circle height={ICON_SIZE} />
      <View style={[styles.texts, styles.skeletonTexts, first ? null : styles.divider]}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="90%" height={11} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: t.spacing.md,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
    paddingVertical: t.spacing.md,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
    paddingTop: t.spacing.md + t.spacing.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
  },
  time: {
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: t.colors.primary,
  },
}));
