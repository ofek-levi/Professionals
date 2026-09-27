/**
 * Helpers of the review form: "quick highlight" chips that add or remove a short phrase in the
 * comment, so customers can write a useful review with a couple of taps.
 */

export const REVIEW_HIGHLIGHTS = ['punctual', 'quality', 'tidy', 'communication', 'price'] as const;
export type ReviewHighlight = (typeof REVIEW_HIGHLIGHTS)[number];

const SENTENCE_END = /[.!?…]$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether the comment already contains the highlight phrase. */
export function hasHighlight(comment: string, phrase: string): boolean {
  return phrase.length > 0 && comment.includes(phrase);
}

/**
 * Appends `phrase.` to the comment (as its own sentence), or removes it (with its trailing period)
 * when it is already there. Returns the comment unchanged if appending would exceed `maxLength`.
 */
export function toggleHighlight(comment: string, phrase: string, maxLength: number): string {
  if (!phrase) return comment;
  if (hasHighlight(comment, phrase)) {
    return comment
      .replace(new RegExp(`${escapeRegExp(phrase)}\\.?`, 'u'), '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^[ \t]+|[ \t]+$/gm, '')
      .trim();
  }
  const base = comment.trimEnd();
  const separator = base.length === 0 ? '' : SENTENCE_END.test(base) ? ' ' : '. ';
  const next = `${base}${separator}${phrase}.`;
  return next.length > maxLength ? comment : next;
}
