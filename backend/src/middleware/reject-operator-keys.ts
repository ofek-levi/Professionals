/**
 * Defense in depth against NoSQL operator injection and prototype pollution: request bodies and
 * query strings may not contain keys starting with `$` or named `__proto__`/`constructor`/
 * `prototype` (zod schemas would drop them anyway; this stops them before any code sees them).
 */
import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../lib/errors.js';
import { vm } from '../shared/validation-messages.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 20;

/** Dotted path of the first forbidden key of `value`, or `null` (also used for multipart JSON payloads). */
export function findForbiddenKey(value: unknown, path: string[], depth = 0): string | null {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return null;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || FORBIDDEN_KEYS.has(key)) return [...path, key].join('.');
    const found = findForbiddenKey((value as Record<string, unknown>)[key], [...path, key], depth + 1);
    if (found) return found;
  }
  return null;
}

export function rejectOperatorKeys(req: Request, _res: Response, next: NextFunction): void {
  const found = findForbiddenKey(req.body, []) ?? findForbiddenKey(req.query, []);
  if (found) next(ApiError.validation({ [found]: [vm('invalid')] }));
  else next();
}
