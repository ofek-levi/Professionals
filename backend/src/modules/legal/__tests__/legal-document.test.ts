/** Placeholder filling and the page renderer, without HTTP (the operator details are passed in). */
import { describe, expect, it } from 'vitest';

import type { LegalDocumentResponse } from '../../../shared/contract/index.js';
import { LEGAL_DOCUMENTS } from '../content/index.js';
import { expandPlaceholders, legalPageUrls, placeholderValues, type LegalSettings } from '../legal-placeholders.js';
import { legalDocument } from '../legal.service.js';
import { renderLegalPage } from '../pages/render-legal-page.js';

const API = 'https://api.example.com';

const SETTINGS: LegalSettings = {
  operator: {
    name: { en: 'Example Services Ltd', he: 'דוגמה שירותים בע״מ' },
    registration: { label: { en: 'Company No.', he: 'ח.פ.' }, number: '51-123456-7' },
    address: { en: '1 Example St, Tel Aviv', he: 'רחוב הדוגמה 1, תל אביב' },
    email: 'privacy@example.com',
  },
  effectiveDate: '2026-09-30',
  retention: { serverLogsDays: 21, backupsDays: 14 },
};

const EMPTY_OPERATOR: LegalSettings = {
  ...SETTINGS,
  operator: { name: { en: '', he: '' }, registration: { label: { en: '', he: '' }, number: '' }, address: { en: '', he: '' }, email: '' },
};

/** The text of the first definition item named `term` in the document. */
function definition(doc: LegalDocumentResponse, term: string): string | undefined {
  for (const section of doc.sections) {
    for (const block of section.blocks) {
      if (block.type === 'definitions') {
        const item = block.items.find((candidate) => candidate.term === term);
        if (item) return item.text;
      }
    }
  }
  return undefined;
}

describe('legal documents with the operator filled in', () => {
  it.each(LEGAL_DOCUMENTS)('%s: every placeholder is filled in both languages', (document) => {
    for (const language of ['en', 'he'] as const) {
      const text = JSON.stringify(legalDocument(document, language, API, SETTINGS));
      expect(text).not.toContain('{{');
      expect(text).not.toContain('}}');
      expect(text).toContain(SETTINGS.operator.name[language]);
      expect(text).toContain('mailto:privacy@example.com');
      expect(text).not.toContain('backend/src/config/legal.ts');
    }
  });

  it('fills the operator, dates, retention and URLs in the reader’s language', () => {
    const en = legalDocument('privacy', 'en', API, SETTINGS);
    expect(en).toMatchObject({ document: 'privacy', version: '2026-09-30', effectiveDate: '2026-09-30', language: 'en', title: 'Privacy Policy' });
    expect(definition(en, 'Operator')).toBe('Example Services Ltd (Company No. 51-123456-7)');
    expect(definition(en, 'Address')).toBe('1 Example St, Tel Aviv');
    expect(definition(en, 'Email')).toBe('[privacy@example.com](mailto:privacy@example.com)');
    const enText = JSON.stringify(en);
    expect(enText).toContain('This version takes effect on 30 September 2026.');
    expect(enText).toContain(`[Terms of Use](${API}/legal/terms)`);
    expect(enText).toContain('21 days');

    const he = legalDocument('privacy', 'he', API, SETTINGS);
    expect(he.title).toBe('מדיניות הפרטיות');
    expect(definition(he, 'המפעיל')).toBe('דוגמה שירותים בע״מ (ח.פ. 51-123456-7)');
    expect(JSON.stringify(he)).toContain('30 בספטמבר 2026');
  });

  it('leaves out an empty registration number with its space; the label is the configured one, never guessed', () => {
    const registered = (registration: LegalSettings['operator']['registration']) => ({ ...SETTINGS, operator: { ...SETTINGS.operator, registration } });
    const none = registered({ label: { en: 'Company No.', he: 'ח.פ.' }, number: ' ' });
    expect(definition(legalDocument('terms', 'en', API, none), 'Operator')).toBe('Example Services Ltd');
    expect(placeholderValues(none, API, 'he').operatorRegistration).toBe('');
    // A non-profit's number also starts with 5: the label says what it is.
    const amuta = registered({ label: { en: 'Non-profit No.', he: 'ע״ר' }, number: '580123456' });
    expect(placeholderValues(amuta, API, 'en').operatorRegistration).toBe('(Non-profit No. 580123456)');
    expect(placeholderValues(amuta, API, 'he').operatorRegistration).toBe('(ע״ר 580123456)');
    // Without a label (development only: a deployed start refuses it), a visible placeholder.
    const unlabelled = registered({ label: { en: '', he: '' }, number: '012345678' });
    expect(placeholderValues(unlabelled, API, 'en').operatorRegistration).toBe('([registration label — set in backend/src/config/legal.ts] 012345678)');
  });

  it('shows visible placeholders while the operator is not filled in (development)', () => {
    const en = legalDocument('privacy', 'en', API, EMPTY_OPERATOR);
    expect(definition(en, 'Operator')).toBe('[operator name — set in backend/src/config/legal.ts]');
    expect(definition(en, 'Address')).toBe('[operator address — set in backend/src/config/legal.ts]');
    // Still a working link: the app and the page keep rendering it.
    expect(definition(en, 'Email')).toBe('[operator-email-not-set@example.invalid](mailto:operator-email-not-set@example.invalid)');
    expect(definition(legalDocument('privacy', 'he', API, EMPTY_OPERATOR), 'המפעיל')).toBe('[שם המפעיל — יש להגדיר ב-backend/src/config/legal.ts]');
  });

  it('keeps unknown placeholders visible', () => {
    const values = placeholderValues(SETTINGS, API, 'en');
    expect(expandPlaceholders('{{operatorName}} and {{nope}}', values)).toBe('Example Services Ltd and {{nope}}');
  });
});

describe('legal page rendering', () => {
  const urls = legalPageUrls('http://localhost:4000');
  const hostile: LegalDocumentResponse = {
    document: 'terms',
    version: '2026-09-30',
    effectiveDate: '2026-09-30',
    language: 'en',
    title: 'Terms <b>"x"</b>',
    intro: ['<script>alert(1)</script> & **bold** text'],
    sections: [
      {
        id: 'links',
        heading: 'Heading <img src=x onerror=alert(1)>',
        blocks: [
          {
            type: 'paragraph',
            text: '[bad](javascript:alert) [plain](http://example.com) [ok](https://example.com/?a=1&b=2) [mail](mailto:a@example.com) [privacy](http://localhost:4000/legal/privacy) [**strong**](https://example.com/x)',
          },
          { type: 'definitions', items: [{ term: '<i>term</i>', text: '"quoted" \'single\'' }] },
        ],
      },
    ],
  };
  const html = renderLegalPage(hostile, urls);

  it('escapes every text', () => {
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; <strong>bold</strong> text');
    expect(html).toContain('<title>Terms &lt;b&gt;&quot;x&quot;&lt;/b&gt; · Professionals</title>');
    expect(html).toContain('<dt>&lt;i&gt;term&lt;/i&gt;</dt><dd>&quot;quoted&quot; &#39;single&#39;</dd>');
  });

  it('links only to https pages, email addresses and the documents (in the page’s language)', () => {
    expect(html).not.toMatch(/href="(javascript|http:\/\/example\.com)/);
    expect(html).toContain('<p>bad plain <a href="https://example.com/');
    expect(html).toContain('<a href="https://example.com/?a=1&amp;b=2" dir="auto">ok</a>');
    expect(html).toContain('<a href="mailto:a@example.com" dir="auto">mail</a>');
    expect(html).toContain('<a href="http://localhost:4000/legal/privacy?lang=en" dir="auto">privacy</a>');
    expect(html).toContain('<strong><a href="https://example.com/x" dir="auto">strong</a></strong>');
  });
});
