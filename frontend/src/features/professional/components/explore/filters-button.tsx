import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon } from '@/components/ui';
import { makeStyles } from '@/theme';

interface FiltersButtonProps {
  activeCount: number;
  onPress: () => void;
}

/** Compact button opening the filters sheet, with the number of active filter groups. */
export function FiltersButton({ activeCount, onPress }: FiltersButtonProps) {
  const styles = useStyles();
  const { t } = useTranslation('explore');
  const active = activeCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? t('filtersButtonActive', { count: activeCount }) : t('filtersButton')}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, active ? styles.active : null, pressed ? styles.pressed : null]}
      testID="explore-filters-button"
    >
      <Icon name="tune-variant" size={16} color={active ? 'primary' : 'default'} />
      <AppText variant="captionStrong" color={active ? 'primary' : 'default'}>
        {t('filtersButton')}
      </AppText>
      {active ? (
        <View style={styles.count}>
          <AppText variant="tiny" color="onPrimary" tabular>
            {activeCount}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  // Same height and track color as the segmented control next to it.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    height: 40,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.md - 2,
    backgroundColor: t.colors.surface,
  },
  active: {
    backgroundColor: t.colors.primarySoft,
  },
  pressed: {
    opacity: 0.7,
  },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: t.spacing.xs,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
