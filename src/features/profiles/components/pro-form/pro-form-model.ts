/**
 * View-model helpers of the professional profile form: radius options, language options, time
 * options for working hours, which fields live in the collapsed "More details" section and the
 * mapping of server `fieldErrors` onto form fields.
 */
import { APP_CONFIG } from '@/constants/app-config';
import type { ProfessionalProfileFormValues } from '@/lib/validation';
import type { TimeOfDayString } from '@/types/domain';
import { minutesToTime, timeToMinutes } from '@/utils/dates';

/** Service radius chips (km), within the configured bounds. */
export const RADIUS_PRESETS_KM: readonly number[] = [5, 10, 20, 40, 80].filter(
  (km) => km >= APP_CONFIG.minServiceRadiusKm && km <= APP_CONFIG.maxServiceRadiusKm,
);

export function clampRadiusKm(value: number): number {
  const rounded = Math.round(value);
  return Math.min(APP_CONFIG.maxServiceRadiusKm, Math.max(APP_CONFIG.minServiceRadiusKm, rounded));
}

/** Radius chips: the presets plus the current radius when it is not one of them (sorted). */
export function radiusOptions(currentKm: number | null | undefined): number[] {
  const options = new Set(RADIUS_PRESETS_KM);
  if (typeof currentKm === 'number' && Number.isFinite(currentKm)) options.add(clampRadiusKm(currentKm));
  return [...options].sort((a, b) => a - b);
}

/** Languages a professional can list (ISO 639-1); labels come from `professional:form.languageNames`. */
export const LANGUAGE_OPTIONS = ['he', 'en', 'ar', 'ru', 'am', 'fr', 'es'] as const;
type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

export function isLanguageOption(value: string): value is LanguageOption {
  return (LANGUAGE_OPTIONS as readonly string[]).includes(value);
}

/** Latest start of a working day; the end can go up to 23:30. */
export const LATEST_DAY_START: TimeOfDayString = '23:00';
export const LATEST_DAY_END: TimeOfDayString = '23:30';

/** First selectable end time for a start (30 minutes later). */
export function firstEndOption(start: TimeOfDayString): TimeOfDayString {
  return minutesToTime(Math.min(timeToMinutes(LATEST_DAY_END), safeMinutes(start) + 30));
}

function safeMinutes(time: string): number {
  try {
    return timeToMinutes(time);
  } catch {
    return 0;
  }
}

/** Moves the end after the start when a new start would make the day invalid (keeps the length when possible). */
export function adjustEndForStart(start: TimeOfDayString, end: TimeOfDayString, previousStart: TimeOfDayString): TimeOfDayString {
  const startMinutes = safeMinutes(start);
  const endMinutes = safeMinutes(end);
  if (endMinutes > startMinutes) return end;
  const length = Math.max(60, safeMinutes(end) - safeMinutes(previousStart));
  return minutesToTime(Math.min(23 * 60 + 30, startMinutes + length));
}

type ProfileFormField = keyof ProfessionalProfileFormValues;

/** Optional fields shown in the collapsed "More details" section (expanded when one has an error). */
const MORE_DETAILS_FIELDS = [
  'website',
  'businessName',
  'licenseNumber',
  'isInsured',
  'languages',
  'startingPrice',
  'yearsOfExperience',
  'availability.acceptsEmergencyCalls',
] as const;

/** Whether any of these form field paths (e.g. the keys of the form errors) is in "More details". */
export function touchesMoreDetails(fields: Iterable<string>): boolean {
  const more: readonly string[] = MORE_DETAILS_FIELDS;
  for (const field of fields) if (more.includes(field)) return true;
  return false;
}

/** Server path prefix → form field. Nested payload objects (`contact`, `business`) are flattened in the form. */
const SERVER_PATHS: [prefix: string, field: ProfileFormField | `serviceArea.${string}` | `availability.${string}`][] = [
  ['contact.phone', 'phone'],
  ['contact.email', 'email'],
  ['contact.website', 'website'],
  ['business.businessName', 'businessName'],
  ['business.licenseNumber', 'licenseNumber'],
  ['business.languages', 'languages'],
  ['business.isInsured', 'isInsured'],
  ['startingPrice', 'startingPrice'],
  ['serviceArea.radiusKm', 'serviceArea.radiusKm'],
  ['serviceArea.label', 'serviceArea.label'],
  ['serviceArea', 'serviceArea.label'],
  ['baseLocation', 'baseLocation'],
  ['availability', 'availability.days'],
  ['fullName', 'fullName'],
  ['displayName', 'displayName'],
  ['headline', 'headline'],
  ['bio', 'bio'],
  ['categoryIds', 'categoryIds'],
  ['yearsOfExperience', 'yearsOfExperience'],
];

/** Maps `ApiError.fieldErrors` of `PATCH /professional/profile` onto form field paths (first message wins). */
export function mapProfileServerFieldErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fieldErrors) return result;
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const match = SERVER_PATHS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}.`));
    const message = messages[0];
    if (!match || !message) continue;
    const field = match[1];
    if (!result[field]) result[field] = message;
  }
  return result;
}

/** First message of a (possibly nested) react-hook-form error, e.g. `baseLocation.addressLine`. */
export function firstNestedMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) return record.message;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'ref' || key === 'type' || key === 'types') continue;
    const message = firstNestedMessage(value);
    if (message) return message;
  }
  return undefined;
}
