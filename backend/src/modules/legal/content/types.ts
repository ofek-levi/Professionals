import type { LegalSection, LegalText } from '../../../shared/contract/index.js';

/**
 * One document in one language, as written (placeholders not expanded). Rules, checked by
 * `legal-content.test.ts`: markup `**bold**` and `[label](url)` only; urls `https:`, `mailto:` or a
 * document placeholder; only the placeholders of `legal-placeholders.ts`; the same section ids, in
 * the same order, in both languages.
 */
export interface LegalDocumentContent {
  title: string;
  intro?: LegalText[];
  sections: LegalSection[];
}
