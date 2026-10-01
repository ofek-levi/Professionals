/**
 * The inline markup of the legal documents (`LegalText`): `**bold**` and `[label](url)`, nothing
 * else. Links go to web pages (`https:`; `http:` only in development, for a local server) or email
 * addresses (`mailto:`); a link to anything else keeps only its label, as plain text.
 */
import { parseLegalDocument, type LegalDocument } from '@/lib/routes';

export type LegalSegment =
  | { kind: 'text'; text: string; bold: boolean }
  | { kind: 'link'; text: string; url: string; bold: boolean };

/** `**bold**`, or `[label](url)` with a url without spaces or parentheses. */
const INLINE_TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^()\s]+)\)/g;
const LINK_URL = __DEV__ ? /^(https?:\/\/|mailto:)/i : /^(https:\/\/|mailto:)/i;
/** A whole bold label: `[**label**](url)`. */
const BOLD_LABEL = /^\*\*(.+)\*\*$/;

/** Splits a document text into plain, bold and link runs, in reading order. */
export function parseLegalText(text: string, bold = false): LegalSegment[] {
  const segments: LegalSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: 'text', text: text.slice(last, index), bold });
    const [, strong, label, url] = match;
    if (strong !== undefined) {
      // Bold text may hold a link: "**See [the policy](…)**".
      segments.push(...parseLegalText(strong, true));
    } else {
      const boldLabel = BOLD_LABEL.exec(label);
      const run = { text: boldLabel ? boldLabel[1] : label, bold: bold || boldLabel !== null };
      segments.push(LINK_URL.test(url) ? { kind: 'link', url, ...run } : { kind: 'text', ...run });
    }
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last), bold });
  return segments;
}

/** Where the backend's public document pages live: `<API origin>/legal/`. */
function legalPagesPrefix(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/v1\/?$/, '')}/legal/`;
}

function isLegalPageUrl(url: string, apiBaseUrl: string): boolean {
  return url.toLowerCase().startsWith(legalPagesPrefix(apiBaseUrl).toLowerCase());
}

/**
 * The app screen of a link to one of the backend's public document pages
 * (`<API origin>/legal/terms`, what `{{termsUrl}}` expands to), so that it opens in the app rather
 * than in the browser; `null` for any other link.
 */
export function legalDocumentOfUrl(url: string, apiBaseUrl: string): LegalDocument | null {
  if (!isLegalPageUrl(url, apiBaseUrl)) return null;
  const [path] = url.slice(legalPagesPrefix(apiBaseUrl).length).split(/[?#]/);
  return parseLegalDocument(path.replace(/\/$/, ''));
}

/**
 * A link to one of the backend's public document pages, opened outside the app, in the app's
 * language (`?lang=`): the page would otherwise follow the browser's. Other links, and one that
 * already names a language, stay as they are.
 */
export function withLegalPageLanguage(url: string, apiBaseUrl: string, language: string): string {
  if (!isLegalPageUrl(url, apiBaseUrl)) return url;
  const hashAt = url.indexOf('#');
  const page = hashAt === -1 ? url : url.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  if (/[?&]lang=/i.test(page)) return url;
  return `${page}${page.includes('?') ? '&' : '?'}lang=${encodeURIComponent(language)}${hash}`;
}
