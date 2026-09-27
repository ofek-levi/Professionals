import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip } from '@/components/categories';
import { AppText, Avatar, Badge, Icon, RatingStars, Skeleton, withAlpha, type IconName } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { ProfessionalProfile } from '@/types/domain';

const AVATAR_SIZE = 96;
const COVER_HEIGHT = 128;

/** Gradient cover, overlapping avatar, names, verification, rating and categories. */
export function ProfileHeader({ profile }: { profile: ProfessionalProfile }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['profile', 'common']);
  const format = useFormatters();
  const glass = withAlpha(theme.colors.onPrimary, 0.12);
  const showFullName = profile.fullName && profile.fullName !== profile.displayName;
  const city = profile.serviceArea.label || profile.baseLocation?.city;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.colors.proGradient}
        start={{ x: theme.isRTL ? 1 : 0, y: 0 }}
        end={{ x: theme.isRTL ? 0 : 1, y: 1 }}
        style={styles.cover}
      >
        <View style={[styles.decor, styles.decorLarge, { backgroundColor: glass }]} />
        <View style={[styles.decor, styles.decorSmall, { backgroundColor: glass }]} />
      </LinearGradient>

      <View style={styles.body}>
        <View style={[styles.avatarRing, { backgroundColor: theme.colors.background }]}>
          <Avatar name={profile.displayName} uri={profile.avatarUrl} size={AVATAR_SIZE} verified={profile.isVerified} />
        </View>

        <View style={styles.names}>
          <AppText variant="title" align="center" accessibilityRole="header">
            {profile.displayName}
          </AppText>
          {showFullName ? (
            <AppText variant="body" color="secondary" align="center">
              {profile.fullName}
            </AppText>
          ) : null}
          {profile.headline ? (
            <AppText variant="body" color="secondary" align="center" style={styles.headline}>
              {profile.headline}
            </AppText>
          ) : null}
        </View>

        <View style={styles.badges}>
          {profile.isVerified ? <Badge label={t('common:verified')} icon="check-decagram" tone="brand" /> : null}
          {profile.business.isInsured ? <Badge label={t('profile:public.insured')} icon="shield-check-outline" tone="success" /> : null}
          {profile.availability.acceptsEmergencyCalls ? (
            <Badge label={t('profile:public.emergencyCalls')} icon="alarm-light-outline" tone="danger" />
          ) : null}
        </View>

        <View style={styles.meta}>
          <RatingStars value={profile.stats.averageRating} count={profile.stats.reviewCount} showValue size={16} />
          {city ? <MetaItem icon="map-marker-outline" label={city} /> : null}
          <MetaItem icon="calendar-account-outline" label={t('profile:public.memberSince', { date: format.date(profile.memberSince, 'monthYear') })} />
        </View>

        {profile.categoryIds.length > 0 ? (
          <View style={styles.categories}>
            {profile.categoryIds.map((id) => (
              <CategoryChip key={id} categoryId={id} size="sm" />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MetaItem({ icon, label }: { icon: IconName; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.metaItem}>
      <Icon name={icon} size={15} color="muted" />
      <AppText variant="caption" color="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function ProfileHeaderSkeleton() {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={[styles.cover, { backgroundColor: theme.colors.skeleton }]} />
      <View style={styles.body}>
        <View style={[styles.avatarRing, { backgroundColor: theme.colors.background }]}>
          <Skeleton circle height={AVATAR_SIZE} />
        </View>
        <View style={[styles.names, styles.skeletonNames]}>
          <Skeleton width={180} height={22} />
          <Skeleton width={140} height={14} />
          <Skeleton width={220} height={14} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    marginHorizontal: -t.spacing.screen,
    marginTop: -t.spacing.md,
  },
  cover: {
    height: COVER_HEIGHT,
    overflow: 'hidden',
  },
  decor: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorLarge: {
    width: 240,
    height: 240,
    top: -120,
    end: -60,
  },
  decorSmall: {
    width: 140,
    height: 140,
    bottom: -80,
    start: 24,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: t.spacing.screen,
    gap: t.spacing.md,
    marginTop: -(AVATAR_SIZE / 2 + 6),
  },
  avatarRing: {
    padding: 6,
    borderRadius: 999,
  },
  names: {
    alignItems: 'center',
    gap: t.spacing.xxs,
  },
  skeletonNames: {
    gap: t.spacing.sm,
  },
  headline: {
    maxWidth: 420,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: t.spacing.lg,
    rowGap: t.spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
}));
