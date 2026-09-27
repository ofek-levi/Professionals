import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type Theme, type TypographyVariant } from '@/theme';

import { resolveColor, type ColorProp } from './colors';

export type TextAlign = 'start' | 'center' | 'end';

export interface AppTextProps extends TextProps {
  /** Typography token. Defaults to `body`. */
  variant?: TypographyVariant;
  /** Semantic color (`default`, `secondary`, `muted`, `primary`, a status tone…) or a theme color. */
  color?: ColorProp;
  /** Logical alignment; `start` (default) follows the layout direction. */
  align?: TextAlign;
  /** Renders with tabular (fixed width) digits – for prices, counters and times. */
  tabular?: boolean;
}

/** Large display text scales less so layouts survive accessibility font sizes. */
const MAX_FONT_SCALE: Record<TypographyVariant, number> = {
  display: 1.2,
  title: 1.3,
  heading: 1.35,
  subheading: 1.4,
  body: 1.5,
  bodyStrong: 1.5,
  caption: 1.5,
  captionStrong: 1.5,
  label: 1.4,
  tiny: 1.3,
};

/**
 * Maps a logical alignment to `textAlign`. Native mirrors `left`/`right` itself in RTL
 * (`swapLeftAndRightInRTL`), the web does not, so we resolve it from the theme direction there.
 */
export function resolveTextAlign(align: TextAlign, theme: Theme): TextStyle['textAlign'] {
  if (align === 'center') return 'center';
  const start = align === 'start';
  if (Platform.OS === 'web' && theme.isRTL) return start ? 'right' : 'left';
  return start ? 'left' : 'right';
}

/** The only text primitive: typography, color and alignment always come from the theme. */
export function AppText({
  variant = 'body',
  color,
  align = 'start',
  tabular = false,
  style,
  maxFontSizeMultiplier,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_FONT_SCALE[variant]}
      {...rest}
      style={[
        theme.typography[variant],
        {
          color: resolveColor(theme, color),
          textAlign: resolveTextAlign(align, theme),
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
