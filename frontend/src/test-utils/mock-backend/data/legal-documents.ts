/**
 * A short Terms of Use and Privacy Policy in both languages, shaped like the backend's documents
 * (`backend/src/modules/legal/content`: same section ids in both languages, inline `**bold**` and
 * `[label](url)` links, placeholders already expanded as a development server expands them). The
 * real texts come from the backend; these only have to exercise the app's rendering.
 */
import type { LegalDocumentResponse } from '@/types/api/legal';
import type { AppLanguage } from '@/types/domain';

/** `PUBLIC_API_URL` of a development backend: the document links point to its public pages. */
export const LEGAL_PUBLIC_URL = 'http://localhost:4000';
export const LEGAL_EFFECTIVE_DATE = '2026-09-30';

export const LEGAL_FIXTURE_DOCUMENTS = ['terms', 'privacy'] as const;
export type LegalFixtureDocument = (typeof LEGAL_FIXTURE_DOCUMENTS)[number];

type LegalDocumentTexts = Pick<LegalDocumentResponse, 'title' | 'intro' | 'sections'>;

const EMAIL = '[legal@example.com](mailto:legal@example.com)';
const TERMS_URL = `${LEGAL_PUBLIC_URL}/legal/terms`;
const PRIVACY_URL = `${LEGAL_PUBLIC_URL}/legal/privacy`;
const AUTHORITY_URL = 'https://www.gov.il/he/departments/the_privacy_protection_authority/govil-landing-page';

export const LEGAL_DOCUMENT_TEXTS: Record<LegalFixtureDocument, Record<AppLanguage, LegalDocumentTexts>> = {
  terms: {
    en: {
      title: 'Terms of Use',
      intro: [
        'These Terms of Use govern your use of Professionals, the app and its web version.',
        `Please read them together with our [Privacy Policy](${PRIVACY_URL}).`,
      ],
      sections: [
        {
          id: 'about-us',
          heading: 'About us',
          blocks: [
            { type: 'paragraph', text: 'Professionals is operated by:' },
            {
              type: 'definitions',
              items: [
                { term: 'Operator', text: 'Example Services Ltd.' },
                { term: 'Email', text: EMAIL },
              ],
            },
          ],
        },
        {
          id: 'eligibility',
          heading: 'Who can use Professionals',
          blocks: [
            {
              type: 'list',
              items: [
                '**You must be 18 or older.** People under 18 may not open an account.',
                '**Each account has one role:** customer or professional.',
              ],
            },
          ],
        },
        {
          id: 'marketplace',
          heading: 'We are not a party to the job',
          blocks: [
            {
              type: 'paragraph',
              text: 'The agreement for a job is between the customer and the professional. No payments pass through the app.',
            },
            { type: 'paragraph', text: `The current version is always at [${TERMS_URL}](${TERMS_URL}). Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).` },
          ],
        },
      ],
    },
    he: {
      title: 'תנאי השימוש',
      intro: [
        'תנאי שימוש אלה חלים על השימוש ב-Professionals, באפליקציה ובגרסת הרשת שלה.',
        `יש לקרוא אותם יחד עם [מדיניות הפרטיות](${PRIVACY_URL}) שלנו.`,
      ],
      sections: [
        {
          id: 'about-us',
          heading: 'מי אנחנו',
          blocks: [
            { type: 'paragraph', text: 'Professionals מופעלת על ידי:' },
            {
              type: 'definitions',
              items: [
                { term: 'המפעיל', text: 'שירותים לדוגמה בע״מ' },
                { term: 'אימייל', text: EMAIL },
              ],
            },
          ],
        },
        {
          id: 'eligibility',
          heading: 'מי יכול להשתמש ב-Professionals',
          blocks: [
            {
              type: 'list',
              items: ['**השימוש מותר רק מגיל 18.** מי שטרם מלאו לו 18 לא יכול לפתוח חשבון.', '**לכל חשבון תפקיד אחד:** לקוח או בעל מקצוע.'],
            },
          ],
        },
        {
          id: 'marketplace',
          heading: 'אנחנו לא צד לעבודה',
          blocks: [
            { type: 'paragraph', text: 'ההתקשרות על כל עבודה היא בין הלקוח לבין בעל המקצוע. תשלומים לא עוברים דרך האפליקציה.' },
            { type: 'paragraph', text: `הגרסה העדכנית תמיד בכתובת [${TERMS_URL}](${TERMS_URL}). נתוני המפה © [התורמים של OpenStreetMap](https://www.openstreetmap.org/copyright).` },
          ],
        },
      ],
    },
  },
  privacy: {
    en: {
      title: 'Privacy Policy',
      intro: [`This policy explains how we handle personal data. It is part of our [Terms of Use](${TERMS_URL}).`],
      sections: [
        {
          id: 'data-we-collect',
          heading: 'Personal data we collect',
          blocks: [
            {
              type: 'list',
              items: [
                '**Account:** your name, email, phone and role.',
                '**Requests:** the job description, photos and the exact address, which professionals see only after you hire them.',
              ],
            },
          ],
        },
        {
          id: 'your-rights',
          heading: 'Your rights',
          blocks: [
            { type: 'paragraph', text: `Write to ${EMAIL} to see or correct your data. We answer within 30 days.` },
            {
              type: 'paragraph',
              text: `You may also complain to the [Privacy Protection Authority](${AUTHORITY_URL}).`,
            },
          ],
        },
      ],
    },
    he: {
      title: 'מדיניות הפרטיות',
      intro: [`מדיניות זו מסבירה איך אנחנו מטפלים במידע אישי. היא חלק מ[תנאי השימוש](${TERMS_URL}) שלנו.`],
      sections: [
        {
          id: 'data-we-collect',
          heading: 'המידע האישי שאנחנו אוספים',
          blocks: [
            {
              type: 'list',
              items: [
                '**חשבון:** השם, האימייל, הטלפון והתפקיד שלכם.',
                '**בקשות:** תיאור העבודה, תמונות והכתובת המדויקת, שבעלי מקצוע רואים רק אחרי שבחרתם בהם.',
              ],
            },
          ],
        },
        {
          id: 'your-rights',
          heading: 'הזכויות שלכם',
          blocks: [
            { type: 'paragraph', text: `כדי לעיין במידע או לתקן אותו, כתבו אל ${EMAIL}. נשיב תוך 30 יום.` },
            { type: 'paragraph', text: `אפשר גם להגיש תלונה ל[רשות להגנת הפרטיות](${AUTHORITY_URL}).` },
          ],
        },
      ],
    },
  },
};
