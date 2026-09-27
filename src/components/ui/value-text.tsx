import { useEffect, useState } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useFormatters } from '@/i18n/hooks';
import { useTheme, type TypographyVariant } from '@/theme';
import type { CurrencyCode } from '@/types/domain';
import type { DateLike, TextCasing } from '@/utils/format';

import { AppText, type TextAlign } from './app-text';
import type { ColorProp } from './colors';
import { Icon, type IconSource } from './icon';

/** Current time that re-renders the caller every `intervalMs` (default 30 s). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export interface PriceTextProps {
  amount: number;
  currency: CurrencyCode | string;
  variant?: TypographyVariant;
  color?: ColorProp;
  /** Text before the amount, e.g. `t('…from')` → "From ₪250". */
  prefix?: string;
  strikethrough?: boolean;
  align?: TextAlign;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

/** Locale-aware currency amount with tabular digits. */
export function PriceText({ amount, currency, variant = 'bodyStrong', color, prefix, strikethrough = false, align, style, testID }: PriceTextProps) {
  const format = useFormatters();
  const value = format.currency(amount, currency);
  return (
    <AppText
      variant={variant}
      color={color}
      align={align}
      tabular
      numberOfLines={1}
      testID={testID}
      style={[strikethrough ? { textDecorationLine: 'line-through' } : null, style]}
    >
      {prefix ? `${prefix} ${value}` : value}
    </AppText>
  );
}

export interface TimeAgoProps {
  date: DateLike;
  variant?: TypographyVariant;
  color?: ColorProp;
  /** Refresh interval (default 30 s). */
  refreshMs?: number;
  /** `inline` when the time continues a sentence ("Posted just now"). Defaults to `sentence`. */
  casing?: TextCasing;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

/** Relative time ("5 minutes ago" / "לפני 5 דקות") that keeps itself up to date. */
export function TimeAgo({ date, variant = 'caption', color = 'muted', refreshMs, casing, style, testID }: TimeAgoProps) {
  const format = useFormatters();
  const now = useNow(refreshMs);
  return (
    <AppText variant={variant} color={color} numberOfLines={1} style={style} testID={testID}>
      {format.relative(date, now, { casing })}
    </AppText>
  );
}

export interface DistanceTextProps {
  km: number;
  /** "3.2 km away" instead of "3.2 km". */
  away?: boolean;
  icon?: IconSource | null;
  variant?: TypographyVariant;
  color?: ColorProp;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function DistanceText({ km, away = false, icon = 'map-marker-distance', variant = 'caption', color = 'secondary', style, testID }: DistanceTextProps) {
  const format = useFormatters();
  const theme = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }, style]} testID={testID}>
      {icon ? <Icon name={icon} size={16} color={color} /> : null}
      <AppText variant={variant} color={color} tabular numberOfLines={1}>
        {format.distance(km, { away })}
      </AppText>
    </View>
  );
}
