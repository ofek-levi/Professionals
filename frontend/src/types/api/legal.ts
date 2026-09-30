import type { AppLanguage, ISODateString } from '../domain';

/** The documents `GET /legal/:document` serves (the app shows `terms` and `privacy`). */
export type LegalDocumentId = 'terms' | 'privacy' | 'account-deletion';

/**
 * Document text with inline markup: `**bold**` and `[label](url)` links (`https:` web pages,
 * `mailto:` addresses). Nothing else is marked up.
 */
export type LegalText = string;

export type LegalBlock =
  | { type: 'paragraph'; text: LegalText }
  | { type: 'list'; items: LegalText[] }
  | { type: 'definitions'; items: { term: string; text: LegalText }[] };

export interface LegalSection {
  /** Stable across languages and versions (e.g. `data-we-collect`). */
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

/** `GET /legal/:document?lang=en|he` – public (signed out too); 404 for an unknown document. */
export interface LegalDocumentResponse {
  document: LegalDocumentId;
  /** The version a user accepts at sign-up. */
  version: string;
  effectiveDate: ISODateString;
  /** The language of the texts (the `lang` asked for). */
  language: AppLanguage;
  title: string;
  /** Paragraphs before the first section. */
  intro?: LegalText[];
  sections: LegalSection[];
}

/** The query string of `GET /legal/:document`. */
export interface LegalDocumentQuery {
  lang: AppLanguage;
}
