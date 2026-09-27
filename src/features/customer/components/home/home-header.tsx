import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, IconButton, Skeleton, useNow } from '@/components/ui';
import { useCurrentUser, useUnreadNotificationsCount } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { getGreetingPeriod } from '../../customer-home-model';

/** Greeting with the customer's first name, their default city and the notifications bell. */
export function HomeHeader() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const now = useNow(5 * 60_000);
  const userQuery = useCurrentUser();
  const unread = useUnreadNotificationsCount().data ?? 0;
  const user = userQuery.data?.user;
  const city = userQuery.data?.customerProfile?.defaultLocation?.city ?? null;
  const greeting = t(`customer:home.greeting.${getGreetingPeriod(now)}`);

  return (
    <View style={styles.header}>
      <View style={styles.texts}>
        <AppText variant="captionStrong" color="muted" numberOfLines={1}>
          {greeting}
        </AppText>
        {user ? (
          <AppText variant="display" accessibilityRole="header" numberOfLines={1}>
            {t('customer:home.hello', { name: user.firstName })}
          </AppText>
        ) : (
          <Skeleton width="55%" height={30} style={styles.nameSkeleton} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={city ? t('customer:home.cityA11y', { city }) : t('customer:home.setAddress')}
          onPress={() => router.push(routes.editProfile)}
          hitSlop={8}
          style={({ pressed }) => [styles.cityChip, pressed ? styles.pressed : null]}
        >
          <Icon name="map-marker" size={15} color="primary" />
          <AppText variant="captionStrong" color="primary" numberOfLines={1} style={styles.cityText}>
            {city ?? t('customer:home.setAddress')}
          </AppText>
          <Icon name="chevron-down" size={16} color="primary" />
        </Pressable>
      </View>
      <IconButton
        icon="bell-outline"
        variant="surface"
        size="lg"
        accessibilityLabel={t('common:tabs.notifications')}
        badgeCount={unread}
        onPress={() => router.push(routes.customer.notifications)}
        testID="home-notifications"
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    paddingTop: t.spacing.sm,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  nameSkeleton: {
    marginVertical: t.spacing.xs,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.spacing.xs,
    marginTop: t.spacing.xs,
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.md - 2,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.primarySoft,
    minHeight: 32,
  },
  cityText: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
}));
