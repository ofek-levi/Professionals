/**
 * Professional tab "Profile": public identity, profile completeness, stats, service area, services
 * and account menu (edit profile, public profile, messages, settings, switch account, sign out).
 */
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip } from '@/components/categories';
import {
  AppText,
  Avatar,
  Badge,
  Card,
  Divider,
  ErrorState,
  Icon,
  IconButton,
  MenuRow,
  RatingStars,
  Screen,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  useConfirm,
  useToast,
  type IconSource,
} from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { useAuthActions } from '@/features/auth/session-provider';
import { useConversations, useOwnProfessionalProfile, useRefetchOnFocus } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { OwnProfessionalProfile } from '@/types/domain';

import { CompletenessCard } from '../components/account/completeness-card';
import { ServiceAreaCard } from '../components/account/service-area-card';
import { computeProfileCompleteness } from '../profile-completeness';

export default function ProfessionalAccountScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const { signOut } = useAuthActions();
  const query = useOwnProfessionalProfile();
  const conversations = useConversations();
  useRefetchOnFocus(query.refetch);
  const profile = query.data;
  const unreadMessages = (conversations.data ?? []).reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  const openSettings = () => router.push(routes.settings);
  const editProfile = () => router.push(routes.editProfile);

  const confirmSignOut = async () => {
    const ok = await confirm({
      title: t('professional:account.signOutTitle'),
      message: t('professional:account.signOutMessage'),
      confirmLabel: t('professional:account.signOut'),
      icon: 'logout',
      destructive: true,
    });
    if (!ok) return;
    await signOut();
    toast.show({ title: t('professional:account.signedOut'), tone: 'neutral', icon: 'logout' });
  };

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()} gap="xl" testID="pro-account-screen">
      <ScreenHeader
        title={t('common:tabs.profile')}
        actions={<IconButton icon="cog-outline" variant="surface" accessibilityLabel={t('common:screens.settings')} onPress={openSettings} />}
      />

      {profile ? (
        <>
          <ProfileHeader profile={profile} onViewPublic={() => router.push(routes.professionalProfile(profile.id))} />
          <CompletenessCard completeness={computeProfileCompleteness(profile)} onEdit={editProfile} />
          <StatsGrid profile={profile} />
          <View>
            <SectionHeader title={t('professional:account.serviceArea.title')} icon="map-marker-radius-outline" />
            <ServiceAreaCard serviceArea={profile.serviceArea} baseLocation={profile.baseLocation} onEdit={editProfile} />
          </View>
          <View>
            <SectionHeader
              title={t('professional:account.services.title')}
              icon="toolbox-outline"
              subtitle={t('common:categoryPicker.servicesCount', { count: profile.categoryIds.length })}
              actionLabel={t('common:actions.edit')}
              onAction={editProfile}
            />
            <View style={styles.chips}>
              {profile.categoryIds.map((id) => (
                <CategoryChip key={id} categoryId={id} size="sm" />
              ))}
            </View>
          </View>
        </>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : (
        <>
          <Card padding="xl" style={styles.skeletonHeader}>
            <Skeleton circle height={88} />
            <Skeleton width="50%" height={20} />
            <Skeleton width="70%" height={14} />
          </Card>
          <SkeletonCard />
        </>
      )}

      <Card padding="none" style={styles.menu}>
        {(
          [
            { key: 'edit', icon: 'account-edit-outline', tone: 'brand', title: t('professional:account.menu.editProfile'), subtitle: t('professional:account.menu.editProfileHint'), onPress: editProfile },
            profile
              ? { key: 'public', icon: 'card-account-details-star-outline', tone: 'accent', title: t('professional:account.menu.publicProfile'), subtitle: t('professional:account.menu.publicProfileHint'), onPress: () => router.push(routes.professionalProfile(profile.id)) }
              : null,
            {
              key: 'messages',
              icon: 'message-text-outline',
              tone: 'info',
              title: t('professional:account.menu.messages'),
              subtitle: unreadMessages > 0 ? t('professional:account.menu.unreadMessages', { count: unreadMessages }) : t('professional:account.menu.messagesHint'),
              onPress: () => router.push(routes.conversations),
            },
            { key: 'settings', icon: 'cog-outline', tone: 'neutral', title: t('common:screens.settings'), subtitle: t('professional:account.menu.settingsHint'), onPress: openSettings },
          ] satisfies ({ key: string; icon: IconSource; tone: StatusTone; title: string; subtitle: string; onPress: () => void } | null)[]
        )
          .filter((item) => item !== null)
          .map((item, index) => (
            <Fragment key={item.key}>
              {index > 0 ? <Divider inset={68} /> : null}
              <MenuRow icon={item.icon} iconTone={item.tone} title={item.title} subtitle={item.subtitle} onPress={item.onPress} style={styles.menuRow} testID={`pro-account-${item.key}`} />
            </Fragment>
          ))}
      </Card>

      <Card padding="none" style={styles.menu}>
        <MenuRow
          icon="account-switch-outline"
          iconTone="brand"
          title={t('professional:account.switchAccount')}
          subtitle={t('professional:account.switchAccountHint')}
          onPress={() => void signOut()}
          style={styles.menuRow}
          testID="pro-account-switch"
        />
        <Divider inset={68} />
        <MenuRow
          icon="logout"
          iconFlipInRTL
          destructive
          title={t('professional:account.signOut')}
          onPress={() => void confirmSignOut()}
          showChevron={false}
          style={styles.menuRow}
          testID="pro-account-sign-out"
        />
      </Card>
    </Screen>
  );
}

function ProfileHeader({ profile, onViewPublic }: { profile: OwnProfessionalProfile; onViewPublic: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  return (
    <Card variant="elevated" padding="xl" style={styles.profileCard} onPress={onViewPublic} accessibilityHint={t('professional:account.menu.publicProfileHint')}>
      <Avatar name={profile.displayName} uri={profile.avatarUrl} size="xl" verified={profile.isVerified} />
      <View style={styles.identity}>
        <AppText variant="title" align="center" numberOfLines={2}>
          {profile.displayName}
        </AppText>
        {profile.fullName !== profile.displayName ? (
          <AppText variant="caption" color="muted" align="center" numberOfLines={1}>
            {profile.fullName}
          </AppText>
        ) : null}
        <AppText variant="body" color="secondary" align="center" numberOfLines={2}>
          {profile.headline}
        </AppText>
      </View>
      <View style={styles.badges}>
        {profile.stats.averageRating !== null ? (
          <RatingStars value={profile.stats.averageRating} count={profile.stats.reviewCount} variant="compact" />
        ) : (
          <Badge label={t('common:rating.new')} tone="brand" icon="star-outline" size="sm" />
        )}
        {profile.isVerified ? <Badge label={t('common:verified')} tone="brand" icon="check-decagram" size="sm" /> : null}
        {profile.business.isInsured ? <Badge label={t('professional:account.insured')} tone="accent" icon="shield-check-outline" size="sm" /> : null}
      </View>
      <AppText variant="tiny" color="muted" align="center">
        {t('professional:account.memberSince', { date: format.date(profile.memberSince, 'monthYear') })}
      </AppText>
    </Card>
  );
}

function StatsGrid({ profile }: { profile: OwnProfessionalProfile }) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const stats: { key: string; icon: IconSource; tone: StatusTone; value: string; label: string }[] = [
    { key: 'jobs', icon: 'check-decagram-outline', tone: 'success', value: format.number(profile.stats.completedJobsCount), label: t('professional:account.stats.jobs') },
    {
      key: 'rating',
      icon: 'star-outline',
      tone: 'warning',
      value: profile.stats.averageRating !== null ? format.number(profile.stats.averageRating, 1) : '–',
      label: t('professional:account.stats.rating', { count: profile.stats.reviewCount }),
    },
    {
      key: 'response',
      icon: 'lightning-bolt-outline',
      tone: 'info',
      value: profile.stats.responseTimeMinutes !== null ? format.duration(profile.stats.responseTimeMinutes, 'short') : '–',
      label: t('professional:account.stats.response'),
    },
    { key: 'years', icon: 'medal-outline', tone: 'brand', value: format.number(profile.yearsOfExperience), label: t('professional:account.stats.years') },
  ];
  return (
    <View style={styles.stats} testID="pro-account-stats">
      {stats.map((stat) => {
        const colors = theme.colors.tones[stat.tone];
        return (
          <View key={stat.key} style={styles.stat} accessible accessibilityLabel={`${stat.value} ${stat.label}`}>
            <View style={[styles.statIcon, { backgroundColor: colors.bg }]}>
              <Icon name={stat.icon} size={20} color={colors.fg} />
            </View>
            <View style={styles.statTexts}>
              <AppText variant="heading" tabular numberOfLines={1}>
                {stat.value}
              </AppText>
              <AppText variant="caption" color="secondary" numberOfLines={2}>
                {stat.label}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  profileCard: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  identity: {
    alignItems: 'center',
    gap: t.spacing.xxs,
    alignSelf: 'stretch',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  skeletonHeader: {
    alignItems: 'center',
    gap: t.spacing.md,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.md,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  menu: {
    paddingHorizontal: t.spacing.lg,
  },
  menuRow: {
    minHeight: 64,
  },
}));
