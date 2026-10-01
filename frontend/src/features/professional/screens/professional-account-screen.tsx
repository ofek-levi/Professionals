/** Professional Profile tab: identity header (rating · jobs done) and the account menu. */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, ErrorState, Icon, Screen, ScreenHeader } from '@/components/ui';
import { AccountHeader, AccountHeaderSkeleton, AccountMenu, type AccountMenuItem } from '@/features/settings/components/account-menu';
import { useOwnProfessionalProfile, useRefetchOnFocus } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

export default function ProfessionalAccountScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'profile', 'common']);
  const format = useFormatters();
  const query = useOwnProfessionalProfile();
  useRefetchOnFocus(query.refetch);
  const profile = query.data;

  const items: AccountMenuItem[] = [{ key: 'edit', title: t('settings:account.editProfile'), onPress: () => router.push(routes.editProfile) }];
  if (profile) {
    items.push({
      key: 'public',
      title: t('settings:account.viewPublicProfile'),
      onPress: () => router.push(routes.professionalProfile(profile.id)),
    });
  }

  const rating = profile?.stats.averageRating ?? null;

  return (
    <Screen gap="xxl" onRefresh={() => query.refetch()} testID="pro-account-screen">
      <ScreenHeader title={t('common:tabs.profile')} />
      {profile ? (
        <AccountHeader
          name={profile.displayName}
          avatarUrl={profile.avatarUrl}
          subtitle={
            <View style={styles.meta}>
              {rating !== null ? <Icon name="star" size={14} color={theme.colors.star} /> : null}
              <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.shrink}>
                {[
                  rating !== null ? format.number(rating, 1) : t('common:rating.new'),
                  t('common:pro.jobsDone', { count: profile.stats.completedJobsCount }),
                ].join(' · ')}
              </AppText>
            </View>
          }
        />
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : (
        <AccountHeaderSkeleton />
      )}
      <AccountMenu items={items} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  shrink: {
    flexShrink: 1,
  },
}));
