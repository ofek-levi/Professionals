import { isRunningInExpoGo } from 'expo';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/features/auth/session-provider';
import { installBrowserBackInterceptor } from '@/features/auth/use-browser-back';
import { AppProviders, buildStackScreenOptions, renderHeaderHomeButton, useAppBootstrap } from '@/providers';
import { AppErrorBoundary } from '@/providers/app-error-boundary';
import { completeGoogleAuthRedirect } from '@/services/auth/google-auth';
import { useTheme } from '@/theme';

// Web: a Google sign-in popup that redirected back here hands its result to the opener and closes.
completeGoogleAuthRedirect();
// Web: before the router's own history listener, so the sign-up steps can take the browser's back.
installBrowserBackInterceptor();

// Keep the native splash screen until fonts, i18n, layout direction and the session are ready.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Custom splash options only apply to development/production builds (Expo Go warns).
if (!isRunningInExpoGo()) SplashScreen.setOptions({ fade: true, duration: 250 });

/** A screen that throws while rendering shows a retry screen instead of taking the app down. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorBoundary {...props} />;
}

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
 * signing in). The legal documents are open in both states.
 */
function RootStack() {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const stackOptions = buildStackScreenOptions(theme);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={({ navigation }) =>
          // Nothing to go back to (deep link, web refresh): the header offers a way home instead.
          navigation.canGoBack() ? stackOptions : { ...stackOptions, headerLeft: renderHeaderHomeButton }
        }
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: t('appName') }} />
        {/* Outside both guards: signed out (entry screen, sign-up) and signed in (Settings), and by URL on the web. */}
        <Stack.Screen name="legal/[document]" options={{ title: t('screens.legal') }} />

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false, title: t('screens.signIn') }} />
          {/* The page's own button already says "Sign in": the header keeps only the back button. */}
          <Stack.Screen name="auth/login" options={{ title: t('screens.login'), headerTitle: '' }} />
          <Stack.Screen name="auth/sign-up" options={{ title: t('screens.signUp') }} />
          <Stack.Screen name="auth/forgot-password" options={{ title: t('screens.forgotPassword') }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="customer" options={{ headerShown: false, title: t('screens.home') }} />
          <Stack.Screen name="professional" options={{ headerShown: false, title: t('screens.home') }} />
          <Stack.Screen name="requests/new" options={{ title: t('screens.newRequest') }} />
          <Stack.Screen name="requests/[requestId]/index" options={{ title: t('screens.requestDetails') }} />
          <Stack.Screen name="requests/[requestId]/offer" options={{ title: t('screens.submitOffer') }} />
          <Stack.Screen name="professionals/[professionalId]/index" options={{ title: t('screens.professionalProfile') }} />
          <Stack.Screen name="professionals/[professionalId]/reviews" options={{ title: t('screens.professionalReviews') }} />
          <Stack.Screen name="jobs/[jobId]/index" options={{ title: t('screens.jobDetails') }} />
          <Stack.Screen name="jobs/[jobId]/review" options={{ title: t('screens.leaveReview') }} />
          <Stack.Screen name="conversations/[conversationId]" options={{ title: t('screens.conversation') }} />
          <Stack.Screen name="profile/edit" options={{ title: t('screens.editProfile') }} />
          <Stack.Screen name="settings" options={{ title: t('screens.settings') }} />
          <Stack.Screen name="settings/delete-account" options={{ title: t('screens.deleteAccount') }} />
        </Stack.Protected>

        <Stack.Screen name="+not-found" options={{ title: t('screens.notFound') }} />
      </Stack>
    </>
  );
}
