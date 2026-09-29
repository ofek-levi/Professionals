/**
 * `/sign-in` – the entry screen of a signed-out user: "Create account" and "Sign in" (email or
 * Google), then – with the in-app mock backend – the demo account picker (a customer or
 * professional demo account, no password). After signing in, the protected routes become
 * available and `/` redirects to the account's home tab.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  EmptyState,
  Icon,
  QueryState,
  Screen,
  SegmentedControl,
  SkeletonCard,
  useErrorText,
  useToast,
  withAlpha,
  type SegmentedOption,
} from '@/components/ui';
import { useDemoTools } from '@/features/settings/use-demo-tools';
import { useDemoAccounts } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import { USER_ROLES, type DemoAccount, type UserRole } from '@/types/domain';

import { DemoAccountCard } from '../components/demo-account-card';
import { LanguageSwitch } from '../components/language-switch';
import { ROLE_ICONS } from '../components/role-option-card';
import { useAuthActions } from '../session-provider';

const SKELETON_COUNT = 3;

export default function SignInScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation(['auth', 'common']);
  // Demo accounts only exist in the in-app mock backend.
  const { isAvailable: demoAccountsAvailable } = useDemoTools();
  // A demo account is signing in: nothing else can start meanwhile (it would be replaced by the
  // account's home as soon as the session starts).
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const demoSigningIn = pendingUserId !== null;

  // This screen stays mounted under the login / sign-up screens it opens: only while it is in front
  // may its light status bar (for the blue hero) override the root one, or the icons would turn
  // white on their white headers.
  const focused = useIsFocused();

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
      {focused ? <StatusBar style="light" /> : null}
      <LinearGradient
        colors={theme.colors.heroGradient}
        start={{ x: theme.isRTL ? 1 : 0, y: 0 }}
        end={{ x: theme.isRTL ? 0 : 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + theme.spacing.md }]}
      >
        <View style={styles.heroInner}>
          <View style={styles.topBar}>
            <LanguageSwitch appearance="onColor" />
          </View>

          <View style={styles.heroText}>
            <View style={[styles.logo, { backgroundColor: glass }]}>
              <Icon name="account-hard-hat" size={32} color={onColor} />
            </View>
            <AppText variant="display" color="onPrimary" accessibilityRole="header">
              {t('common:appName')}
            </AppText>
            <AppText variant="subheading" color={withAlpha(onColor, 0.88)}>
              {t('common:tagline')}
            </AppText>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sheet}>
        <View style={styles.sheetInner}>
          <View style={styles.actions}>
            <Button
              label={t('auth:entry.createAccount')}
              fullWidth
              disabled={demoSigningIn}
              onPress={() => router.push(routes.auth.signUp())}
              testID="entry-create-account"
            />
            <Button
              label={t('auth:entry.signIn')}
              variant="secondary"
              fullWidth
              disabled={demoSigningIn}
              onPress={() => router.push(routes.auth.login)}
              testID="entry-sign-in"
            />
          </View>

          {demoAccountsAvailable ? <DemoAccountPicker pendingUserId={pendingUserId} onPendingChange={setPendingUserId} /> : null}
        </View>
      </View>
    </Screen>
  );
}

interface DemoAccountPickerProps {
  /** The demo account signing in right now, if any. */
  pendingUserId: string | null;
  onPendingChange: (userId: string | null) => void;
}

/** "Or try a demo account": a Customer / Professional switch and the demo accounts of that role. */
function DemoAccountPicker({ pendingUserId, onPendingChange: setPendingUserId }: DemoAccountPickerProps) {
  const styles = useStyles();
  const { t } = useTranslation(['auth', 'common']);
  const toast = useToast();
  const errorText = useErrorText();
  const { signInWithDemoAccount } = useAuthActions();
  const accountsQuery = useDemoAccounts();
  const [role, setRole] = useState<UserRole>('customer');

  const roleOptions: SegmentedOption<UserRole>[] = USER_ROLES.map((value) => ({
    value,
    label: t(`common:roles.${value}`),
    icon: ROLE_ICONS[value],
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

  return (
    <>
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

      <AppText variant="caption" color="muted" align="center">
        {t('auth:signIn.demoNote')}
      </AppText>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    paddingTop: 0,
  },
  hero: {
    overflow: 'hidden',
    paddingBottom: t.spacing.huge + t.spacing.md,
    paddingHorizontal: t.spacing.screen,
  },
  heroInner: {
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    gap: t.spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
    gap: t.spacing.xxl,
  },
  actions: {
    gap: t.spacing.md,
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
