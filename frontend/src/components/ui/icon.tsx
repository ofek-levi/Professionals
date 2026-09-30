// The icon set's own module: the package barrel would bundle every icon font on native.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '@/theme';

import { resolveColor, type ColorProp } from './colors';

/** Every MaterialCommunityIcons glyph name. */
export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Accepts known glyph names (with autocomplete) and plain strings coming from data (catalog,
 * status metadata). Unknown names render a neutral fallback glyph instead of crashing.
 */
export type IconSource = IconName | (string & {});

const FALLBACK_ICON: IconName = 'shape-outline';

function isIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(MaterialCommunityIcons.glyphMap, name);
}

function resolveIconName(name: IconSource, fallback: IconName = FALLBACK_ICON): IconName {
  return isIconName(name) ? name : fallback;
}

interface IconProps {
  name: IconSource;
  /** Glyph size in points. Defaults to 20. */
  size?: number;
  color?: ColorProp;
  /** Mirror horizontally in RTL – required for directional glyphs (chevrons, arrows, send…). */
  flipInRTL?: boolean;
  /** When set, the icon is announced by screen readers; otherwise it is decorative. */
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function Icon({ name, size = 20, color, flipInRTL = false, accessibilityLabel, style, testID }: IconProps) {
  const theme = useTheme();
  const decorative = !accessibilityLabel;
  return (
    <MaterialCommunityIcons
      name={resolveIconName(name)}
      size={size}
      color={resolveColor(theme, color)}
      style={[flipInRTL && theme.isRTL ? { transform: [{ scaleX: -1 }] } : null, style]}
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityElementsHidden={decorative}
      // The web ignores the two props above: without this, screen readers read the glyph itself.
      aria-hidden={decorative}
      testID={testID}
    />
  );
}
