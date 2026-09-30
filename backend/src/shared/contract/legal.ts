/** Legal documents: `GET /legal/:document` (the same texts as the public pages `/legal/*`). */
import type { AppLanguage } from '../domain.js';
import type { ISODateString } from './common.js';

export type LegalDocumentId = 'terms' | 'privacy' | 'account-deletion';

/**
 * Text with inline markup: `**bold**` and `[label](url)` links (`https:` pages, `mailto:`
 * addresses, or the public URL of one of the documents). Nothing else is marked up.
 */
export type LegalText = string;

export type LegalBlock =
  | { type: 'paragraph'; text: LegalText }
  | { type: 'list'; items: LegalText[] }
  | { type: 'definitions'; items: { term: string; text: LegalText }[] };

export interface LegalSection {
  /** Stable across languages and versions (the public pages use it as the anchor). */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

/** `GET /legal/:document?lang=en|he`, placeholders expanded. */
export interface LegalDocumentResponse {
  document: LegalDocumentId;
  /** The version a user accepts at sign-up (`users.termsAcceptance.version`). */
  version: string;
  effectiveDate: ISODateString;
  language: AppLanguage;
  title: string;
  /** Paragraphs before the first section. */
  intro: LegalText[];
  sections: LegalSection[];
}
