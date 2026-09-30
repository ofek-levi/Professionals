/**
 * The public pages of the legal documents (the look of the auth email pages, `auth/pages`): no
 * scripts, images or outside resources; Hebrew pages are right-to-left. Every text is escaped, and
 * links only go to `https:` pages, `mailto:` addresses and the documents' own pages.
 */
import type { LegalBlock, LegalDocumentId, LegalDocumentResponse, LegalSection } from '../../../shared/contract/index.js';
import type { AppLanguage } from '../../../shared/domain.js';
import { BRAND, directionOf, escapeHtml } from '../../../lib/html.js';
import { LEGAL_DOCUMENTS } from '../content/index.js';
import { parseLegalText } from '../legal-markup.js';
import { formatLegalDate } from '../legal-placeholders.js';
import { LEGAL_PAGE_TEXTS } from './legal-page-texts.js';

const STYLES = `
*{box-sizing:border-box}
body{margin:0;background:${BRAND.background};font-family:${BRAND.font};color:${BRAND.text};line-height:1.6}
.page{max-width:780px;margin:0 auto;padding:24px 16px 48px}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}
.brand{margin:0;font-size:14px;font-weight:700;letter-spacing:.4px;color:${BRAND.color}}
.lang{font-size:15px;font-weight:600}
.docs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.docs a{padding:6px 12px;border:1px solid #d9dee5;border-radius:999px;background:#fff;color:${BRAND.text};font-size:14px;text-decoration:none}
.docs a[aria-current=page]{border-color:${BRAND.color};background:${BRAND.color};color:#fff}
main{background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 2px 12px rgba(16,24,40,.08);overflow-wrap:break-word}
h1{margin:0 0 8px;font-size:28px;line-height:1.3}
h2{margin:36px 0 12px;font-size:20px;line-height:1.35}
p,li,dd{font-size:16px}
p{margin:0 0 14px}
ul{margin:0 0 14px;padding-inline-start:24px}
li{margin-bottom:8px}
dl{margin:0 0 14px}
dt{font-weight:600}
dd{margin:0 0 10px}
a{color:${BRAND.color};text-underline-offset:2px}
.effective{margin:0 0 24px;font-size:14px;color:${BRAND.muted}}
.toc{margin:24px 0 8px;padding:16px 20px;border-radius:12px;background:${BRAND.background}}
.toc h2{margin:0 0 8px;font-size:16px}
.toc ol{margin:0;padding-inline-start:22px}
.toc li{margin-bottom:4px;font-size:15px}
@media (max-width:480px){main{padding:24px 18px}h1{font-size:24px}}
`;

const SAFE_URL = /^(https:\/\/|mailto:)/i;

/** The address of a link, or `null` to show only its label. */
type LinkTarget = (url: string) => string | null;

function document(language: AppLanguage, title: string, top: string, content: string): string {
  return `<!doctype html>
<html lang="${language}" dir="${directionOf(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · ${BRAND.name}</title>
<style>${STYLES}</style>
</head>
<body><div class="page">
<header class="top"><p class="brand">${BRAND.name}</p>${top}</header>
${content}
</div></body>
</html>`;
}

function inline(text: string, linkTarget: LinkTarget): string {
  return parseLegalText(text)
    .map((run) => {
      const target = run.kind === 'link' ? linkTarget(run.url) : null;
      // `dir="auto"` isolates a link, so an email address keeps its order inside Hebrew text.
      const html = target ? `<a href="${escapeHtml(target)}" dir="auto">${escapeHtml(run.text)}</a>` : escapeHtml(run.text);
      return run.bold ? `<strong>${html}</strong>` : html;
    })
    .join('');
}

function block(content: LegalBlock, linkTarget: LinkTarget): string {
  switch (content.type) {
    case 'paragraph':
      return `<p>${inline(content.text, linkTarget)}</p>`;
    case 'list':
      return `<ul>\n${content.items.map((item) => `<li>${inline(item, linkTarget)}</li>`).join('\n')}\n</ul>`;
    case 'definitions':
      return `<dl>\n${content.items.map((item) => `<dt>${escapeHtml(item.term)}</dt><dd>${inline(item.text, linkTarget)}</dd>`).join('\n')}\n</dl>`;
  }
}

function section(content: LegalSection, linkTarget: LinkTarget): string {
  const blocks = content.blocks.map((item) => block(item, linkTarget)).join('\n');
  return `<section id="${escapeHtml(content.id)}">\n<h2>${escapeHtml(content.heading)}</h2>\n${blocks}\n</section>`;
}

function tableOfContents(sections: LegalSection[], title: string): string {
  const items = sections.map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.heading)}</a></li>`).join('\n');
  return `<nav class="toc" aria-labelledby="toc"><h2 id="toc">${escapeHtml(title)}</h2><ol>\n${items}\n</ol></nav>`;
}

/** `doc` as a page; `urls` are the documents' public pages (`legalPageUrls`). */
export function renderLegalPage(doc: LegalDocumentResponse, urls: Record<LegalDocumentId, string>): string {
  const { language } = doc;
  const texts = LEGAL_PAGE_TEXTS[language];
  const other: AppLanguage = language === 'he' ? 'en' : 'he';
  const inLanguage = (id: LegalDocumentId, lang: AppLanguage) => escapeHtml(`${urls[id]}?lang=${lang}`);
  // Links to the documents stay in the page's language (the bare URLs pick the browser's).
  const ownPages = new Map(LEGAL_DOCUMENTS.map((id) => [urls[id], `${urls[id]}?lang=${language}`]));
  const linkTarget: LinkTarget = (url) => ownPages.get(url) ?? (SAFE_URL.test(url) ? url : null);

  const switchLanguage = `<a class="lang" href="${inLanguage(doc.document, other)}" hreflang="${other}" lang="${other}">${escapeHtml(texts.switchLanguage)}</a>`;
  const documentLinks = LEGAL_DOCUMENTS.map((id) => {
    const current = id === doc.document ? ' aria-current="page"' : '';
    return `<a href="${inLanguage(id, language)}"${current}>${escapeHtml(texts.documents[id])}</a>`;
  }).join('');
  const effectiveDate = `<time datetime="${escapeHtml(doc.effectiveDate)}">${escapeHtml(formatLegalDate(doc.effectiveDate, language))}</time>`;

  return document(
    language,
    doc.title,
    switchLanguage,
    `<nav class="docs" aria-label="${escapeHtml(texts.documentsNav)}">${documentLinks}</nav>
<main>
<h1>${escapeHtml(doc.title)}</h1>
<p class="effective">${escapeHtml(texts.effectiveDate)}: ${effectiveDate}</p>
${doc.intro.map((text) => `<p>${inline(text, linkTarget)}</p>`).join('\n')}
${tableOfContents(doc.sections, texts.contents)}
${doc.sections.map((item) => section(item, linkTarget)).join('\n')}
</main>`,
  );
}

/** Over the pages' rate limit. */
export function renderTooManyRequestsPage(language: AppLanguage): string {
  const texts = LEGAL_PAGE_TEXTS[language].tooManyRequests;
  return document(language, texts.title, '', `<main><h1>${escapeHtml(texts.title)}</h1><p>${escapeHtml(texts.message)}</p></main>`);
}
