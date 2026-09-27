import { isRunningInExpoGo } from 'expo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/features/auth/session-provider';
import { AppProviders, buildStackScreenOptions, useAppBootstrap } from '@/providers';
import { useTheme } from '@/theme';

// Keep the native splash screen until fonts, i18n, layout direction and the session are ready.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Custom splash options only apply to development/production builds (Expo Go warns).
if (!isRunningInExpoGo()) SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  const ready = useAppBootstrap();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <AppProviders>
      <RootStack />
    </AppProviders>
  );
}

/**
 * Every route of the app. Signed-in routes are protected: signing out removes them from the stack
 * and the entry route (`/`) redirects to the sign-in screen (and back to the role home after
 * signing in).
 */
function RootStack() {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { status } = useSession();
  const signedIn = status === 'signedIn';

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={buildStackScreenOptions(theme)}>
        <Stack.Screen name="index" options={{ headerShown: false, title: t('appName') }} />

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false, title: t('screens.signIn') }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="customer" options={{ headerShown: false, title: t('screens.home') }} />
          <Stack.Screen name="professional" options={{ headerShown: false, title: t('screens.home') }} />
          <Stack.Screen name="requests/new" options={{ title: t('screens.newRequest') }} />
          <Stack.Screen name="requests/[requestId]/index" options={{ title: t('screens.requestDetails') }} />
          <Stack.Screen name="requests/[requestId]/offer" options={{ title: t('screens.submitOffer') }} />
          <Stack.Screen name="offers/[offerId]" options={{ title: t('screens.offerDetails') }} />
          <Stack.Screen name="professionals/[professionalId]/index" options={{ title: t('screens.professionalProfile') }} />
          <Stack.Screen name="professionals/[professionalId]/reviews" options={{ title: t('screens.professionalReviews') }} />
          <Stack.Screen name="jobs/[jobId]/index" options={{ title: t('screens.jobDetails') }} />
          <Stack.Screen name="jobs/[jobId]/review" options={{ title: t('screens.leaveReview') }} />
          <Stack.Screen name="conversations/index" options={{ title: t('screens.conversations') }} />
          <Stack.Screen name="conversations/[conversationId]" options={{ title: t('screens.conversation') }} />
          <Stack.Screen name="profile/edit" options={{ title: t('screens.editProfile') }} />
          <Stack.Screen name="settings" options={{ title: t('screens.settings') }} />
        </Stack.Protected>

        <Stack.Screen name="+not-found" options={{ title: t('screens.notFound') }} />
      </Stack>
    </>
  );
}
