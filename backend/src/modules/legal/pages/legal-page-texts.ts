/** Copy around the documents on the public pages (the documents bring their own texts). */
import type { LegalDocumentId } from '../../../shared/contract/index.js';
import type { AppLanguage } from '../../../shared/domain.js';

export interface LegalPageTexts {
  effectiveDate: string;
  contents: string;
  /** Label of the links between the documents. */
  documentsNav: string;
  /** Short names of the documents in those links. */
  documents: Record<LegalDocumentId, string>;
  /** The link to the page in the other language, written in that language. */
  switchLanguage: string;
  tooManyRequests: { title: string; message: string };
}

export const LEGAL_PAGE_TEXTS: Record<AppLanguage, LegalPageTexts> = {
  en: {
    effectiveDate: 'Effective date',
    contents: 'Contents',
    documentsNav: 'Legal documents',
    documents: { terms: 'Terms of Use', privacy: 'Privacy Policy', 'account-deletion': 'Deleting your account' },
    switchLanguage: 'עברית',
    tooManyRequests: { title: 'Too many requests', message: 'Please wait a minute, then load the page again.' },
  },
  he: {
    effectiveDate: 'תאריך תחילת התוקף',
    contents: 'תוכן העניינים',
    documentsNav: 'מסמכים משפטיים',
    documents: { terms: 'תנאי השימוש', privacy: 'מדיניות הפרטיות', 'account-deletion': 'מחיקת החשבון' },
    switchLanguage: 'English',
    tooManyRequests: { title: 'יותר מדי בקשות', message: 'המתינו דקה ואז טענו את הדף שוב.' },
  },
};
