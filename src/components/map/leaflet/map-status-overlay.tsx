import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles } from '@/theme';

import { Skeleton } from '../../ui/skeleton';
import { EmptyState } from '../../ui/states';
import type { MapStatus } from './types';

/**
 * Covers the map page until it is ready (theme skeleton) and replaces it when it could not start
 * (a short localized note with a retry that reloads the page).
 */
export function MapStatusOverlay({ status, onRetry }: { status: MapStatus; onRetry: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation(['location', 'common']);

  if (status === 'ready') return null;
  if (status === 'loading') return <Skeleton radius={0} style={styles.fill} />;
  return (
    <View style={[styles.fill, styles.error]} accessibilityRole="alert" testID="map-error">
      <EmptyState
        compact
        icon="map-marker-off-outline"
        title={t('location:map.unavailable')}
        actionLabel={t('common:actions.tryAgain')}
        onAction={onRetry}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  fill: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  error: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceMuted,
  },
}));
