import type { LegalDocumentId, LegalDocumentResponse } from '@/types/api/legal';

import { LEGAL_FIXTURE_DOCUMENTS } from '../data/legal-documents';
import { createTestEnvironment, expectApiError } from '../testing/test-server';

describe('GET /legal/:document', () => {
  const env = createTestEnvironment();
  const anonymous = env.as(null);

  it.each(LEGAL_FIXTURE_DOCUMENTS)('serves %s in both languages with the same sections', async (document) => {
    const en = await anonymous.legal.getDocument(document, 'en');
    const he = await anonymous.legal.getDocument(document, 'he');
    expect(en).toMatchObject({ document, language: 'en', version: '2026-09-30', effectiveDate: '2026-09-30' });
    expect(he).toMatchObject({ document, language: 'he', version: en.version });
    expect(he.sections.map((section) => section.id)).toEqual(en.sections.map((section) => section.id));
    expect(he.title).not.toBe(en.title);
  });

  it('takes the language from Accept-Language without ?lang=', async () => {
    const response = await env.transport({ method: 'GET', path: '/legal/terms', headers: { 'Accept-Language': 'he-IL' } });
    expect(response.status).toBe(200);
    expect((response.data as LegalDocumentResponse).language).toBe('he');
  });

  it('answers 404 for an unknown document and 400 for an unknown language', async () => {
    expect(await expectApiError(anonymous.legal.getDocument('cookies' as LegalDocumentId, 'en'))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    const response = await env.transport({ method: 'GET', path: '/legal/terms', query: { lang: 'fr' }, headers: {} });
    expect(response.status).toBe(400);
  });
});
