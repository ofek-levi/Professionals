/**
 * Professional home header: greeting, business name, today's availability, service area and the
 * notifications bell.
 */
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Icon, IconButton, Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { OwnProfessionalProfile } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { getTodayAvailability, greetingPeriod } from '../../home-model';

export interface HomeHeaderProps {
  profile: OwnProfessionalProfile | undefined;
  unreadCount: number;
  now: Date;
  onOpenNotifications: () => void;
  onEditArea: () => void;
}

export function HomeHeader({ profile, unreadCount, now, onOpenNotifications, onEditArea }: HomeHeaderProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const firstName = profile?.fullName.split(/\s+/)[0] ?? '';
  const greeting = t(`professional:home.greeting.${greetingPeriod(now)}`, { name: isolateText(firstName) });

  const today = profile ? getTodayAvailability(profile.availability, now) : null;
  const status = !today
    ? null
    : today.state === 'dayOff'
      ? { tone: 'neutral' as const, label: t('professional:home.status.dayOff') }
      : today.state === 'afterHours'
        ? { tone: 'neutral' as const, label: t('professional:home.status.afterHours', { start: today.start, end: today.end }) }
        : today.state === 'beforeHours'
          ? { tone: 'info' as const, label: t('professional:home.status.startsAt', { start: today.start, end: today.end }) }
          : { tone: 'success' as const, label: t('professional:home.status.available', { start: today.start, end: today.end }) };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        {profile ? (
          <Avatar name={profile.displayName} uri={profile.avatarUrl} size="md" verified={profile.isVerified} decorative />
        ) : (
          <Skeleton circle height={44} />
        )}
        <View style={styles.texts}>
          <AppText variant="captionStrong" color="muted" numberOfLines={1}>
            {greeting}
          </AppText>
          {profile ? (
            <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
              {profile.displayName}
            </AppText>
          ) : (
            <Skeleton width="70%" height={24} />
          )}
        </View>
        <IconButton
          icon="bell-outline"
          variant="surface"
          badgeCount={unreadCount}
          accessibilityLabel={t('common:tabs.notifications')}
          onPress={onOpenNotifications}
          testID="pro-home-bell"
        />
      </View>

      {profile && status ? (
        <View style={styles.pills}>
          <View style={[styles.pill, { backgroundColor: theme.colors.tones[status.tone].bg }]} accessible accessibilityRole="text">
            <View style={[styles.dot, { backgroundColor: theme.colors.tones[status.tone].solid }]} />
            <AppText variant="captionStrong" color={status.tone} numberOfLines={1}>
              {status.label}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('professional:home.serviceAreaA11y', {
              area: profile.serviceArea.label,
              distance: format.distance(profile.serviceArea.radiusKm),
            })}
            onPress={onEditArea}
            hitSlop={6}
            style={({ pressed }) => [styles.pill, styles.areaPill, pressed ? styles.pressed : null]}
          >
            <Icon name="map-marker-radius-outline" size={15} color="secondary" />
            <AppText variant="captionStrong" color="secondary" numberOfLines={1} style={styles.shrink}>
              {t('professional:home.serviceArea', {
                area: profile.serviceArea.label,
                distance: format.distance(profile.serviceArea.radiusKm),
              })}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.md,
    paddingTop: t.spacing.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    minHeight: 32,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
    maxWidth: '100%',
  },
  areaPill: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shrink: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
}));
