import { useEffect, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { useFormatters } from '@/i18n/hooks';
import type { TypographyVariant } from '@/theme';
import type { CurrencyCode } from '@/types/domain';

import { AppText, type TextAlign } from './app-text';
import type { ColorProp } from './colors';

/** Current time that re-renders the caller every `intervalMs` (default 30 s). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

interface PriceTextProps {
  amount: number;
  currency: CurrencyCode | string;
  variant?: TypographyVariant;
  color?: ColorProp;
  align?: TextAlign;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

/** Locale-aware currency amount with tabular digits. */
export function PriceText({ amount, currency, variant = 'bodyStrong', color, align, style, testID }: PriceTextProps) {
  const format = useFormatters();
  return (
    <AppText variant={variant} color={color} align={align} tabular numberOfLines={1} testID={testID} style={style}>
      {format.currency(amount, currency)}
    </AppText>
  );
}
