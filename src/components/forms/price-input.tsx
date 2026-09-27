import type { Ref } from 'react';
import type { TextInput } from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';
import { useFormatters } from '@/i18n/hooks';
import type { CurrencyCode } from '@/types/domain';

import { TextField, type TextFieldProps } from '../ui/text-field';

export interface PriceInputProps
  extends Omit<TextFieldProps, 'value' | 'onChange' | 'onChangeText' | 'keyboardType' | 'inputMode' | 'prefix' | 'ref'> {
  /** Whole currency units, or `null` when empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  currency?: CurrencyCode;
  /** Hard cap while typing (default `APP_CONFIG.maxOfferPrice`). */
  maxValue?: number;
  ref?: Ref<TextInput>;
}

/** Parses user input into whole units: keeps digits only (grouping separators are ignored). */
export function parsePriceInput(text: string): number | null {
  const digits = text.replace(/\D+/g, '');
  if (!digits) return null;
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) ? value : null;
}

/** Numeric price field with the currency symbol as prefix and locale-aware grouping (`1,250`). */
export function PriceInput({
  value,
  onChange,
  currency = APP_CONFIG.defaultCurrency,
  maxValue = APP_CONFIG.maxOfferPrice,
  ...textFieldProps
}: PriceInputProps) {
  const format = useFormatters();
  return (
    <TextField
      {...textFieldProps}
      value={value === null ? '' : format.number(value)}
      onChangeText={(text) => {
        const parsed = parsePriceInput(text);
        onChange(parsed === null ? null : Math.min(parsed, maxValue));
      }}
      prefix={format.currencySymbol(currency)}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={12}
      selectTextOnFocus
    />
  );
}
