/**
 * Typed validation message keys. Every message produced by the schemas and business rules is a
 * `validation:<path>` key that exists in `src/i18n/locales/en/validation.ts` (checked at compile time).
 */
import type { validation } from '@/i18n/locales/en/validation';

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type ValidationMessagePath = Leaves<typeof validation>;
export type ValidationMessageKey = `validation:${ValidationMessagePath}`;

/** Builds a namespaced, type-checked validation message key. */
export function vm<P extends ValidationMessagePath>(path: P): `validation:${P}` {
  return `validation:${path}`;
}
