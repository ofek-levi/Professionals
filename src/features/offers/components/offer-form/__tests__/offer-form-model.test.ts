import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { createDefaultAvailability } from '@/features/profiles/availability';
import { combineDateAndTime } from '@/utils/dates';

import {
  groupTimesByPeriod,
  mapOfferServerFieldErrors,
  offerDayPeriod,
  offerDateDays,
  offerDateOptions,
  offerSlotRange,
  offerTimeSlots,
  suggestOfferStart,
  toOfferSubmitProblem,
  urgencyWindowHours,
} from '../offer-form-model';

// 2026-09-27 is a Sunday (a working day in the default availability); 2026-10-03 a Saturday (day off).
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
  it('limits the date chips to a week and the urgency window', () => {
    const now = local(27, 10);
    expect(offerDateDays('emergency', now)).toBe(2);
    expect(offerDateDays('urgent', now)).toBe(4);
    expect(offerDateDays('normal', now)).toBe(7);
    expect(offerDateDays('flexible', now, 3)).toBe(3);
  });

  it('offers slots within the working hours, or 07:00–20:00 on a day off', () => {
    expect(offerSlotRange(availability, local(27, 12))).toEqual({ start: '08:00', end: '18:00' });
    expect(offerSlotRange(availability, local(3, 12, 0, 9))).toEqual({ start: '07:00', end: '20:00' });
    expect(offerSlotRange(null, local(27, 12))).toEqual({ start: '07:00', end: '20:00' });

    const saturday = offerTimeSlots({ date: '2026-10-03', urgency: 'normal', availability, now: local(27, 10) });
    expect(saturday[0]).toEqual({ time: '07:00', disabled: false });
    expect(saturday.at(-1)).toEqual({ time: '19:30', disabled: false });
    expect(saturday).toHaveLength(26);
  });

  it('disables slots inside the lead time and beyond the urgency window', () => {
    const now = local(27, 10);
    const today = offerTimeSlots({ date: '2026-09-27', urgency: 'normal', availability, now });
    expect(today.filter((slot) => slot.disabled).map((slot) => slot.time)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00']);
    expect(today.find((slot) => slot.time === '10:30')?.disabled).toBe(false);

    // An emergency must start within 24 hours: tomorrow until 10:00.
    const tomorrow = offerTimeSlots({ date: '2026-09-28', urgency: 'emergency', availability, now });
    expect(tomorrow.find((slot) => slot.time === '10:00')?.disabled).toBe(false);
    expect(tomorrow.find((slot) => slot.time === '10:30')?.disabled).toBe(true);
    expect(offerTimeSlots({ date: 'nope', urgency: 'normal', availability, now })).toEqual([]);
  });

  it('disables days without a free slot', () => {
    const evening = local(27, 19, 30);
    const options = offerDateOptions({ urgency: 'urgent', availability, now: evening });
    expect(options.map((option) => option.date)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']);
    expect(options[0].disabled).toBe(true);
    expect(options.slice(1).every((option) => !option.disabled)).toBe(true);
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
    expect(suggestion).toEqual({ date: '2026-09-28', time: '07:00' });
    expectValid(suggestion, request, now);
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

  it('splits the time slots into morning, afternoon and evening', () => {
    expect(offerDayPeriod('07:30')).toBe('morning');
    expect(offerDayPeriod('11:30')).toBe('morning');
    expect(offerDayPeriod('12:00')).toBe('afternoon');
    expect(offerDayPeriod('16:30')).toBe('afternoon');
    expect(offerDayPeriod('17:00')).toBe('evening');
    expect(groupTimesByPeriod(['08:00', '11:30', '12:00', '17:30'])).toEqual([
      { period: 'morning', times: ['08:00', '11:30'] },
      { period: 'afternoon', times: ['12:00'] },
      { period: 'evening', times: ['17:30'] },
    ]);
    // Empty periods are left out.
    expect(groupTimesByPeriod(['13:00', '13:30']).map((group) => group.period)).toEqual(['afternoon']);
    expect(groupTimesByPeriod([])).toEqual([]);
  });
});
