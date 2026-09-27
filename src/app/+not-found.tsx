import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';
import { routes } from '@/lib/routes';

/** Unknown URLs (stale deep links, typos on the web). `/` redirects to the right home. */
export default function NotFoundRoute() {
  const { t } = useTranslation('common');
  const router = useRouter();
  return (
    <Screen edges={['left', 'right', 'bottom']} scroll={false} contentContainerStyle={styles.centered}>
      <EmptyState
        icon="map-marker-question-outline"
        title={t('states.notFoundTitle')}
        description={t('states.notFoundDescription')}
        actionLabel={t('screens.goHome')}
        actionIcon="home-outline"
        onAction={() => router.replace(routes.root)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: 'center' },
});
