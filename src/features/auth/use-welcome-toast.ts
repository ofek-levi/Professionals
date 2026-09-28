import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import type { User } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

/**
 * The toast greeting a user who just signed in ("Welcome back, Noa") or created an account
 * ("Welcome, Maya" + what to do first). The toast outlives the auth screen, which unmounts as soon
 * as the session starts.
 */
export function useWelcomeToast(): (user: User, kind: 'signIn' | 'signUp') => void {
  const toast = useToast();
  const { t } = useTranslation('auth');
  return (user, kind) => {
    const name = isolateText(user.firstName || user.displayName);
    if (kind === 'signIn') {
      toast.show({ id: 'welcome', title: t('login.welcomeBack', { name }), tone: 'success' });
    } else {
      toast.show({ id: 'welcome', title: t('signUp.welcome', { name }), message: t(`signUp.welcomeMessage.${user.role}`), tone: 'success' });
    }
  };
}
