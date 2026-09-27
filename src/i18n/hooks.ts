/**
 * Localization hooks shared by every screen and component.
 */
import { useTranslation } from 'react-i18next';

import { useCategoryLookup } from '@/hooks/queries/use-category-catalog';
import type { AppLanguage, CategoryId, CurrencyCode, LocalizedText, ProfessionalCategory } from '@/types/domain';
import {
  formatCurrency,
  formatDate,
  formatDateLabel,
  formatDateTime,
  formatDayLabel,
  formatDistanceKm,
  formatDuration,
  formatNumber,
  formatRelative,
  formatTime,
  getCurrencySymbol,
  type CasingOptions,
  type DateLike,
  type DatePreset,
  type FormatDateTimeOptions,
} from '@/utils/format';

import { isSupportedLanguage } from './index';

/** The active UI language (`en` | `he`); re-renders when it changes. */
export function useAppLanguage(): AppLanguage {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  return isSupportedLanguage(language) ? language : 'en';
}

/** Picks the string for `language`, falling back to English, then to any non-empty value. */
export function pickLocalizedText(text: LocalizedText | null | undefined, language: AppLanguage): string {
  if (!text) return '';
  return text[language] || text.en || Object.values(text).find(Boolean) || '';
}

/** Returns a resolver for backend-delivered `LocalizedText` in the active language. */
export function useLocalizedText(): (text: LocalizedText | null | undefined) => string {
  const language = useAppLanguage();
  return (text) => pickLocalizedText(text, language);
}

/** Catalog entry for a category id (from the live catalog). */
export function useCategory(id: CategoryId | string | null | undefined): ProfessionalCategory | undefined {
  return useCategoryLookup().getCategory(id);
}

/** Localized category name; empty string when the id is unknown. */
export function useCategoryName(id: CategoryId | string | null | undefined): string {
  const category = useCategory(id);
  const language = useAppLanguage();
  return category ? pickLocalizedText(category.name, language) : '';
}

/** `utils/format` functions bound to the active language. */
export interface Formatters {
  language: AppLanguage;
  number: (value: number, maximumFractionDigits?: number) => string;
  currency: (amount: number, currency: CurrencyCode | string) => string;
  currencySymbol: (currency: CurrencyCode | string) => string;
  distance: (km: number, options?: { away?: boolean }) => string;
  date: (value: DateLike, preset?: DatePreset) => string;
  /** `Today` / `Tomorrow` / `Yesterday` when close, otherwise the preset date. */
  dateLabel: (value: DateLike, options?: FormatDateTimeOptions) => string;
  time: (value: DateLike) => string;
  dateTime: (value: DateLike, options?: FormatDateTimeOptions) => string;
  /** `options.casing: 'inline'` for use inside a sentence ("Started just now"). */
  relative: (value: DateLike, now?: Date, options?: CasingOptions) => string;
  dayLabel: (value: DateLike, now?: Date, options?: CasingOptions) => string;
  duration: (minutes: number, style?: 'long' | 'short') => string;
}

export function useFormatters(): Formatters {
  const language = useAppLanguage();
  return {
    language,
    number: (value, digits) => formatNumber(value, language, digits),
    currency: (amount, currency) => formatCurrency(amount, currency, language),
    currencySymbol: (currency) => getCurrencySymbol(currency, language),
    distance: (km, options) => formatDistanceKm(km, language, options),
    date: (value, preset) => formatDate(value, language, preset),
    dateLabel: (value, options) => formatDateLabel(value, language, options),
    time: (value) => formatTime(value, language),
    dateTime: (value, options) => formatDateTime(value, language, options),
    relative: (value, now, options) => formatRelative(value, language, now, options),
    dayLabel: (value, now, options) => formatDayLabel(value, language, now, options),
    duration: (minutes, style) => formatDuration(minutes, language, style),
  };
}
