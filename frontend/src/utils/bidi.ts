/**
 * Bidirectional-text helpers for user-generated content (names, business names, messages, review
 * comments) shown inside a localized UI that may run right-to-left.
 *
 * Pure and platform independent; components combine them with the theme direction
 * (`alignForText(text, theme.isRTL)` → `<AppText align=…>`).
 */

type TextDirection = 'ltr' | 'rtl';

/** Strong right-to-left characters (Hebrew, Arabic, Syriac, Thaana, NKo, presentation forms). */
const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
/** Strong left-to-right characters (Latin incl. accents, Greek, Cyrillic). */
const LTR_CHAR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

/** LEFT-TO-RIGHT ISOLATE, FIRST STRONG ISOLATE and POP DIRECTIONAL ISOLATE. */
const LRI = '\u2066';
const FSI = '\u2068';
const PDI = '\u2069';
/** Isolate initiators: LEFT-TO-RIGHT ISOLATE, RIGHT-TO-LEFT ISOLATE, FIRST STRONG ISOLATE. */
const ISOLATE_INITIATORS = new Set([LRI, '\u2067', FSI]);
/** Implicit marks are strong characters too: LRM is L, RLM is R and ALM is AL. */
const LTR_MARK = '\u200E';
const RTL_MARKS = new Set(['\u200F', '\u061C']);

/**
 * Direction of a text from its first strong character (Unicode bidi rules P2/P3); `null` when it
 * has none (only digits, punctuation or emoji). Text inside isolates (see `isolateText`) is
 * skipped, so Hebrew sentences that start with an isolated Latin name
 * are still right-to-left.
 */
export function getTextDirection(text: string): TextDirection | null {
  let isolateDepth = 0;
  for (const char of text) {
    if (ISOLATE_INITIATORS.has(char)) {
      isolateDepth += 1;
    } else if (char === PDI) {
      if (isolateDepth > 0) isolateDepth -= 1;
    } else if (isolateDepth === 0) {
      if (char === LTR_MARK) return 'ltr';
      if (RTL_MARKS.has(char) || RTL_CHAR.test(char)) return 'rtl';
      if (LTR_CHAR.test(char)) return 'ltr';
    }
  }
  return null;
}

/** Logical alignment (`start`/`end`) that puts text of `textDirection` on its natural side. */
export function alignForTextDirection(textDirection: TextDirection | null, layoutIsRTL: boolean): 'start' | 'end' {
  if (textDirection === null) return 'start';
  return (textDirection === 'rtl') === layoutIsRTL ? 'start' : 'end';
}

/**
 * Alignment for a block of user-written text: an English comment reads left-aligned in the Hebrew
 * UI and a Hebrew one right-aligned in the English UI.
 */
export function alignForText(text: string, layoutIsRTL: boolean): 'start' | 'end' {
  return alignForTextDirection(getTextDirection(text), layoutIsRTL);
}

/**
 * Wraps a value interpolated into a sentence (a person's or business name, a quoted message) in
 * Unicode first-strong isolates (FSI … PDI), so it keeps its own direction and does not reorder the
 * words and punctuation around it, e.g. a Latin business name inside a Hebrew sentence. Invisible
 * when rendered. Empty text stays empty.
 */
export function isolateText(text: string): string {
  return text ? `${FSI}${text}${PDI}` : text;
}

/**
 * Keeps a left-to-right run such as a time range in order inside right-to-left text: in a Hebrew
 * sentence `08:00–17:00` would otherwise display as `17:00–08:00` (the en dash is a neutral
 * between two numbers). Use in RTL locale strings around ranges: `isolateLtr('{{start}}–{{end}}')`.
 */
export function isolateLtr(text: string): string {
  return text ? `${LRI}${text}${PDI}` : text;
}
