/**
 * "Continue with Google": a neutral outline button that produces a Google id token for
 * `useGoogleAuth()`.
 * - Real mode (a Google client id is configured for this platform): opens Google's sign-in through
 *   expo-auth-session and passes on Google's `id_token`.
 * - Simulated mode (demo): opens our own "Continue with Google (demo)" sheet and passes on a demo
 *   token of the chosen sample identity.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, useToast } from '@/components/ui';
import { useDemoTools } from '@/features/settings/use-demo-tools';
import { googleAuthConfig } from '@/services/auth/google-auth';
import { useRealGoogleIdToken } from '@/services/auth/use-real-google-id-token';

import { GoogleLogo } from './google-logo';
import { SimulatedGoogleSheet } from './simulated-google-sheet';

/**
 * Whether "Continue with Google" can be offered: real Google sign-in is configured, or the app runs
 * on the in-app mock backend (which accepts demo tokens). A real backend without Google client ids
 * would reject the demo tokens, so the button is hidden there.
 */
export function useGoogleSignInAvailable(): boolean {
  const { isAvailable: mockBackend } = useDemoTools();
  return googleAuthConfig.mode === 'google' || mockBackend;
}

interface GoogleSignInButtonProps {
  /** Receives Google's id token (real mode) or a demo id token (simulated mode). */
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
  const [sheetOpen, setSheetOpen] = useState(false);
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

  return (
    <>
      <Button
        label={t('google.continue')}
        variant="outline"
        leftElement={<GoogleLogo />}
        fullWidth
        loading={loading || prompting}
        disabled={disabled || (google.isAvailable && !google.isReady)}
        onPress={() => {
          if (google.isAvailable) void promptGoogle();
          else setSheetOpen(true);
        }}
        testID={testID}
      />
      {google.isAvailable ? null : (
        <SimulatedGoogleSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onIdToken={onIdToken} />
      )}
    </>
  );
}
