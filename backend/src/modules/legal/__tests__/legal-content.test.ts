/**
 * Format rules of the document texts (`content/`): what the app and the pages can render, and the
 * same structure in both languages. A new version that breaks one fails here, not in production.
 */
import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '../../../shared/domain.js';
import { LEGAL_CONTENT, LEGAL_DOCUMENTS, type LegalDocumentContent } from '../content/index.js';
import { parseLegalText } from '../legal-markup.js';
import { LEGAL_PLACEHOLDERS, LEGAL_SETTINGS } from '../legal-placeholders.js';

/** Every text that may carry markup (paragraphs, list items, definition texts, intro). */
function markedUpTexts(content: LegalDocumentContent): string[] {
  return [
    ...(content.intro ?? []),
    ...content.sections.flatMap((section) =>
      section.blocks.flatMap((block) => (block.type === 'paragraph' ? [block.text] : block.type === 'list' ? block.items : block.items.map((item) => item.text))),
    ),
  ];
}

/** Titles, headings and definition terms: plain text. */
function plainTexts(content: LegalDocumentContent): string[] {
  return [
    content.title,
    ...content.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap((block) => (block.type === 'definitions' ? block.items.map((item) => item.term) : [])),
    ]),
  ];
}

const placeholdersOf = (text: string) => [...text.matchAll(/\{\{(\w*)\}\}/g)].map((match) => match[1]);
const DOCUMENT_URL = /^\{\{(termsUrl|privacyUrl|deletionUrl)\}\}$/;
const ALLOWED_URL = /^(https:\/\/[^\s{}]+|mailto:(\{\{contactEmail\}\}|[^\s@{}]+@[^\s@{}]+))$/;

const variants = LEGAL_DOCUMENTS.flatMap((document) => SUPPORTED_LANGUAGES.map((language) => [document, language] as const));

describe('legal document texts', () => {
  it.each(variants)('%s (%s): unique section ids, nothing empty', (document, language) => {
    const content = LEGAL_CONTENT[document][language];
    const ids = content.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const text of [...plainTexts(content), ...markedUpTexts(content)]) expect(text.trim()).not.toBe('');
    for (const section of content.sections) {
      expect(section.blocks.length).toBeGreaterThan(0);
      for (const block of section.blocks) if (block.type !== 'paragraph') expect(block.items.length).toBeGreaterThan(0);
    }
  });

  it.each(variants)('%s (%s): only the known placeholders', (document, language) => {
    const content = LEGAL_CONTENT[document][language];
    const used = [...plainTexts(content), ...markedUpTexts(content)].flatMap(placeholdersOf);
    expect(used.filter((name) => !(LEGAL_PLACEHOLDERS as readonly (string | undefined)[]).includes(name))).toEqual([]);
    // A brace that is not part of a placeholder is a typo of one.
    for (const text of [...plainTexts(content), ...markedUpTexts(content)]) expect(text.replace(/\{\{\w+\}\}/g, '')).not.toMatch(/[{}]/);
  });

  it.each(variants)('%s (%s): markup is **bold** and [label](url) only, links to allowed addresses', (document, language) => {
    const content = LEGAL_CONTENT[document][language];
    for (const text of plainTexts(content)) expect(text).not.toMatch(/\*\*|\[|\]|\{\{/);
    for (const text of markedUpTexts(content)) {
      for (const run of parseLegalText(text)) {
        // Markup the parser did not take (an unclosed `**`, a broken link) would show as is.
        expect(run.text, text).not.toMatch(/\*\*|\[|\]/);
        if (run.kind === 'link') expect(DOCUMENT_URL.test(run.url) || ALLOWED_URL.test(run.url), `${run.url} in: ${text}`).toBe(true);
      }
    }
  });

  it.each(LEGAL_DOCUMENTS)('%s: the same sections, in the same order, in English and Hebrew', (document) => {
    const ids = (language: 'en' | 'he') => LEGAL_CONTENT[document][language].sections.map((section) => section.id);
    expect(ids('he')).toEqual(ids('en'));
    const placeholders = (language: 'en' | 'he') => new Set(markedUpTexts(LEGAL_CONTENT[document][language]).flatMap(placeholdersOf));
    expect(placeholders('he')).toEqual(placeholders('en'));
  });

  it.each(LEGAL_DOCUMENTS)('%s (he): a prefix stays on the line of the Latin word after it', (document) => {
    // A line may break after "ב-" or "ב־"; the word joiner in "ב־⁠Professionals" prevents it.
    const content = LEGAL_CONTENT[document].he;
    for (const text of [...plainTexts(content), ...markedUpTexts(content)]) expect(text).not.toMatch(/[א-ת][-־][A-Za-z]/);
  });

  it('src/config/legal.ts: a real effective date and whole days of retention', () => {
    const { effectiveDate, retention } = LEGAL_SETTINGS;
    expect(effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${effectiveDate}T00:00:00Z`).toISOString().slice(0, 10)).toBe(effectiveDate);
    for (const days of Object.values(retention)) expect(Number.isInteger(days) && days > 0).toBe(true);
  });

  it.each(LEGAL_DOCUMENTS)('%s: says which language version prevails', (document) => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(LEGAL_CONTENT[document][language].sections.map((section) => section.id)).toContain('language-versions');
    }
  });
});
