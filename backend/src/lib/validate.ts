/**
 * Request validation with zod. Failures become 400 `VALIDATION_ERROR` with `fieldErrors` keyed by
 * dotted path (`location.addressLine`, `keepPhotos.2`, `limit`) and `validation:<key>` messages, the
 * format the app maps onto its form fields. A catalog-unknown category answers 422
 * `UNSUPPORTED_CATEGORY` instead (same rule as the mock backend).
 */
import type { Request } from 'express';
import type { z } from 'zod';

import { vm } from '../shared/validation-messages.js';
import { ApiError, type FieldErrors } from './errors.js';

const ROOT_FIELD = 'root';
const UNSUPPORTED_CATEGORY_MESSAGE = vm('category.unsupported');

type Issue = z.core.$ZodIssue;

/** Schema messages are i18n keys; zod's built-in English messages are replaced by generic keys. */
function messageOf(issue: Issue): string {
  if (issue.message.startsWith('validation:')) return issue.message;
  return issue.code === 'invalid_type' && issue.input === undefined ? vm('required') : vm('invalid');
}

function pathKey(prefix: readonly PropertyKey[], path: readonly PropertyKey[]): string {
  const segments = [...prefix, ...path].map(String);
  return segments.length > 0 ? segments.join('.') : ROOT_FIELD;
}

export function zodIssuesToFieldErrors(issues: readonly Issue[]): FieldErrors {
  const result: FieldErrors = {};
  const add = (key: string, message: string) => {
    const messages = (result[key] ??= []);
    if (!messages.includes(message)) messages.push(message);
  };
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) add(pathKey(issue.path, [key]), vm('invalid'));
    } else {
      add(pathKey([], issue.path), messageOf(issue));
    }
  }
  return result;
}

/** Parses `input` or throws the API validation error. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input, { reportInput: true });
  if (result.success) return result.data;
  const unsupportedCategory = result.error.issues.some((issue) => issue.message === UNSUPPORTED_CATEGORY_MESSAGE);
  throw ApiError.validation(
    zodIssuesToFieldErrors(result.error.issues),
    unsupportedCategory ? 'The service category is not supported' : 'The request payload is invalid',
    unsupportedCategory ? 'UNSUPPORTED_CATEGORY' : 'VALIDATION_ERROR',
  );
}

type Output<S> = S extends z.ZodType ? z.output<S> : undefined;

interface RequestSchemas<B, Q, P> {
  body?: B;
  query?: Q;
  params?: P;
}

/**
 * Validates the parts of a request a controller needs, fully typed:
 * `const { params, body } = validateRequest(req, { params: offerIdParams, body: updateOfferSchema })`.
 * Errors of all parts are reported together.
 */
export function validateRequest<
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  P extends z.ZodType | undefined = undefined,
>(req: Request, schemas: RequestSchemas<B, Q, P>): { body: Output<B>; query: Output<Q>; params: Output<P> } {
  const fieldErrors: FieldErrors = {};
  const state = { unsupportedCategory: false };
  const parse = (schema: z.ZodType | undefined, input: unknown): unknown => {
    if (!schema) return undefined;
    try {
      return parseInput(schema, input);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === 'UNSUPPORTED_CATEGORY') state.unsupportedCategory = true;
      Object.assign(fieldErrors, error.fieldErrors);
      return undefined;
    }
  };
  const params = parse(schemas.params, req.params);
  const query = parse(schemas.query, req.query);
  const body = parse(schemas.body, req.body ?? {});
  if (Object.keys(fieldErrors).length > 0) {
    throw ApiError.validation(
      fieldErrors,
      state.unsupportedCategory ? 'The service category is not supported' : 'The request payload is invalid',
      state.unsupportedCategory ? 'UNSUPPORTED_CATEGORY' : 'VALIDATION_ERROR',
    );
  }
  return { body, query, params } as { body: Output<B>; query: Output<Q>; params: Output<P> };
}
