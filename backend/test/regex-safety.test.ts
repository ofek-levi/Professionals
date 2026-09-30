/**
 * ReDoS regression: every pattern that sees user input stays fast on hostile input (long runs that
 * almost match, then fail at the end). The 100 kB JSON body limit bounds each field, so each case
 * uses about that much. Linear-time checks finish in a few milliseconds; the old chat normalizer
 * (`/[ \t]+$/gm`) took 14 s on such an input.
 */
import { describe, expect, it } from 'vitest';

import { normalizeMessageText } from '../src/lib/text.js';
import { authEmailSchema, personNameSchema, phoneSchema } from '../src/modules/auth/auth-fields.schemas.js';
import { sendMessageBody } from '../src/modules/conversations/conversations.schemas.js';
import { contactSchema } from '../src/modules/professionals/profile-business.schemas.js';
import { updateProfessionalProfileBody } from '../src/modules/professionals/professionals.schemas.js';

const N = 90_000;

function timed(run: () => unknown): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

describe('patterns on user input run in linear time', () => {
  const cases: [string, () => unknown][] = [
    ['chat text: spaces not followed by a line end', () => sendMessageBody.safeParse({ text: `a${' '.repeat(N)}a`, clientMessageId: 'x' })],
    ['chat normalizer itself', () => normalizeMessageText(`a${' \t'.repeat(N)}a\n`.repeat(2))],
    ['email: dots then @', () => authEmailSchema.safeParse(`a@${'.'.repeat(N)}@`)],
    ['person name: letters then a symbol', () => personNameSchema('auth.firstNameRequired').safeParse(`${'a '.repeat(N / 2)}!`)],
    ['phone: digits and separators', () => phoneSchema.safeParse(`${'0-'.repeat(N / 2)}x`)],
    ['website: labels then a bad TLD', () => contactSchema.shape.website.safeParse(`${'a.'.repeat(N / 2)}1`)],
    ['license number: allowed characters then a symbol', () => updateProfessionalProfileBody.safeParse({ business: { businessName: null, licenseNumber: `${'a-'.repeat(N / 2)}!`, isInsured: false, languages: ['he'] } })],
  ];

  it.each(cases)('%s', (_label, run) => {
    expect(timed(run)).toBeLessThan(200);
  });
});
