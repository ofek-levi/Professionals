/**
 * The inline markup of the legal documents (`LegalText`): `**bold**` and `[label](url)`, nothing
 * else. Links go to web pages (`https:`; `http:` from a development server) or email addresses
 * (`mailto:`); a link to anything else keeps only its label, as plain text.
 */
import { parseLegalDocument, type LegalDocument } from '@/lib/routes';

export type LegalSegment =
  | { kind: 'text'; text: string; bold: boolean }
  | { kind: 'link'; text: string; url: string; bold: boolean };

/** `**bold**`, or `[label](url)` with a url without spaces or parentheses. */
const INLINE_TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^()\s]+)\)/g;
const LINK_URL = /^(https?:\/\/|mailto:)/i;
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

/**
 * The app screen of a link to one of the backend's public document pages
 * (`<API origin>/legal/terms`, what `{{termsUrl}}` expands to), so that it opens in the app rather
 * than in the browser; `null` for any other link.
 */
export function legalDocumentOfUrl(url: string, apiBaseUrl: string): LegalDocument | null {
  const prefix = `${apiBaseUrl.replace(/\/v1\/?$/, '')}/legal/`;
  if (!url.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const [path] = url.slice(prefix.length).split(/[?#]/);
  return parseLegalDocument(path.replace(/\/$/, ''));
}
