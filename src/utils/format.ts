/**
 * Localized, display-only formatting (money, distances, dates and times).
 *
 * Every function is pure given its `language` argument: it never reads the active i18n language,
 * so results are deterministic in tests and on the server. Components normally use the bound
 * versions from `useFormatters()` (src/i18n/hooks.ts).
 *
 * Times are always shown on a 24h clock (common in Israel for both languages).
 */
import { differenceInCalendarDays, differenceInSeconds, format, formatDistanceStrict, isValid, parseISO } from 'date-fns';
import { enUS, he } from 'date-fns/locale';
import { getFixedT } from 'i18next';

import type { AppLanguage, CurrencyCode } from '@/types/domain';

/** Anything that can be turned into a `Date`: `Date`, epoch ms, ISO date-time or `YYYY-MM-DD`. */
export type DateLike = Date | string | number;

const DATE_FNS_LOCALES = { en: enUS, he } as const;

/** BCP-47 locale used for `Intl` number formatting per app language. */
const INTL_LOCALES: Record<AppLanguage, string> = { en: 'en-US', he: 'he-IL' };

/** Named date layouts. Hebrew layouts follow local conventions ("27 בספט׳ 2026"). */
export type DatePreset =
  | 'short'
  | 'medium'
  | 'long'
  | 'dayMonth'
  | 'weekday'
  | 'weekdayShort';

const DATE_PATTERNS: Record<AppLanguage, Record<DatePreset, string>> = {
  en: {
    short: 'EEE, MMM d',
    medium: 'MMM d, yyyy',
    long: 'EEEE, MMMM d, yyyy',
    dayMonth: 'MMM d',
    weekday: 'EEEE',
    weekdayShort: 'EEE',
  },
  he: {
    short: 'EEE, d בMMM',
    medium: 'd בMMM yyyy',
    long: 'EEEE, d בMMMM yyyy',
    dayMonth: 'd בMMM',
    weekday: 'EEEE',
    weekdayShort: 'EEE',
  },
};

const TIME_PATTERN = 'HH:mm';

const FALLBACK_CURRENCY_SYMBOLS: Record<CurrencyCode, string> = { ILS: '₪', USD: '$', EUR: '€' };

const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getNumberFormat(language: AppLanguage, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${language}|${JSON.stringify(options)}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALES[language], options);
    numberFormatCache.set(key, formatter);
  }
  return formatter;
}

/** Converts a `DateLike` to a `Date`. `YYYY-MM-DD` strings are interpreted as local midnight. */
function toDateValue(value: DateLike): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return parseISO(value);
}

function t(language: AppLanguage) {
  return getFixedT(language, 'common');
}

/**
 * Casing of the relative words `Today` / `Tomorrow` / `Yesterday` / `Just now`:
 * - `sentence` (default): standalone labels and the start of a sentence ("Tomorrow at 14:00").
 * - `inline`: inside a sentence ("Starts tomorrow at 14:00", "Started just now"). Languages without
 *   letter case (Hebrew) read the same either way.
 */
export type TextCasing = 'sentence' | 'inline';

type RelativeWord = 'today' | 'tomorrow' | 'yesterday' | 'justNow';

function relativeWord(language: AppLanguage, word: RelativeWord, casing: TextCasing): string {
  const translate = t(language);
  if (casing === 'inline') {
    switch (word) {
      case 'today':
        return translate('time.inline.today');
      case 'tomorrow':
        return translate('time.inline.tomorrow');
      case 'yesterday':
        return translate('time.inline.yesterday');
      case 'justNow':
        return translate('time.inline.justNow');
    }
  }
  switch (word) {
    case 'today':
      return translate('time.today');
    case 'tomorrow':
      return translate('time.tomorrow');
    case 'yesterday':
      return translate('time.yesterday');
    case 'justNow':
      return translate('time.justNow');
  }
}

// ─────────────────────────────── Numbers & money ───────────────────────────────

/** Locale aware number with grouping, e.g. `12,500` / `12,500`. */
export function formatNumber(value: number, language: AppLanguage, maximumFractionDigits = 0): string {
  return getNumberFormat(language, { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
}

/**
 * Currency amount, e.g. `₪1,250` (en) or `‏1,250 ‏₪` (he). Whole amounts are shown without
 * decimals; fractional amounts always with two.
 */
export function formatCurrency(amount: number, currency: CurrencyCode | string, language: AppLanguage): string {
  const hasFraction = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  const digits = hasFraction ? 2 : 0;
  try {
    return getNumberFormat(language, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    // Unknown currency code from a backend: degrade gracefully.
    return `${formatNumber(amount, language, digits)} ${currency}`;
  }
}

/** Currency symbol for input prefixes (`₪`, `$`, `€`). */
export function getCurrencySymbol(currency: CurrencyCode | string, language: AppLanguage): string {
  try {
    const parts = getNumberFormat(language, { style: 'currency', currency, maximumFractionDigits: 0 }).formatToParts(0);
    const symbol = parts.find((part) => part.type === 'currency')?.value;
    if (symbol) return symbol;
  } catch {
    // fall through
  }
  return FALLBACK_CURRENCY_SYMBOLS[currency as CurrencyCode] ?? currency;
}

// ─────────────────────────────── Distance ───────────────────────────────

/** Rounds for display: 0.1 km precision under 10 km, whole kilometers above. */
function displayDistanceValue(km: number): { value: number; digits: number } {
  if (km < 10) return { value: Math.max(0.1, Math.round(km * 10) / 10), digits: 1 };
  return { value: Math.round(km), digits: 0 };
}

/** Distance like `3.2 km` / `3.2 ק״מ`. Pass `away: true` for `3.2 km away` / `במרחק 3.2 ק״מ`. */
export function formatDistanceKm(km: number, language: AppLanguage, options: { away?: boolean } = {}): string {
  const { value, digits } = displayDistanceValue(Math.max(0, km));
  const formatted = formatNumber(value, language, digits);
  return options.away
    ? t(language)('units.distanceAway', { value: formatted })
    : t(language)('units.distanceKm', { value: formatted });
}

// ─────────────────────────────── Dates & times ───────────────────────────────

/** Formats a date with a named preset (see `DatePreset`). Returns `''` for invalid input. */
export function formatDate(value: DateLike, language: AppLanguage, preset: DatePreset = 'medium'): string {
  const date = toDateValue(value);
  if (!isValid(date)) return '';
  return format(date, DATE_PATTERNS[language][preset], { locale: DATE_FNS_LOCALES[language] });
}

/** Wall-clock time, always 24h: `14:30`. */
export function formatTime(value: DateLike, language: AppLanguage): string {
  const date = toDateValue(value);
  if (!isValid(date)) return '';
  return format(date, TIME_PATTERN, { locale: DATE_FNS_LOCALES[language] });
}

export interface CasingOptions {
  /** `inline` lower-cases relative words for use inside a sentence. Defaults to `sentence`. */
  casing?: TextCasing;
}

export interface FormatDateTimeOptions extends CasingOptions {
  /** Date layout when the date is not replaced by a relative day. Defaults to `short`. */
  preset?: DatePreset;
  /** Use `Today` / `Tomorrow` / `Yesterday` for nearby dates. Defaults to `true`. */
  relativeDay?: boolean;
  now?: Date;
}

/** A date that reads `Today` / `Tomorrow` / `Yesterday` when close, otherwise uses `preset`. */
export function formatDateLabel(value: DateLike, language: AppLanguage, options: FormatDateTimeOptions = {}): string {
  const date = toDateValue(value);
  if (!isValid(date)) return '';
  const { preset = 'short', relativeDay = true, now = new Date(), casing = 'sentence' } = options;
  if (relativeDay) {
    const days = differenceInCalendarDays(date, now);
    if (days === 0) return relativeWord(language, 'today', casing);
    if (days === 1) return relativeWord(language, 'tomorrow', casing);
    if (days === -1) return relativeWord(language, 'yesterday', casing);
  }
  return formatDate(date, language, preset);
}

/**
 * `Tomorrow at 14:30`, `Sun, Sep 27 at 09:00` / `מחר בשעה 14:30`; with `casing: 'inline'`:
 * `tomorrow at 14:30` (for "Starts {{date}}").
 */
export function formatDateTime(value: DateLike, language: AppLanguage, options: FormatDateTimeOptions = {}): string {
  const date = toDateValue(value);
  if (!isValid(date)) return '';
  return t(language)('time.dateAtTime', { date: formatDateLabel(date, language, options), time: formatTime(date, language) });
}

/**
 * Relative time: `Just now`, `5 minutes ago`, `in 3 hours`, `2 days ago`; older than a week falls
 * back to a short date. `casing: 'inline'` gives `just now` for use inside a sentence.
 */
export function formatRelative(value: DateLike, language: AppLanguage, now: Date = new Date(), options: CasingOptions = {}): string {
  const date = toDateValue(value);
  if (!isValid(date)) return '';
  const seconds = differenceInSeconds(date, now);
  if (Math.abs(seconds) < 60) return relativeWord(language, 'justNow', options.casing ?? 'sentence');
  if (Math.abs(seconds) >= 7 * 24 * 60 * 60) {
    return formatDate(date, language, date.getFullYear() === now.getFullYear() ? 'dayMonth' : 'medium');
  }
  return formatDistanceStrict(date, now, {
    addSuffix: true,
    locale: DATE_FNS_LOCALES[language],
    roundingMethod: 'floor',
  });
}
