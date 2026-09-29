/** Conversion of zod issues into the API's `fieldErrors` shape (`Record<path, messages[]>`). */
import type { z } from 'zod';

/** Key used for issues that are not attached to a field (matches react-hook-form's `root`). */
const ROOT_FIELD_KEY = 'root';

type IssueLike = Pick<z.core.$ZodIssue, 'path' | 'message'>;

/** Dotted path of an issue, e.g. `location.addressLine`, `photos.2.uri`. */
function issuePathToKey(path: readonly PropertyKey[]): string {
  return path.length > 0 ? path.map((segment) => String(segment)).join('.') : ROOT_FIELD_KEY;
}

/** Groups issue messages by field path, without duplicates. */
export function zodIssuesToFieldErrors(error: z.ZodError | { issues: readonly IssueLike[] }): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issuePathToKey(issue.path);
    const messages = result[key] ?? [];
    if (!messages.includes(issue.message)) messages.push(issue.message);
    result[key] = messages;
  }
  return result;
}
