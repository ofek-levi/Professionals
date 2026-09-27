import type { StatusTone } from '@/constants/tones';
import { STATUS_TONES } from '@/constants/tones';
import type { Theme } from '@/theme';

/**
 * Semantic foreground colors accepted by `AppText`, `Icon` and friends. Tones map to
 * `t.colors.tones[tone].fg`, which is tuned for contrast on both surfaces and soft tone backgrounds.
 */
export type ColorName = 'default' | 'secondary' | 'muted' | 'inverse' | 'onPrimary' | 'primary' | StatusTone;

/** A semantic color name, or a concrete color value that already comes from the theme. */
export type ColorProp = ColorName | (string & {});

const TONE_SET: ReadonlySet<string> = new Set(STATUS_TONES);

export function isStatusTone(value: string): value is StatusTone {
  return TONE_SET.has(value);
}

/** Resolves a `ColorProp` to a concrete color for the active theme. */
export function resolveColor(theme: Theme, color: ColorProp | undefined, fallback: ColorName = 'default'): string {
  const value = color ?? fallback;
  switch (value) {
    case 'default':
      return theme.colors.text;
    case 'secondary':
      return theme.colors.textSecondary;
    case 'muted':
      return theme.colors.textMuted;
    case 'inverse':
      return theme.colors.textInverse;
    case 'onPrimary':
      return theme.colors.onPrimary;
    case 'primary':
      return theme.colors.primary;
    default:
      return isStatusTone(value) ? theme.colors.tones[value].fg : value;
  }
}

/**
 * Adds alpha to a `#RRGGBB` / `#RGB` theme color (returns the input unchanged for other formats).
 * Used for translucent fills derived from tokens, e.g. map radius circles.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return color;
  const digits = match[1].length === 3 ? match[1].split('').map((d) => d + d).join('') : match[1];
  const r = parseInt(digits.slice(0, 2), 16);
  const g = parseInt(digits.slice(2, 4), 16);
  const b = parseInt(digits.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/** Tones used for deterministic avatar / placeholder colors. */
export const DECORATIVE_TONES: readonly StatusTone[] = ['brand', 'accent', 'info', 'warning', 'success', 'danger'];

/** Stable string hash (djb2) → index, for deterministic decorative colors. */
export function hashToIndex(value: string, modulo: number): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return Math.abs(hash) % Math.max(1, modulo);
}
