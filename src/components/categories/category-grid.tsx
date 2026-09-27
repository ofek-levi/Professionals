import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategoryLookup } from '@/hooks/queries/use-category-catalog';
import { useLocalizedText } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CategoryId, ProfessionalCategory } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { haptics } from '../ui/haptics';
import { Icon } from '../ui/icon';
import { CategoryIcon } from './category-icon';

export interface CategoryGridProps {
  /** Categories to show (in this order). Defaults to the catalog's popular categories. */
  categoryIds?: readonly CategoryId[];
  onSelect: (id: CategoryId) => void;
  /** Tiles per row (default 4). */
  columns?: number;
  /** Maximum category tiles (the "all services" tile is extra). */
  limit?: number;
  /** Adds a trailing "All services" tile. */
  onShowAll?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Grid of category tiles (icon + localized name), e.g. "Popular services" on the home screen. */
export function CategoryGrid({ categoryIds, onSelect, columns = 4, limit, onShowAll, style }: CategoryGridProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('common');
  const lookup = useCategoryLookup();
  const localize = useLocalizedText();

  const source: ProfessionalCategory[] = categoryIds
    ? categoryIds.map((id) => lookup.getCategory(id)).filter((category): category is ProfessionalCategory => Boolean(category))
    : lookup.popularCategories;
  const items = typeof limit === 'number' ? source.slice(0, limit) : source;
  const tileWidth = `${100 / columns}%` as const;

  return (
    <View style={[styles.grid, style]}>
      {items.map((category) => {
        const name = localize(category.name);
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={name}
            onPress={() => {
              haptics.light();
              onSelect(category.id);
            }}
            style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed ? styles.pressed : null]}
          >
            <CategoryIcon categoryId={category.id} size="lg" />
            <AppText variant="label" align="center" numberOfLines={2} style={styles.name}>
              {name}
            </AppText>
          </Pressable>
        );
      })}
      {onShowAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categoryPicker.allServices')}
          onPress={() => {
            haptics.light();
            onShowAll();
          }}
          style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed ? styles.pressed : null]}
        >
          <View style={[styles.allIcon, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <Icon name="view-grid-outline" size={26} color="secondary" />
          </View>
          <AppText variant="label" align="center" numberOfLines={2} color="secondary" style={styles.name}>
            {t('categoryPicker.allServices')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -t.spacing.xs,
    rowGap: t.spacing.lg,
  },
  tile: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xs,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  name: {
    minHeight: t.typography.label.lineHeight * 2,
  },
  allIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
