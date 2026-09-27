/**
 * Wraps user-provided text (names, business names) in Unicode first-strong isolates so a Latin name
 * keeps its punctuation in place inside a Hebrew sentence (and vice versa). Invisible otherwise.
 */
export function isolateText(text: string): string {
  return `⁨${text}⁩`;
}
