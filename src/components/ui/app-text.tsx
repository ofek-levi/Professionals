import type { ReactNode } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type Theme, type TypographyVariant } from '@/theme';
import { alignForText, getTextDirection } from '@/utils/bidi';

import { resolveColor, type ColorProp } from './colors';

export type TextAlign = 'start' | 'center' | 'end';

export interface AppTextProps extends TextProps {
  /** Typography token. Defaults to `body`. */
  variant?: TypographyVariant;
  /** Semantic color (`default`, `secondary`, `muted`, `primary`, a status tone…) or a theme color. */
  color?: ColorProp;
  /** Logical alignment; `start` (default) follows the layout direction. */
  align?: TextAlign;
  /**
   * User-written text (a request description, an offer message, a bio): without `align`, it is
   * aligned by its own language (`alignForText`), so an English description reads left-aligned in
   * the Hebrew UI and a Hebrew one right-aligned in the English UI.
   */
  userContent?: boolean;
  /** Renders with tabular (fixed width) digits – for prices, counters and times. */
  tabular?: boolean;
}

/** Large display text scales less so layouts survive accessibility font sizes. */
const MAX_FONT_SCALE: Record<TypographyVariant, number> = {
  display: 1.2,
  largeTitle: 1.2,
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

/** Plain text content of `children` when it only consists of strings and numbers, else `null`. */
function plainText(children: ReactNode): string | null {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    let text = '';
    for (const child of children) {
      if (child === null || child === undefined || typeof child === 'boolean') continue;
      const part = plainText(child as ReactNode);
      if (part === null) return null;
      text += part;
    }
    return text;
  }
  return null;
}

/**
 * Web: base direction of a text's paragraph. React Native Web renders root texts with
 * `dir="auto"`, and the browser's `auto` does not skip bidi isolates, so a Hebrew sentence that
 * starts with an isolated Latin name ("Noa L. accepted your offer…") would be laid out
 * left-to-right. Resolved here with the Unicode rules instead: the first strong character outside
 * isolates, else the layout direction. `undefined` (keep the default) on native, which applies the
 * Unicode rules itself, and for rich children.
 */
export function resolveTextDir(children: ReactNode, isRTL: boolean): 'ltr' | 'rtl' | undefined {
  if (Platform.OS !== 'web') return undefined;
  const text = plainText(children);
  if (text === null) return undefined;
  return getTextDirection(text) ?? (isRTL ? 'rtl' : 'ltr');
}

/** The only text primitive: typography, color and alignment always come from the theme. */
export function AppText({
  variant = 'body',
  color,
  align,
  userContent = false,
  tabular = false,
  style,
  maxFontSizeMultiplier,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const text = userContent && align === undefined ? plainText(rest.children) : null;
  const resolvedAlign = align ?? (text !== null ? alignForText(text, theme.isRTL) : 'start');
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_FONT_SCALE[variant]}
      {...rest}
      dir={rest.dir ?? resolveTextDir(rest.children, theme.isRTL)}
      style={[
        theme.typography[variant],
        {
          color: resolveColor(theme, color),
          textAlign: resolveTextAlign(resolvedAlign, theme),
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}
