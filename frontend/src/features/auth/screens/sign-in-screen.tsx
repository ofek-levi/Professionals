/**
 * `/sign-in` – the entry screen of a signed-out user: the brand hero with the language switch, then
 * "Create account" and "Sign in" (email or Google). After signing in, the protected routes become
 * available and `/` redirects to the account's home tab.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BrandMark, Button, Screen, withAlpha } from '@/components/ui';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import { LanguageSwitch } from '../components/language-switch';

export default function SignInScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation(['auth', 'common']);

  // This screen stays mounted under the login / sign-up screens it opens: only while it is in front
  // may its light status bar (for the blue hero) override the root one, or the icons would turn
  // white on their white headers.
  const focused = useIsFocused();

  const onColor = theme.colors.onPrimary;

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
            <BrandMark size={64} color={onColor} style={styles.logo} testID="entry-brand-mark" />
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
        <View style={styles.actions}>
          <Button
            label={t('auth:entry.createAccount')}
            fullWidth
            onPress={() => router.push(routes.auth.signUp())}
            testID="entry-create-account"
          />
          <Button
            label={t('auth:entry.signIn')}
            variant="secondary"
            fullWidth
            onPress={() => router.push(routes.auth.login)}
            testID="entry-sign-in"
          />
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  // The hero takes the height the two buttons leave (at least its own content on short screens).
  content: {
    paddingTop: 0,
  },
  hero: {
    flexGrow: 1,
    overflow: 'hidden',
    paddingBottom: t.spacing.huge + t.spacing.xxxl,
    paddingHorizontal: t.spacing.screen,
  },
  heroInner: {
    flexGrow: 1,
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    gap: t.spacing.huge,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  // Brand, name and tagline sit in the middle of the space under the language switch.
  heroText: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  logo: {
    marginBottom: t.spacing.md,
  },
  sheet: {
    marginTop: -t.spacing.xxxl,
    borderTopStartRadius: t.radii.xxl,
    borderTopEndRadius: t.radii.xxl,
    backgroundColor: t.colors.background,
    paddingTop: t.spacing.xxxl,
    paddingHorizontal: t.spacing.screen,
  },
  actions: {
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    gap: t.spacing.md,
  },
}));
