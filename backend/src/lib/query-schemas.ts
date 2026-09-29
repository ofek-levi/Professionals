/**
 * zod helpers for query strings. Values arrive as strings (arrays comma separated, the way the
 * app's `serializeQuery` sends them: `?urgencies=emergency,urgent`); empty values count as absent.
 */
import { z } from 'zod';

import { vm } from '../shared/validation-messages.js';

const INVALID = vm('invalid');

function firstValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.length > 0 ? value.join(',') : undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

function csvValues(value: unknown): unknown {
  const raw = firstValue(value);
  if (typeof raw !== 'string') return raw;
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/** `?statuses=a,b` → `['a','b']` restricted to `values` (unknown value → 400). */
export function queryEnumList<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(csvValues, z.array(z.enum(values, { error: INVALID })).optional());
}

export function queryEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(firstValue, z.enum(values, { error: INVALID }).optional());
}

/** `true`/`1`/`false`/`0`. */
export function queryBoolean() {
  return z.preprocess((value) => {
    const raw = firstValue(value);
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return raw;
  }, z.boolean({ error: INVALID }).optional());
}

export function queryNumber(bounds: { min?: number; max?: number } = {}) {
  let schema = z.number({ error: INVALID });
  if (bounds.min !== undefined) schema = schema.min(bounds.min, INVALID);
  if (bounds.max !== undefined) schema = schema.max(bounds.max, INVALID);
  return z.preprocess((value) => {
    const raw = firstValue(value);
    return typeof raw === 'string' ? Number(raw) : raw;
  }, schema.optional());
}

export function queryString(maxLength = 200) {
  return z.preprocess(firstValue, z.string({ error: INVALID }).trim().max(maxLength, INVALID).optional());
}
