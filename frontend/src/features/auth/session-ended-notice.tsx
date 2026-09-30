import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { sessionEnded } from '@/services/auth/session-ended';

import { useSession } from './session-provider';

/**
 * Tells the user why they are back on the entry screen when the server ended their session
 * (signed out on another device, a password reset, an expired session). Signing out on purpose
 * shows nothing. Mount once inside the toast provider; renders nothing.
 */
export function SessionEndedNotice() {
  const toast = useToast();
  const { t } = useTranslation('auth');
  const { status } = useSession();
  // When the server last ended the session, and the last time the notice was shown for.
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const shownFor = useRef<number | null>(null);

  useEffect(() => sessionEnded.subscribe(() => setEndedAt(Date.now())), []);

  const show = useEffectEvent(() => {
    toast.show({ id: 'session-ended', title: t('sessionEnded.title'), message: t('sessionEnded.message'), tone: 'warning', icon: 'logout' });
  });

  useEffect(() => {
    if (endedAt === null || status !== 'signedOut' || shownFor.current === endedAt) return;
    shownFor.current = endedAt;
    // After the sign-out's own effects, which dismiss the account's banners (RealtimeProvider).
    const timer = setTimeout(show, 0);
    return () => clearTimeout(timer);
  }, [endedAt, status]);

  return null;
}
