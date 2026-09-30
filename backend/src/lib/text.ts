/** Small text helpers shared by views and notifications. */

/**
 * Privacy-friendly customer name shown to professionals and in reviews, e.g. "Noa L."
 * (ported from the mock backend's `customerShortName`).
 */
export function customerShortName(user: { firstName: string; lastName: string }): string {
  const first = user.firstName.trim();
  const lastInitial = user.lastName.trim().charAt(0);
  if (!first) return user.lastName.trim();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

/** Unicode first-strong isolate: a name or an address keeps its own direction inside Hebrew text. */
export function isolateText(text: string): string {
  return `\u2068${text}\u2069`;
}

/** `line` without its trailing spaces and tabs (a scan, not a regex: see `normalizeMessageText`). */
function trimLineEnd(line: string): string {
  let end = line.length;
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end -= 1;
  return line.slice(0, end);
}

/**
 * Normalizes chat input: line endings, trailing spaces, 3+ blank lines, outer whitespace. Linear
 * time on any input: `/[ \t]+$/gm` backtracks quadratically on a long run of spaces that is not
 * followed by a line end, so trailing spaces are trimmed per line by a scan instead.
 */
export function normalizeMessageText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(trimLineEnd)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single-line preview (notifications, push), truncated with an ellipsis. */
export function messagePreview(text: string, maxLength = 90): string {
  const singleLine = normalizeMessageText(text).replace(/\s+/g, ' ');
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
