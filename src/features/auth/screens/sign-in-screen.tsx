/**
 * Demo sign-in: pick a customer or professional demo account (no passwords). After signing in,
 * the protected routes become available and `/` redirects to the account's home tab.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  EmptyState,
  Icon,
  InlineAlert,
  QueryState,
  Screen,
  SegmentedControl,
  SkeletonCard,
  useErrorText,
  useToast,
  withAlpha,
  type IconName,
  type SegmentedOption,
} from '@/components/ui';
import { useDemoAccounts } from '@/hooks/queries/use-auth-queries';
import { makeStyles, useTheme } from '@/theme';
import { USER_ROLES, type DemoAccount, type UserRole } from '@/types/domain';

import { DemoAccountCard } from '../components/demo-account-card';
import { LanguageSwitch } from '../components/language-switch';
import { useAuthActions } from '../session-provider';

const ROLE_ICONS: Record<UserRole, IconName> = {
  customer: 'account-outline',
  professional: 'hammer-wrench',
};

const HIGHLIGHTS: readonly { key: 'verified' | 'offers' | 'chat'; icon: IconName }[] = [
  { key: 'verified', icon: 'shield-check-outline' },
  { key: 'offers', icon: 'tag-multiple-outline' },
  { key: 'chat', icon: 'message-text-outline' },
];

const SKELETON_COUNT = 3;

export default function SignInScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['auth', 'common']);
  const toast = useToast();
  const errorText = useErrorText();
  const { signInWithDemoAccount } = useAuthActions();
  const accountsQuery = useDemoAccounts();
  const [role, setRole] = useState<UserRole>('customer');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const accounts = accountsQuery.data ?? [];
  const roleOptions: SegmentedOption<UserRole>[] = USER_ROLES.map((value) => ({
    value,
    label: t(`common:roles.${value}`),
    icon: ROLE_ICONS[value],
    count: accounts.filter((account) => account.role === value).length || undefined,
  }));
  const byRole = (data: DemoAccount[]) => data.filter((account) => account.role === role);

  const signIn = async (account: DemoAccount) => {
    if (pendingUserId) return;
    setPendingUserId(account.userId);
    try {
      // On success the protected routes mount and this screen goes away.
      await signInWithDemoAccount(account.userId);
    } catch (error) {
      toast.show({ title: t('auth:signIn.errors.signInFailed'), message: errorText(error).description, tone: 'danger' });
      setPendingUserId(null);
    }
  };

  const onColor = theme.colors.onPrimary;
  const glass = withAlpha(onColor, 0.16);

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      padded={false}
      maxContentWidth={false}
      contentContainerStyle={styles.content}
      testID="sign-in-screen"
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={theme.colors.heroGradient}
        start={{ x: theme.isRTL ? 1 : 0, y: 0 }}
        end={{ x: theme.isRTL ? 0 : 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + theme.spacing.md }]}
      >
        <View style={[styles.decorCircle, styles.decorLarge, { backgroundColor: glass }]} />
        <View style={[styles.decorCircle, styles.decorSmall, { backgroundColor: glass }]} />

        <View style={styles.heroInner}>
          <View style={styles.topBar}>
            <View style={[styles.brandMark, { backgroundColor: glass }]}>
              <Icon name="hammer-wrench" size={20} color={onColor} />
            </View>
            <LanguageSwitch appearance="onColor" />
          </View>

          <View style={styles.heroText}>
            <View style={[styles.logo, { backgroundColor: glass }]}>
              <Icon name="account-hard-hat" size={34} color={onColor} />
            </View>
            <AppText variant="display" color="onPrimary" accessibilityRole="header">
              {t('common:appName')}
            </AppText>
            <AppText variant="subheading" color={withAlpha(onColor, 0.88)}>
              {t('common:tagline')}
            </AppText>
          </View>

          <View style={styles.highlights}>
            {HIGHLIGHTS.map((item) => (
              <View key={item.key} style={[styles.highlight, { backgroundColor: glass }]}>
                <Icon name={item.icon} size={16} color={onColor} />
                <AppText variant="captionStrong" color="onPrimary" numberOfLines={1}>
                  {t(`auth:signIn.highlights.${item.key}`)}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sheet}>
        <View style={styles.sheetInner}>
          <View style={styles.intro}>
            <AppText variant="title" accessibilityRole="header">
              {t('auth:signIn.title')}
            </AppText>
            <AppText variant="body" color="secondary">
              {t('auth:signIn.subtitle')}
            </AppText>
          </View>

          <View style={styles.roleBlock}>
            <SegmentedControl options={roleOptions} value={role} onChange={setRole} testID="sign-in-role" />
            <AppText variant="caption" color="muted">
              {t(`auth:signIn.roleDescriptions.${role}`)}
            </AppText>
          </View>

          <View style={styles.accounts}>
            <QueryState
              query={accountsQuery}
              loading={Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <SkeletonCard key={index} lines={2} />
              ))}
              empty={(data) => byRole(data).length === 0}
              emptyState={
                <EmptyState
                  compact
                  icon="account-search-outline"
                  title={t('auth:signIn.empty.title')}
                  description={t(`auth:signIn.empty.${role}`)}
                />
              }
            >
              {(data) =>
                byRole(data).map((account) => (
                  <DemoAccountCard
                    key={account.userId}
                    account={account}
                    loading={pendingUserId === account.userId}
                    disabled={pendingUserId !== null && pendingUserId !== account.userId}
                    onPress={() => void signIn(account)}
                  />
                ))
              }
            </QueryState>
          </View>

          <InlineAlert tone="info" icon="flask-outline" title={t('auth:signIn.demoNoteTitle')} message={t('auth:signIn.demoNote')} />
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    paddingTop: 0,
  },
  hero: {
    overflow: 'hidden',
    paddingBottom: t.spacing.huge + t.spacing.xl,
    paddingHorizontal: t.spacing.screen,
  },
  heroInner: {
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    gap: t.spacing.xxl,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: t.radii.pill,
  },
  decorLarge: {
    width: 260,
    height: 260,
    top: -90,
    end: -80,
  },
  decorSmall: {
    width: 140,
    height: 140,
    bottom: -40,
    start: -50,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    gap: t.spacing.sm,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: t.radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.spacing.sm,
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    paddingVertical: t.spacing.xs + 2,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
  },
  sheet: {
    marginTop: -t.spacing.xxxl,
    borderTopStartRadius: t.radii.xxl,
    borderTopEndRadius: t.radii.xxl,
    backgroundColor: t.colors.background,
    paddingTop: t.spacing.xxl,
    paddingHorizontal: t.spacing.screen,
  },
  sheetInner: {
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    gap: t.spacing.xl,
  },
  intro: {
    gap: t.spacing.xs,
  },
  roleBlock: {
    gap: t.spacing.sm,
  },
  accounts: {
    gap: t.spacing.md,
  },
}));
