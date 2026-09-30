/** Payload validation with the shared zod schemas → 400 `VALIDATION_ERROR` responses with `fieldErrors`. */
import type { z } from 'zod';

import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import { zodIssuesToFieldErrors } from '@/lib/validation/field-errors';

const UNSUPPORTED_CATEGORY_MESSAGE = vm('category.unsupported');

/**
 * Parses `body` or throws `VALIDATION_ERROR` (400). A category that is not in the catalog is
 * reported with the more specific `UNSUPPORTED_CATEGORY` code (422).
 */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const fieldErrors = zodIssuesToFieldErrors(result.error);
  const unsupportedCategory = result.error.issues.some((issue) => issue.message === UNSUPPORTED_CATEGORY_MESSAGE);
  throw DomainError.validation(
    fieldErrors,
    unsupportedCategory ? 'The service category is not supported' : 'The request payload is invalid',
    unsupportedCategory ? 'UNSUPPORTED_CATEGORY' : 'VALIDATION_ERROR',
  );
}
