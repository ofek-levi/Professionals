/**
 * Header "back" for a stack screen that has nothing to go back to: a deep link, a notification
 * opened on a cold start, or a page refreshed on web. It leads to the signed-in user's home tab
 * instead of leaving the screen without a way out.
 */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui';
import { useSession } from '@/features/auth/session-provider';
import { routes } from '@/lib/routes';

function HeaderHomeButton() {
  const router = useRouter();
  const { role } = useSession();
  const { t } = useTranslation('common');
  return (
    <IconButton
      icon="arrow-left"
      flipInRTL
      accessibilityLabel={t('a11y.back')}
      onPress={() => router.replace(role ? routes.homeFor(role) : routes.root)}
      testID="header-home-back"
    />
  );
}

/** `headerLeft` renderer for stack screen options. */
export function renderHeaderHomeButton() {
  return <HeaderHomeButton />;
}
