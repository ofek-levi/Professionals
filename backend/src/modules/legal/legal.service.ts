/** A legal document as served: its version and the texts with their placeholders filled. */
import type { LegalBlock, LegalDocumentId, LegalDocumentResponse } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { LEGAL_CONTENT } from './content/index.js';
import { expandPlaceholders, LEGAL_SETTINGS, placeholderValues, type LegalSettings } from './legal-placeholders.js';

function expandBlock(block: LegalBlock, expand: (text: string) => string): LegalBlock {
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', text: expand(block.text) };
    case 'list':
      return { type: 'list', items: block.items.map(expand) };
    case 'definitions':
      return { type: 'definitions', items: block.items.map((item) => ({ term: expand(item.term), text: expand(item.text) })) };
  }
}

/** `version` is the effective date: what `users.termsAcceptance.version` records at sign-up. */
export function legalDocument(
  document: LegalDocumentId,
  language: AppLanguage,
  publicApiUrl: string,
  settings: LegalSettings = LEGAL_SETTINGS,
): LegalDocumentResponse {
  const content = LEGAL_CONTENT[document][language];
  const values = placeholderValues(settings, publicApiUrl, language);
  const expand = (text: string) => expandPlaceholders(text, values);
  return {
    document,
    version: settings.effectiveDate,
    effectiveDate: settings.effectiveDate,
    language,
    title: expand(content.title),
    intro: (content.intro ?? []).map(expand),
    sections: content.sections.map((section) => ({
      id: section.id,
      heading: expand(section.heading),
      blocks: section.blocks.map((block) => expandBlock(block, expand)),
    })),
  };
}
