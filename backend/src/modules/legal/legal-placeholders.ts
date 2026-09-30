/**
 * Placeholders of the legal texts (`{{contactEmail}}`, …), filled from `src/config/legal.ts` and
 * `PUBLIC_API_URL` when a document is served. Staging/production refuse to start while an operator
 * field is empty (`assertLegalConfigured`); development shows a visible placeholder instead.
 */
import { LEGAL_CONFIG } from '../../config/legal.js';
import type { LegalDocumentId } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';

export const LEGAL_PLACEHOLDERS = [
  'operatorName',
  'operatorRegistration',
  'operatorAddress',
  'contactEmail',
  'effectiveDate',
  'termsUrl',
  'privacyUrl',
  'deletionUrl',
  'logRetentionDays',
  'backupRetentionDays',
] as const;
export type LegalPlaceholder = (typeof LEGAL_PLACEHOLDERS)[number];

/** `LEGAL_CONFIG` with its literal types widened (the values change when the owner fills it in). */
export interface LegalSettings {
  operator: {
    name: Record<AppLanguage, string>;
    registrationNumber: string;
    address: Record<AppLanguage, string>;
    email: string;
  };
  effectiveDate: string;
  retention: { serverLogsDays: number; backupsDays: number };
}

export const LEGAL_SETTINGS: LegalSettings = LEGAL_CONFIG;

const CONFIG_FILE = 'backend/src/config/legal.ts';

const MISSING: Record<AppLanguage, { name: string; address: string }> = {
  en: { name: `[operator name — set in ${CONFIG_FILE}]`, address: `[operator address — set in ${CONFIG_FILE}]` },
  he: { name: `[שם המפעיל — יש להגדיר ב-${CONFIG_FILE}]`, address: `[כתובת המפעיל — יש להגדיר ב-${CONFIG_FILE}]` },
};
/** An address, so that `[{{contactEmail}}](mailto:{{contactEmail}})` stays a working link. */
const MISSING_EMAIL = 'operator-email-not-set@example.invalid';

const DATE_LOCALES: Record<AppLanguage, string> = { en: 'en-IL', he: 'he-IL' };

/** `2026-09-30` → "30 September 2026" / "30 בספטמבר 2026". */
export function formatLegalDate(isoDate: string, language: AppLanguage): string {
  const format = new Intl.DateTimeFormat(DATE_LOCALES[language], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return format.format(new Date(`${isoDate}T00:00:00Z`));
}

/**
 * "(Company No. 51-…)" / "(ח.פ. 51-…)", or nothing when not set. Israeli corporation numbers start
 * with 5; any other number is a licensed dealer's business id (ע.מ.).
 */
function registration(number: string, language: AppLanguage): string {
  const value = number.trim();
  if (!value) return '';
  const company = value.startsWith('5');
  const label = language === 'he' ? (company ? 'ח.פ.' : 'ע.מ.') : company ? 'Company No.' : 'Licensed Dealer No.';
  return `(${label} ${value})`;
}

/** The public page of each document (the URLs to give to the app stores and Google). */
export function legalPageUrls(publicApiUrl: string): Record<LegalDocumentId, string> {
  return {
    terms: `${publicApiUrl}/legal/terms`,
    privacy: `${publicApiUrl}/legal/privacy`,
    'account-deletion': `${publicApiUrl}/legal/account-deletion`,
  };
}

export function placeholderValues(settings: LegalSettings, publicApiUrl: string, language: AppLanguage): Record<LegalPlaceholder, string> {
  const { operator, retention } = settings;
  const urls = legalPageUrls(publicApiUrl);
  return {
    operatorName: operator.name[language].trim() || MISSING[language].name,
    operatorRegistration: registration(operator.registrationNumber, language),
    operatorAddress: operator.address[language].trim() || MISSING[language].address,
    contactEmail: operator.email.trim() || MISSING_EMAIL,
    effectiveDate: formatLegalDate(settings.effectiveDate, language),
    termsUrl: urls.terms,
    privacyUrl: urls.privacy,
    deletionUrl: urls['account-deletion'],
    logRetentionDays: String(retention.serverLogsDays),
    backupRetentionDays: String(retention.backupsDays),
  };
}

const PLACEHOLDER = /( ?)\{\{(\w+)\}\}/g;

function isPlaceholder(name: string): name is LegalPlaceholder {
  return (LEGAL_PLACEHOLDERS as readonly string[]).includes(name);
}

/**
 * Fills the known placeholders of `text`. An empty value also drops the space before it
 * ("{{operatorName}} {{operatorRegistration}}" without a number). Unknown names stay as written, so
 * the content tests catch them.
 */
export function expandPlaceholders(text: string, values: Record<LegalPlaceholder, string>): string {
  return text.replace(PLACEHOLDER, (match, space: string, name: string) => {
    if (!isPlaceholder(name)) return match;
    const value = values[name];
    return value ? `${space}${value}` : '';
  });
}
