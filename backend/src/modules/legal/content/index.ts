/**
 * The legal documents in both languages. Publishing a new version: edit the texts (both languages,
 * same section ids) and move `effectiveDate` in `src/config/legal.ts` (OPERATIONS.md).
 */
import type { LegalDocumentId } from '../../../shared/contract/index.js';
import type { AppLanguage } from '../../../shared/domain.js';
import { accountDeletionEn } from './account-deletion.en.js';
import { accountDeletionHe } from './account-deletion.he.js';
import { privacyEn } from './privacy.en.js';
import { privacyHe } from './privacy.he.js';
import { termsEn } from './terms.en.js';
import { termsHe } from './terms.he.js';
import type { LegalDocumentContent } from './types.js';

export type { LegalDocumentContent } from './types.js';

export const LEGAL_DOCUMENTS = ['terms', 'privacy', 'account-deletion'] as const satisfies readonly LegalDocumentId[];

export const LEGAL_CONTENT: Record<LegalDocumentId, Record<AppLanguage, LegalDocumentContent>> = {
  terms: { en: termsEn, he: termsHe },
  privacy: { en: privacyEn, he: privacyHe },
  'account-deletion': { en: accountDeletionEn, he: accountDeletionHe },
};

export function isLegalDocument(value: string): value is LegalDocumentId {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(value);
}
