import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { CategoryGroupId } from '@/constants/professional-categories';
import type { StatusTone } from '@/constants/tones';
import { useCategory } from '@/i18n/hooks';
import { useTheme } from '@/theme';
import type { CategoryId } from '@/types/domain';

import { Icon } from '../ui/icon';

type CategoryIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<CategoryIconSize, { box: number; icon: number; radius: number }> = {
  xs: { box: 28, icon: 16, radius: 8 },
  sm: { box: 36, icon: 20, radius: 11 },
  md: { box: 44, icon: 22, radius: 13 },
  lg: { box: 56, icon: 26, radius: 16 },
  xl: { box: 72, icon: 32, radius: 20 },
};

/** Each catalog group has its own accent so categories are recognizable at a glance. */
const GROUP_TONES: Record<CategoryGroupId, StatusTone> = {
  home_repairs: 'brand',
  construction_renovation: 'warning',
  moving_transportation: 'accent',
  other_services: 'info',
};

export function categoryGroupTone(groupId: string | null | undefined): StatusTone {
  return groupId && Object.prototype.hasOwnProperty.call(GROUP_TONES, groupId) ? GROUP_TONES[groupId as CategoryGroupId] : 'neutral';
}

interface CategoryIconProps {
  categoryId?: CategoryId | string | null;
  size?: CategoryIconSize;
  style?: StyleProp<ViewStyle>;
}

/** Category glyph inside a soft rounded square, subtly tinted by its catalog group. */
export function CategoryIcon({ categoryId, size = 'md', style }: CategoryIconProps) {
  const theme = useTheme();
  const category = useCategory(categoryId);
  const tone = theme.colors.tones[categoryGroupTone(category?.groupId)];
  const { box, icon: iconSize, radius } = SIZES[size];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: box, height: box, borderRadius: radius, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.bg }, style]}
    >
      <Icon name={category?.icon ?? 'shape-outline'} size={iconSize} color={tone.fg} />
    </View>
  );
}
