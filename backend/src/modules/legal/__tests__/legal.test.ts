import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestApp } from '../../../../test/app.js';
import { LEGAL_CONFIG } from '../../../config/legal.js';
import { RATE_LIMITS } from '../../../middleware/rate-limit.js';
import { formatLegalDate, LEGAL_SETTINGS, placeholderValues } from '../legal-placeholders.js';

/** `PUBLIC_API_URL` of the test environment. */
const API = 'http://api.test';

describe('GET /v1/legal/:document', () => {
  const { app } = createTestApp();

  it('answers the document in the asked language, placeholders filled, cacheable by anyone', async () => {
    const res = await request(app).get('/v1/legal/terms?lang=en').expect(200);
    expect(res.body).toEqual({
      document: 'terms',
      version: LEGAL_CONFIG.effectiveDate,
      effectiveDate: LEGAL_CONFIG.effectiveDate,
      language: 'en',
      title: 'Terms of Use',
      intro: expect.any(Array),
      sections: expect.any(Array),
    });
    expect(res.body.sections[0]).toEqual({ id: 'about-us', heading: expect.any(String), blocks: expect.any(Array) });
    expect(res.text).not.toContain('{{');
    expect(res.text).toContain(`${API}/legal/privacy`);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.headers.vary).toMatch(/Accept-Language/);
  });

  it('serves the three documents in Hebrew with the English section ids', async () => {
    for (const [document, title] of [
      ['terms', 'תנאי השימוש'],
      ['privacy', 'מדיניות הפרטיות'],
      ['account-deletion', 'מחיקת החשבון שלכם ב-Professionals'],
    ]) {
      const he = await request(app).get(`/v1/legal/${document}?lang=he`).expect(200);
      const en = await request(app).get(`/v1/legal/${document}?lang=en`).expect(200);
      expect(he.body).toMatchObject({ document, language: 'he', title });
      expect(he.body.sections.map((section: { id: string }) => section.id)).toEqual(en.body.sections.map((section: { id: string }) => section.id));
      expect(he.text).not.toContain('{{');
    }
  });

  it('takes the language from Accept-Language without ?lang=, English otherwise', async () => {
    const he = await request(app).get('/v1/legal/privacy').set('Accept-Language', 'he-IL,he;q=0.9,en;q=0.8').expect(200);
    expect(he.body.language).toBe('he');
    const fallback = await request(app).get('/v1/legal/privacy').set('Accept-Language', 'fr').expect(200);
    expect(fallback.body.language).toBe('en');
    const explicit = await request(app).get('/v1/legal/privacy?lang=en').set('Accept-Language', 'he').expect(200);
    expect(explicit.body.language).toBe('en');
  });

  it('names the operator of src/config/legal.ts (a visible placeholder until it is filled in)', async () => {
    const res = await request(app).get('/v1/legal/privacy?lang=en').expect(200);
    const whoWeAre = res.body.sections.find((section: { id: string }) => section.id === 'who-we-are');
    const items = whoWeAre.blocks.flatMap((block: { items?: { term: string; text: string }[] }) => block.items ?? []);
    const operator = items.find((item: { term: string }) => item.term === 'Operator');
    expect(operator.text.startsWith(placeholderValues(LEGAL_SETTINGS, API, 'en').operatorName)).toBe(true);
  });

  it('404 for an unknown document, 400 for an unknown language', async () => {
    const missing = await request(app).get('/v1/legal/cookies').expect(404);
    expect(missing.body).toEqual({ code: 'NOT_FOUND', message: 'Legal document was not found' });
    const language = await request(app).get('/v1/legal/terms?lang=fr').expect(400);
    expect(language.body.fieldErrors).toEqual({ lang: ['validation:invalid'] });
  });
});

describe('GET /legal/:document (public pages)', () => {
  const { app } = createTestApp();

  it('renders a Hebrew page right-to-left with the links between the documents', async () => {
    const res = await request(app).get('/legal/privacy?lang=he').expect(200).expect('Content-Type', /text\/html/);
    expect(res.text).toContain('<html lang="he" dir="rtl">');
    expect(res.text).toContain('<h1>מדיניות הפרטיות</h1>');
    expect(res.text).toContain(`תאריך תחילת התוקף: <time datetime="${LEGAL_CONFIG.effectiveDate}">${formatLegalDate(LEGAL_CONFIG.effectiveDate, 'he')}</time>`);
    // Language switch, the other documents (in the page's language) and the table of contents.
    expect(res.text).toContain(`href="${API}/legal/privacy?lang=en" hreflang="en" lang="en">English</a>`);
    expect(res.text).toContain(`<a href="${API}/legal/terms?lang=he">תנאי השימוש</a>`);
    expect(res.text).toContain(`<a href="${API}/legal/account-deletion?lang=he">מחיקת החשבון</a>`);
    expect(res.text).toContain(`<a href="${API}/legal/privacy?lang=he" aria-current="page">`);
    expect(res.text).toContain('<a href="#who-we-are">');
    expect(res.text).toContain('<section id="who-we-are">');
    expect(res.text).not.toContain('{{');
    expect(res.text).not.toMatch(/<script/i);
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.headers.vary).toMatch(/Accept-Language/);
  });

  it('renders English left-to-right, from ?lang= or the browser', async () => {
    const en = await request(app).get('/legal/terms').set('Accept-Language', 'en-US').expect(200);
    expect(en.text).toContain('<html lang="en" dir="ltr">');
    expect(en.text).toContain('<h1>Terms of Use</h1>');
    expect(en.text).toContain(`Effective date: <time datetime="${LEGAL_CONFIG.effectiveDate}">${formatLegalDate(LEGAL_CONFIG.effectiveDate, 'en')}</time>`);
    const he = await request(app).get('/legal/account-deletion').set('Accept-Language', 'he').expect(200);
    expect(he.text).toContain('<html lang="he" dir="rtl">');
    // An unknown language is ignored rather than refused.
    const unknown = await request(app).get('/legal/account-deletion?lang=fr').set('Accept-Language', 'he').expect(200);
    expect(unknown.text).toContain('<html lang="he" dir="rtl">');
  });

  it('404 for an unknown document', async () => {
    await request(app).get('/legal/cookies').expect(404);
  });
});

describe('legal pages over their rate limit', () => {
  const { app } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true', TRUST_PROXY: 'true' } });

  it('answers an HTML 429 page in the browser’s language', async () => {
    const ip = '198.51.100.21';
    const page = () => request(app).head('/legal/terms').set('X-Forwarded-For', ip).set('Accept-Language', 'he');
    for (let i = 0; i < RATE_LIMITS.publicReads.limit; i += 1) await page().expect(200);
    const limited = await request(app).get('/legal/terms').set('X-Forwarded-For', ip).set('Accept-Language', 'he').expect(429).expect('Content-Type', /html/);
    expect(limited.text).toContain('<html lang="he" dir="rtl">');
    expect(limited.text).toContain('יותר מדי בקשות');
    expect(limited.headers['cache-control']).toBe('no-store');
    // Another IP has its own budget.
    await request(app).get('/legal/terms').set('X-Forwarded-For', '198.51.100.22').expect(200);
  });
});
