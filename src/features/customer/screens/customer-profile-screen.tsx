/**
 * Customer profile tab: identity, activity stats, default address, shortcuts and account actions.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LocationSummary } from '@/components/location';
import {
  AppText,
  Avatar,
  Button,
  Card,
  Divider,
  ErrorState,
  Icon,
  IconButton,
  ListItem,
  Screen,
  ScreenHeader,
  SectionHeader,
  Sheet,
  Skeleton,
  StatTile,
  useConfirm,
  useToast,
  type IconName,
} from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { useAuthActions } from '@/features/auth/session-provider';
import { useCustomerDashboard, useCustomerProfile, useRefetchOnFocus } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { HowItWorks } from '../components/how-it-works';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

interface MenuEntry {
  key: 'editProfile' | 'messages' | 'notifications' | 'settings' | 'help';
  icon: IconName;
  tone: StatusTone;
  onPress: () => void;
}

export default function CustomerProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const confirm = useConfirm();
  const toast = useToast();
  const { signOut } = useAuthActions();
  const profileQuery = useCustomerProfile();
  const dashboardQuery = useCustomerDashboard();
  const [helpOpen, setHelpOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  useRefetchOnFocus(profileQuery.refetch);

  const data = profileQuery.data;
  const user = data?.user;

  const leaveAccount = async (mode: 'switch' | 'signOut') => {
    const confirmed = await confirm({
      title: t(`customer:profile.${mode}.confirmTitle`),
      message: t(`customer:profile.${mode}.confirmMessage`),
      confirmLabel: t(`customer:profile.${mode}.confirm`),
      icon: mode === 'switch' ? 'account-switch-outline' : 'logout',
      destructive: mode === 'signOut',
    });
    if (!confirmed) return;
    setSigningOut(true);
    try {
      // Signing out resets the stack; the sign-in screen lists the demo accounts to switch to.
      await signOut();
    } catch {
      setSigningOut(false);
      toast.show({ title: t('customer:profile.signOutFailed'), tone: 'danger' });
    }
  };

  const menu: MenuEntry[] = [
    { key: 'editProfile', icon: 'account-edit-outline', tone: 'brand', onPress: () => router.push(routes.editProfile) },
    { key: 'messages', icon: 'message-text-outline', tone: 'accent', onPress: () => router.push(routes.conversations) },
    { key: 'notifications', icon: 'bell-outline', tone: 'warning', onPress: () => router.navigate(routes.customer.notifications) },
    { key: 'settings', icon: 'cog-outline', tone: 'neutral', onPress: () => router.push(routes.settings) },
    { key: 'help', icon: 'lifebuoy', tone: 'info', onPress: () => setHelpOpen(true) },
  ];

  return (
    <Screen
      gap="xl"
      refreshing={profileQuery.isRefetching}
      onRefresh={() => {
        void profileQuery.refetch();
        void dashboardQuery.refetch();
      }}
      testID="customer-profile"
    >
      <ScreenHeader
        title={t('common:tabs.profile')}
        actions={
          <IconButton
            icon="cog-outline"
            variant="surface"
            accessibilityLabel={t('common:screens.settings')}
            onPress={() => router.push(routes.settings)}
          />
        }
      />

      {data && user ? (
        <Card padding="xl" testID="profile-user-card">
          <View style={styles.identity}>
            <Avatar name={user.displayName} uri={user.avatarUrl} size="xl" />
            <View style={styles.identityTexts}>
              <AppText variant="title" numberOfLines={2}>
                {`${user.firstName} ${user.lastName}`.trim() || user.displayName}
              </AppText>
              <ContactLine icon="email-outline" text={user.email} />
              {user.phone ? <ContactLine icon="phone-outline" text={user.phone} /> : null}
              <ContactLine icon="calendar-account-outline" text={t('customer:profile.memberSince', { date: format.date(user.createdAt, 'monthYear') })} />
            </View>
          </View>
          <Button
            label={t('customer:profile.edit')}
            leftIcon="pencil-outline"
            variant="secondary"
            fullWidth
            style={styles.editButton}
            onPress={() => router.push(routes.editProfile)}
            testID="profile-edit"
          />
        </Card>
      ) : profileQuery.isError ? (
        <ErrorState compact error={profileQuery.error} onRetry={() => void profileQuery.refetch()} retrying={profileQuery.isRefetching} />
      ) : (
        <Card padding="xl">
          <View style={styles.identity}>
            <Skeleton circle height={88} />
            <View style={[styles.identityTexts, styles.skeletonTexts]}>
              <Skeleton width="70%" height={22} />
              <Skeleton width="90%" height={13} />
              <Skeleton width="50%" height={13} />
            </View>
          </View>
        </Card>
      )}

      {data ? (
        <View style={styles.stats}>
          <StatTile
            icon="clipboard-text-outline"
            tone="brand"
            value={data.profile.stats.requestsCount}
            label={t('customer:profile.stats.requests')}
            onPress={() => router.navigate(routes.customerRequests())}
            style={styles.stat}
          />
          <StatTile
            icon="progress-wrench"
            tone="accent"
            value={dashboardQuery.data?.activeJobsCount ?? '–'}
            label={t('customer:profile.stats.active')}
            onPress={() => router.navigate(routes.customerRequests('active'))}
            style={styles.stat}
          />
          <StatTile
            icon="check-decagram-outline"
            tone="success"
            value={data.profile.stats.completedJobsCount}
            label={t('customer:profile.stats.completed')}
            onPress={() => router.navigate(routes.customerRequests('completed'))}
            style={styles.stat}
          />
        </View>
      ) : null}

      {data ? (
        <View>
          <SectionHeader
            title={t('customer:profile.address.title')}
            icon="home-map-marker"
            actionLabel={data.profile.defaultLocation ? t('common:actions.change') : undefined}
            onAction={data.profile.defaultLocation ? () => router.push(routes.editProfile) : undefined}
          />
          <Card padding="lg">
            {data.profile.defaultLocation ? (
              <LocationSummary location={data.profile.defaultLocation} />
            ) : (
              <View style={styles.noAddress}>
                <AppText variant="body" color="secondary">
                  {t('customer:profile.address.empty')}
                </AppText>
                <Button
                  label={t('customer:profile.address.add')}
                  leftIcon="map-marker-plus-outline"
                  size="sm"
                  onPress={() => router.push(routes.editProfile)}
                />
              </View>
            )}
          </Card>
        </View>
      ) : null}

      <Card padding="none" style={styles.menu}>
        {menu.map((entry, index) => (
          <Fragment key={entry.key}>
            {index > 0 ? <Divider inset={52} /> : null}
            <ListItem
              icon={entry.icon}
              iconTone={entry.tone}
              title={t(`customer:profile.menu.${entry.key}.title`)}
              subtitle={t(`customer:profile.menu.${entry.key}.subtitle`)}
              onPress={entry.onPress}
              testID={`profile-menu-${entry.key}`}
            />
          </Fragment>
        ))}
      </Card>

      <Card padding="none" style={styles.menu}>
        <ListItem
          icon="account-switch-outline"
          iconTone="info"
          title={t('customer:profile.switch.title')}
          subtitle={t('customer:profile.switch.subtitle')}
          onPress={() => void leaveAccount('switch')}
          disabled={signingOut}
          testID="profile-switch-account"
        />
        <Divider inset={52} />
        <ListItem
          icon="logout"
          iconFlipInRTL
          destructive
          title={t('customer:profile.signOut.title')}
          onPress={() => void leaveAccount('signOut')}
          disabled={signingOut}
          showChevron={false}
          testID="profile-sign-out"
        />
      </Card>

      <AppText variant="caption" color="muted" align="center">
        {t('customer:profile.version', { version: APP_VERSION })}
      </AppText>

      <Sheet visible={helpOpen} onClose={() => setHelpOpen(false)} title={t('customer:profile.help.title')} subtitle={t('customer:profile.help.subtitle')}>
        <View style={styles.help}>
          <HowItWorks plain />
          <Card variant="flat" padding="lg">
            <View style={styles.helpRow}>
              <Icon name="shield-check-outline" size={20} color="success" />
              <AppText variant="caption" color="secondary" style={styles.flex}>
                {t('customer:profile.help.safety')}
              </AppText>
            </View>
            <View style={styles.helpRow}>
              <Icon name="email-outline" size={20} color="primary" />
              <AppText variant="caption" color="secondary" style={styles.flex}>
                {t('customer:profile.help.contact')}
              </AppText>
            </View>
          </Card>
        </View>
      </Sheet>
    </Screen>
  );
}

function ContactLine({ icon, text }: { icon: IconName; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.contact}>
      <Icon name={icon} size={15} color="muted" />
      <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
  },
  identityTexts: {
    flex: 1,
    gap: t.spacing.xs,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  editButton: {
    marginTop: t.spacing.lg,
  },
  stats: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  stat: {
    padding: t.spacing.md,
  },
  noAddress: {
    gap: t.spacing.md,
    alignItems: 'flex-start',
  },
  menu: {
    paddingHorizontal: t.spacing.lg,
  },
  help: {
    gap: t.spacing.lg,
    paddingBottom: t.spacing.lg,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
}));
