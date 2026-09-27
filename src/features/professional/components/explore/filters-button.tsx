import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon } from '@/components/ui';
import { makeStyles } from '@/theme';

export interface FiltersButtonProps {
  activeCount: number;
  onPress: () => void;
}

/** Pill button opening the filters sheet, with the number of active filter groups. */
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
      <Icon name="tune-variant" size={18} color={active ? 'onPrimary' : 'default'} />
      <AppText variant="captionStrong" color={active ? 'onPrimary' : 'default'}>
        {t('filtersButton')}
      </AppText>
      {active ? (
        <View style={styles.count}>
          <AppText variant="tiny" color="primary" tabular>
            {activeCount}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    minHeight: 40,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
  },
  active: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: t.spacing.xs,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
