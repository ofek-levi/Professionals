/** The three most recent notifications, rendered with the shared presenter. */
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Divider, EmptyState, Icon, SectionHeader, TimeAgo } from '@/components/ui';
import { useNotificationPresenter, useOpenNotification } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { AppNotification } from '@/types/domain';

export function RecentNotifications({ notifications }: { notifications: AppNotification[] }) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('professional');
  const recent = notifications.slice(0, 3);
  return (
    <View testID="pro-home-notifications">
      <SectionHeader
        title={t('home.notifications.title')}
        icon="bell-outline"
        actionLabel={t('home.seeAll')}
        onAction={() => router.push(routes.professional.notifications)}
      />
      <Card padding="none" style={styles.card}>
        {recent.length === 0 ? (
          <EmptyState compact icon="bell-check-outline" title={t('home.notifications.emptyTitle')} description={t('home.notifications.emptyDescription')} />
        ) : (
          recent.map((notification, index) => (
            <Fragment key={notification.id}>
              {index > 0 ? <Divider inset={68} /> : null}
              <NotificationRow notification={notification} />
            </Fragment>
          ))
        )}
      </Card>
    </View>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const styles = useStyles();
  const theme = useTheme();
  const present = useNotificationPresenter();
  const open = useOpenNotification();
  const { t } = useTranslation('professional');
  const content = present(notification);
  const unread = notification.readAt === null;
  const tone = theme.colors.tones[content.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[unread ? t('home.notifications.unread') : null, content.title, content.body].filter(Boolean).join(', ')}
      onPress={() => open(notification)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
        <Icon name={content.icon} size={20} color={tone.fg} />
      </View>
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <AppText variant={unread ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.shrink}>
            {content.title}
          </AppText>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <AppText variant="caption" color="secondary" numberOfLines={2}>
          {content.body}
        </AppText>
        <TimeAgo date={notification.createdAt} variant="tiny" />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    padding: t.spacing.lg,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  shrink: {
    flexShrink: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.colors.primary,
  },
}));
