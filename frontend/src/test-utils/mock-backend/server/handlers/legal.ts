/** `/legal/*` – the public legal documents (a short fixture: `data/legal-documents.ts`). */
import { DomainError } from '@/features/shared/domain-error';
import type { LegalDocumentResponse } from '@/types/api/legal';
import { SUPPORTED_LANGUAGES } from '@/types/domain';

import { LEGAL_DOCUMENT_TEXTS, LEGAL_EFFECTIVE_DATE, LEGAL_FIXTURE_DOCUMENTS, type LegalFixtureDocument } from '../../data/legal-documents';
import { route } from '../router';

const isFixtureDocument = (value: string): value is LegalFixtureDocument => (LEGAL_FIXTURE_DOCUMENTS as readonly string[]).includes(value);

export const legalRoutes = [
  route({
    method: 'GET',
    path: '/legal/:document',
    auth: 'public',
    handler: ({ params, query, language }): LegalDocumentResponse => {
      if (!isFixtureDocument(params.document)) throw DomainError.notFound('Legal document', params.document);
      // `?lang=` first, then `Accept-Language`.
      const lang = query.enumValue('lang', SUPPORTED_LANGUAGES) ?? language;
      return {
        document: params.document,
        version: LEGAL_EFFECTIVE_DATE,
        effectiveDate: LEGAL_EFFECTIVE_DATE,
        language: lang,
        ...LEGAL_DOCUMENT_TEXTS[params.document][lang],
      };
    },
  }),
];
