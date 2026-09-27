import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { createDefaultAvailability } from '@/features/profiles/availability';
import { combineDateAndTime } from '@/utils/dates';

import {
  appendTemplate,
  clampIntoSlotRange,
  mapOfferServerFieldErrors,
  offerDateDays,
  offerTimeRange,
  suggestOfferStart,
  toOfferSubmitProblem,
  urgencyWindowHours,
} from '../offer-form-model';

// 2026-09-27 is a Sunday (a working day in the default availability).
const local = (day: number, hour: number, minute = 0, month = 8) => new Date(2026, month, day, hour, minute);
const availability = createDefaultAvailability();

function expectValid(
  suggestion: { date: string; time: string } | null,
  request: Parameters<typeof suggestOfferStart>[0]['request'],
  now: Date,
) {
  expect(suggestion).not.toBeNull();
  const start = combineDateAndTime(suggestion!.date, suggestion!.time);
  expect(validateOfferAgainstRequest({ proposedStartAt: start, request, now }).isValid).toBe(true);
}

describe('offer form model', () => {
  it('limits the date picker to the urgency window', () => {
    const now = local(27, 10);
    expect(offerDateDays('emergency', now)).toBe(2);
    expect(offerDateDays('urgent', now)).toBe(4);
    expect(offerDateDays('normal', now)).toBe(14);
    expect(offerDateDays('flexible', now, 7)).toBe(7);
  });

  it('extends the time grid for emergencies', () => {
    expect(offerTimeRange('emergency')).toEqual({ start: '06:00', end: '23:30' });
    expect(offerTimeRange('normal')).toEqual({ start: '07:00', end: '21:00' });
  });

  it('clamps instants into the slot grid', () => {
    const range = offerTimeRange('normal');
    expect(clampIntoSlotRange(local(27, 10, 10), range)).toEqual(local(27, 10, 30));
    expect(clampIntoSlotRange(local(27, 5, 0), range)).toEqual(local(27, 7, 0));
    expect(clampIntoSlotRange(local(27, 20, 45), range)).toEqual(local(28, 7, 0));
  });

  it('prefers the customer preferred date and window', () => {
    const now = local(27, 10);
    const request = { urgency: 'normal' as const, preferredSchedule: { date: '2026-09-29', timeWindow: 'afternoon' as const } };
    const suggestion = suggestOfferStart({ request, availability, now });
    expect(suggestion).toEqual({ date: '2026-09-29', time: '12:00' });
    expectValid(suggestion, request, now);
  });

  it('moves a preferred window of today past the lead time', () => {
    const now = local(27, 12, 40);
    const request = { urgency: 'urgent' as const, preferredSchedule: { date: '2026-09-27', timeWindow: 'afternoon' as const } };
    expect(suggestOfferStart({ request, availability, now })).toEqual({ date: '2026-09-27', time: '14:00' });
  });

  it('falls back to the next working slot by urgency', () => {
    const now = local(27, 10);
    const emergency = { urgency: 'emergency' as const, preferredSchedule: null };
    expect(suggestOfferStart({ request: emergency, availability, now })).toEqual({ date: '2026-09-27', time: '11:00' });
    const urgent = { urgency: 'urgent' as const, preferredSchedule: null };
    expect(suggestOfferStart({ request: urgent, availability, now })).toEqual({ date: '2026-09-28', time: '08:00' });
    const normal = { urgency: 'normal' as const, preferredSchedule: null };
    expect(suggestOfferStart({ request: normal, availability, now })).toEqual({ date: '2026-09-29', time: '08:00' });
    const flexible = { urgency: 'flexible' as const, preferredSchedule: null };
    // Sunday + 3 days is Wednesday the 30th.
    expect(suggestOfferStart({ request: flexible, availability, now })).toEqual({ date: '2026-09-30', time: '08:00' });
    [emergency, urgent, normal, flexible].forEach((request) => expectValid(suggestOfferStart({ request, availability, now }), request, now));
  });

  it('ignores a preferred date outside the urgency window', () => {
    const now = local(27, 10);
    const request = { urgency: 'emergency' as const, preferredSchedule: { date: '2026-10-05', timeWindow: 'morning' as const } };
    const suggestion = suggestOfferStart({ request, availability, now });
    expect(suggestion?.date).toBe('2026-09-27');
    expectValid(suggestion, request, now);
  });

  it('works late at night and without availability', () => {
    const now = local(27, 23, 10);
    const request = { urgency: 'emergency' as const, preferredSchedule: null };
    const suggestion = suggestOfferStart({ request, availability: null, now });
    expect(suggestion).toEqual({ date: '2026-09-28', time: '06:00' });
    expectValid(suggestion, request, now);
  });

  it('appends templates as new paragraphs within the limit', () => {
    expect(appendTemplate('', 'Hello!', 500)).toBe('Hello!');
    expect(appendTemplate('Hi there  ', 'I can come today.', 500)).toBe('Hi there\n\nI can come today.');
    expect(appendTemplate('Hi\n\nI can come today.', 'I can come today.', 500)).toBe('Hi\n\nI can come today.');
    expect(appendTemplate('abc', 'defghij', 8)).toBe('abc\n\ndef');
  });

  it('maps server field errors onto form fields', () => {
    expect(
      mapOfferServerFieldErrors({
        price: ['validation:offer.priceTooLow'],
        proposedStartAt: ['validation:offer.startTooSoon', 'validation:offer.emergencyWindow'],
        message: ['validation:offer.messageTooLong'],
        unknown: ['x'],
      }),
    ).toEqual({
      price: 'validation:offer.priceTooLow',
      time: 'validation:offer.startTooSoon',
      message: 'validation:offer.messageTooLong',
    });
    expect(mapOfferServerFieldErrors(undefined)).toEqual({});
  });

  it('recognizes business conflicts and urgency windows', () => {
    expect(toOfferSubmitProblem('DUPLICATE_OFFER')).toBe('DUPLICATE_OFFER');
    expect(toOfferSubmitProblem('OUTSIDE_SERVICE_AREA')).toBe('OUTSIDE_SERVICE_AREA');
    expect(toOfferSubmitProblem('VALIDATION_ERROR')).toBeNull();
    expect(urgencyWindowHours('emergency')).toBe(24);
    expect(urgencyWindowHours('urgent')).toBe(72);
    expect(urgencyWindowHours('flexible')).toBeNull();
  });
});
