import type { StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategory, useCategoryName } from '@/i18n/hooks';
import { useTheme } from '@/theme';
import type { CategoryId } from '@/types/domain';

import { Chip, type ChipSize } from '../ui/chip';
import { Icon } from '../ui/icon';
import { categoryGroupTone } from './category-icon';

interface CategoryChipProps {
  categoryId: CategoryId | string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  size?: ChipSize;
  style?: StyleProp<ViewStyle>;
}

/** Chip showing a category's icon and localized name (filters, profile categories, selections). */
export function CategoryChip({ categoryId, selected = false, onPress, onRemove, size = 'md', style }: CategoryChipProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const category = useCategory(categoryId);
  const name = useCategoryName(categoryId) || t('category.unknown');
  const tone = theme.colors.tones[categoryGroupTone(category?.groupId)];

  return (
    <Chip
      label={name}
      selected={selected}
      onPress={onPress}
      onRemove={onRemove}
      size={size}
      style={style}
      leading={<Icon name={category?.icon ?? 'shape-outline'} size={size === 'sm' ? 14 : 16} color={selected ? theme.colors.primary : tone.fg} />}
    />
  );
}
