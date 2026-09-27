import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { CategoryGroupId } from '@/constants/professional-categories';
import type { StatusTone } from '@/constants/tones';
import { useCategory } from '@/i18n/hooks';
import { useTheme } from '@/theme';
import type { CategoryId } from '@/types/domain';

import { Icon, type IconSource } from '../ui/icon';

export type CategoryIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<CategoryIconSize, { box: number; icon: number; radius: number }> = {
  xs: { box: 28, icon: 16, radius: 8 },
  sm: { box: 36, icon: 20, radius: 10 },
  md: { box: 44, icon: 24, radius: 12 },
  lg: { box: 56, icon: 28, radius: 16 },
  xl: { box: 72, icon: 36, radius: 20 },
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

export interface CategoryIconProps {
  categoryId?: CategoryId | string | null;
  /** Explicit icon/group (e.g. for group headers); otherwise taken from the catalog entry. */
  icon?: IconSource;
  groupId?: string;
  size?: CategoryIconSize;
  /** Solid, high-contrast style for selected states. */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Category glyph inside a soft rounded square tinted by its catalog group. */
export function CategoryIcon({ categoryId, icon, groupId, size = 'md', selected = false, style }: CategoryIconProps) {
  const theme = useTheme();
  const category = useCategory(categoryId);
  const tone = theme.colors.tones[categoryGroupTone(groupId ?? category?.groupId)];
  const { box, icon: iconSize, radius } = SIZES[size];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: box,
          height: box,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? tone.solid : tone.bg,
        },
        style,
      ]}
    >
      <Icon name={icon ?? category?.icon ?? 'shape-outline'} size={iconSize} color={selected ? theme.colors.onPrimary : tone.fg} />
    </View>
  );
}
