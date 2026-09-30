import { skipToken, useQuery } from '@tanstack/react-query';

import { useAppLanguage } from '@/i18n/hooks';
import { api } from '@/services/api';
import type { LegalDocumentId } from '@/types/api/legal';

import { queryKeys } from './query-keys';

/** As long as the server lets caches keep a document (`Cache-Control: max-age=300`). */
const LEGAL_STALE_TIME_MS = 5 * 60_000;

/**
 * `GET /legal/:document?lang=` – a legal document in the app's language (another language is
 * another query). Public: it works signed out too. Idle while `document` is `null`.
 */
export function useLegalDocument(document: LegalDocumentId | null) {
  const language = useAppLanguage();
  return useQuery({
    queryKey: queryKeys.legal.document(document ?? '', language),
    queryFn: document ? ({ signal }) => api.legal.getDocument(document, language, signal) : skipToken,
    staleTime: LEGAL_STALE_TIME_MS,
  });
}
