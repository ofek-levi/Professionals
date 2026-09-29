import { APP_CONFIG } from '@/constants/app-config';
import { addDays, splitDateTime } from '@/utils/dates';

import { parseAmountInput } from '../common';
import { zodIssuesToFieldErrors } from '../field-errors';
import {
  createEmptyOfferFormValues,
  createOfferFormSchema,
  createOfferSchema,
  offerToFormValues,
  toCreateOfferPayload,
  updateOfferSchema,
  type OfferFormValues,
} from '../offer';

const NOW = new Date(2026, 8, 27, 10, 0);
const tomorrow = splitDateTime(new Date(2026, 8, 28, 9, 30));
const values = (overrides: Partial<OfferFormValues> = {}): OfferFormValues => ({
  price: '1,250.50',
  date: tomorrow.date,
  time: tomorrow.time,
  estimatedDurationMinutes: 90,
  message: '  I can do it  ',
  ...overrides,
});
const errorsOf = (schema: ReturnType<typeof createOfferFormSchema>, input: OfferFormValues) => {
  const result = schema.safeParse(input);
  return result.success ? {} : zodIssuesToFieldErrors(result.error);
};

describe('offer payload schema', () => {
  it('validates price bounds, decimals, currency and duration', () => {
    const base = {
      price: 450,
      currency: 'ILS',
      proposedStartAt: '2026-09-28T09:00:00.000Z',
      estimatedDurationMinutes: 60,
      message: null,
    };
    expect(createOfferSchema.safeParse(base).success).toBe(true);
    const result = createOfferSchema.safeParse({
      ...base,
      price: 10.555,
      currency: 'GBP',
      proposedStartAt: 'tomorrow',
      estimatedDurationMinutes: 5,
      message: 'x'.repeat(APP_CONFIG.offerMessageMaxLength + 1),
    });
    expect(!result.success && zodIssuesToFieldErrors(result.error)).toEqual({
      price: ['validation:offer.priceTooLow'],
      currency: ['validation:offer.currencyUnsupported'],
      proposedStartAt: ['validation:offer.startInvalid'],
      estimatedDurationMinutes: ['validation:offer.durationInvalid'],
      message: ['validation:offer.messageTooLong'],
    });
    const decimals = createOfferSchema.safeParse({ ...base, price: 450.555 });
    expect(!decimals.success && zodIssuesToFieldErrors(decimals.error).price).toEqual(['validation:offer.priceDecimals']);
    expect(updateOfferSchema.parse({ price: 500 })).toEqual({ price: 500 });
  });
});

describe('offer form schema', () => {
  const schema = createOfferFormSchema(NOW);

  it('parses user-typed prices', () => {
    expect(parseAmountInput('1,250.50')).toBe(1250.5);
    expect(parseAmountInput(' 300 ')).toBe(300);
    expect(parseAmountInput('₪ 450')).toBe(450);
    expect(parseAmountInput('12a')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
  });

  it('accepts valid input and builds the payload', () => {
    expect(errorsOf(schema, values())).toEqual({});
    expect(toCreateOfferPayload(values())).toEqual({
      price: 1250.5,
      currency: APP_CONFIG.defaultCurrency,
      proposedStartAt: new Date(2026, 8, 28, 9, 30).toISOString(),
      estimatedDurationMinutes: 90,
      message: 'I can do it',
    });
    expect(toCreateOfferPayload(values({ message: '   ' })).message).toBeNull();
  });

  it('validates price text', () => {
    expect(errorsOf(schema, values({ price: '' })).price).toEqual(['validation:offer.priceRequired']);
    expect(errorsOf(schema, values({ price: 'abc' })).price).toEqual(['validation:offer.priceInvalid']);
    expect(errorsOf(schema, values({ price: '0' })).price).toEqual(['validation:offer.priceInvalid']);
    expect(errorsOf(schema, values({ price: '10' })).price).toEqual(['validation:offer.priceTooLow']);
    expect(errorsOf(schema, values({ price: '250000' })).price).toEqual(['validation:offer.priceTooHigh']);
    expect(errorsOf(schema, values({ price: '100.123' })).price).toEqual(['validation:offer.priceDecimals']);
  });

  it('requires a start at least 30 minutes from now and within the scheduling horizon', () => {
    const soon = splitDateTime(new Date(2026, 8, 27, 10, 15));
    expect(errorsOf(schema, values(soon))).toEqual({ time: ['validation:offer.startTooSoon'] });
    const far = splitDateTime(addDays(NOW, APP_CONFIG.maxScheduleDaysAhead + 1));
    expect(errorsOf(schema, values(far))).toEqual({ date: ['validation:offer.startTooFar'] });
    expect(errorsOf(schema, values({ date: '', time: '25:00' }))).toEqual({
      date: ['validation:offer.dateRequired'],
      time: ['validation:offer.timeInvalid'],
    });
    // The time rule is reported even when another field is invalid.
    expect(errorsOf(schema, values({ ...soon, price: '' }))).toEqual({
      price: ['validation:offer.priceRequired'],
      time: ['validation:offer.startTooSoon'],
    });
  });

  it('applies urgency windows when the request is known', () => {
    const emergencySchema = createOfferFormSchema(NOW, { request: { urgency: 'emergency' } });
    const inTwoDays = splitDateTime(new Date(2026, 8, 29, 10, 0));
    expect(errorsOf(emergencySchema, values(inTwoDays))).toEqual({ date: ['validation:offer.emergencyWindow'] });
    expect(errorsOf(emergencySchema, values())).toEqual({});
  });

  it('evaluates "now" lazily when given a function', () => {
    let current = NOW;
    const lazy = createOfferFormSchema(() => current);
    expect(errorsOf(lazy, values())).toEqual({});
    current = new Date(2026, 8, 28, 9, 15);
    expect(errorsOf(lazy, values())).toEqual({ time: ['validation:offer.startTooSoon'] });
  });

  it('prefills and resets form values', () => {
    expect(createEmptyOfferFormValues()).toEqual({ price: '', date: '', time: '', estimatedDurationMinutes: null, message: '' });
    expect(createEmptyOfferFormValues(new Date(2026, 8, 28, 9, 30))).toMatchObject(tomorrow);
    expect(
      offerToFormValues({ price: 450, proposedStartAt: new Date(2026, 8, 28, 9, 30).toISOString(), estimatedDurationMinutes: null, message: null }),
    ).toEqual({ price: '450', ...tomorrow, estimatedDurationMinutes: null, message: '' });
  });
});
