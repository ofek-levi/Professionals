/**
 * "Continue with Google": a neutral outline button that opens Google's sign-in (expo-auth-session)
 * and passes Google's `id_token` on to `useGoogleAuth()`. Rendered only where Google sign-in is
 * configured (`useGoogleSignInAvailable()`); there is no stand-in elsewhere.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, useToast } from '@/components/ui';
import { googleAuthConfig } from '@/services/auth/google-auth';
import { useRealGoogleIdToken } from '@/services/auth/use-real-google-id-token';

import { GoogleLogo } from './google-logo';

/** Whether "Continue with Google" can be offered: a Google client id is set for this platform. */
export function useGoogleSignInAvailable(): boolean {
  return googleAuthConfig.available;
}

interface GoogleSignInButtonProps {
  /** Receives Google's id token. */
  onIdToken: (idToken: string) => void;
  /** The token is being exchanged with the backend. */
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function GoogleSignInButton({ onIdToken, loading = false, disabled = false, testID }: GoogleSignInButtonProps) {
  const { t } = useTranslation('auth');
  const toast = useToast();
  const google = useRealGoogleIdToken();
  const [prompting, setPrompting] = useState(false);
  // Synchronous: a double tap must not open Google's sign-in twice.
  const promptOpen = useRef(false);

  const promptGoogle = async () => {
    if (promptOpen.current) return;
    promptOpen.current = true;
    setPrompting(true);
    try {
      const idToken = await google.prompt();
      if (idToken) onIdToken(idToken);
    } catch {
      // Google's sign-in didn't complete (popup blocked, no connection, a browser error…). The
      // backend never saw a token, so this is not INVALID_GOOGLE_TOKEN (that's the screen's
      // error when `POST /auth/google` answers 401).
      toast.show({ title: t('google.promptFailedTitle'), message: t('google.promptFailedMessage'), tone: 'danger' });
    } finally {
      promptOpen.current = false;
      setPrompting(false);
    }
  };

  if (!google.isAvailable) return null;

  return (
    <Button
      label={t('google.continue')}
      variant="outline"
      leftElement={<GoogleLogo />}
      fullWidth
      loading={loading || prompting}
      disabled={disabled || !google.isReady}
      onPress={() => void promptGoogle()}
      testID={testID}
    />
  );
}
