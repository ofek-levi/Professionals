/**
 * The sign-up rules must match the app's (`frontend/src/lib/validation/auth.ts`): the same payload
 * gives the same field errors on both sides, so the app never accepts what the server refuses.
 * Skipped when the frontend is not next to the backend (backend-only builds).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { zodIssuesToFieldErrors } from '../../../lib/validate.js';
import { registerBody } from '../auth.schemas.js';
import { newPasswordIssue } from '../password-rules.js';
import { customerPayload, professionalPayload } from './auth-test-helpers.js';

const APP_VALIDATION = new URL('../../../../../frontend/src/lib/validation/auth.ts', import.meta.url);

interface AppAuthValidation {
  newPasswordIssue: (password: string) => string | null;
  registerRequestSchema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: unknown[] } } };
}

async function appValidation(): Promise<AppAuthValidation> {
  return (await import(fileURLToPath(APP_VALIDATION))) as AppAuthValidation;
}

function fieldErrorsOf(result: { success: boolean; error?: { issues: unknown[] } }) {
  return result.success ? {} : zodIssuesToFieldErrors((result.error?.issues ?? []) as z.core.$ZodIssue[]);
}

const PASSWORDS = ['', 'short1', 'a'.repeat(65) + '1', 'onlyletters', '12345678', 'Password1', 'QWERTY123', 'Sunny-Garden-42', 'שלוםשלום1', 'пароль123'];

const PAYLOADS: Record<string, unknown>[] = [
  customerPayload(),
  professionalPayload(),
  customerPayload({ firstName: '1Noa', lastName: 'L', email: 'x@y', phone: '+1 555', password: 'abc', acceptedTerms: false }),
  customerPayload({ firstName: "O'Brien-ג׳ורג׳", lastName: 'Cohen Levi', phone: '+972 50 123 4567' }),
  customerPayload({ professional: professionalPayload().professional }),
  professionalPayload({ professional: null }),
  professionalPayload({
    professional: {
      businessName: null,
      categoryIds: Array.from({ length: 11 }, () => 'plumbing'),
      baseLocation: { coordinates: { latitude: 0, longitude: 200 }, addressLine: 'x'.repeat(121), city: '', neighborhood: 'n', details: null },
      serviceRadiusKm: 81,
    },
  }),
  professionalPayload({ professional: { ...(professionalPayload().professional as object), categoryIds: ['astrology'] } }),
  { role: 'admin', preferredLanguage: 'en' },
];

describe.skipIf(!existsSync(APP_VALIDATION))('sign-up validation matches the app', () => {
  it('password rules', async () => {
    const app = await appValidation();
    for (const password of PASSWORDS) expect(newPasswordIssue(password), password).toBe(app.newPasswordIssue(password));
  });

  it('POST /auth/register payload rules', async () => {
    const app = await appValidation();
    for (const payload of PAYLOADS) {
      expect(fieldErrorsOf(registerBody.safeParse(payload)), JSON.stringify(payload)).toEqual(fieldErrorsOf(app.registerRequestSchema.safeParse(payload)));
    }
  });
});
