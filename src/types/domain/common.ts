/**
 * Primitive building blocks shared by every domain entity.
 * All entities use stable string IDs and ISO-8601 timestamps so they map 1:1 to JSON payloads
 * returned by a real backend.
 */

/** Opaque stable identifier. */
export type EntityId = string;

/** ISO-8601 timestamp in UTC, e.g. `2026-09-27T10:30:00.000Z`. */
export type ISODateTimeString = string;

/** Calendar date without time, `YYYY-MM-DD` (local to the service location). */
export type ISODateString = string;

/** Wall-clock time `HH:mm` (24h). */
export type TimeOfDayString = string;

export const SUPPORTED_LANGUAGES = ['en', 'he'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Text that the backend delivers already localized for every supported language. */
export type LocalizedText = Record<AppLanguage, string>;

export const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface Timestamps {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
