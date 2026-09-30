import type { AppLanguage } from '@/types/domain';
import type { LegalDocumentId, LegalDocumentQuery, LegalDocumentResponse } from '@/types/api/legal';
import type { ApiClient } from '../client';

export function createLegalApi(client: ApiClient) {
  return {
    /** `GET /legal/:document?lang=` – the Terms of Use, the Privacy Policy (public). */
    getDocument: (document: LegalDocumentId, language: AppLanguage, signal?: AbortSignal) =>
      client.get<LegalDocumentResponse>(`/legal/${encodeURIComponent(document)}`, {
        signal,
        query: { lang: language } satisfies LegalDocumentQuery,
      }),
  };
}
