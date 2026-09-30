/**
 * The inline markup of the legal texts: `**bold**` and `[label](url)`, nothing else. Parsed the way
 * the app parses it (`frontend/src/features/legal/legal-markup.ts`), so both show the same text.
 */
export type LegalRun = { kind: 'text'; text: string; bold: boolean } | { kind: 'link'; text: string; url: string; bold: boolean };

/** `**bold**`, or `[label](url)` with a url without spaces or parentheses. */
const INLINE_TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^()\s]+)\)/g;
/** A whole bold label: `[**label**](url)`. */
const BOLD_LABEL = /^\*\*(.+)\*\*$/;

/** Splits a text into plain, bold and link runs, in reading order. */
export function parseLegalText(text: string, bold = false): LegalRun[] {
  const runs: LegalRun[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    if (match.index > last) runs.push({ kind: 'text', text: text.slice(last, match.index), bold });
    const [, strong, label = '', url = ''] = match;
    if (strong !== undefined) {
      // Bold text may hold a link: "**See [the policy](…)**".
      runs.push(...parseLegalText(strong, true));
    } else {
      const boldLabel = BOLD_LABEL.exec(label);
      runs.push({ kind: 'link', text: boldLabel?.[1] ?? label, url, bold: bold || boldLabel !== null });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ kind: 'text', text: text.slice(last), bold });
  return runs;
}
