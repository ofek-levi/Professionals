import { createDefaultAvailability } from '@/features/profiles/availability';

import { OFFER_TIME_RULES, validateOfferAgainstRequest } from '../offer-rules';

const NOW = new Date('2026-09-27T07:00:00.000Z');
const inMinutes = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const codes = (result: ReturnType<typeof validateOfferAgainstRequest>) => result.errors.map((issue) => issue.code);

const normal = { urgency: 'normal' as const, preferredSchedule: null };

describe('offer time rules', () => {
  it('requires at least 30 minutes of lead time', () => {
    expect(codes(validateOfferAgainstRequest({ proposedStartAt: inMinutes(29), request: normal, now: NOW }))).toEqual([
      'start_too_soon',
    ]);
    expect(validateOfferAgainstRequest({ proposedStartAt: inMinutes(30), request: normal, now: NOW }).isValid).toBe(true);
    expect(codes(validateOfferAgainstRequest({ proposedStartAt: inMinutes(-60), request: normal, now: NOW }))).toEqual([
      'start_too_soon',
    ]);
  });

  it('limits how far ahead an appointment can be proposed', () => {
    const limit = OFFER_TIME_RULES.maxDaysAhead * 24 * 60;
    expect(validateOfferAgainstRequest({ proposedStartAt: inMinutes(limit), request: normal, now: NOW }).isValid).toBe(true);
    expect(codes(validateOfferAgainstRequest({ proposedStartAt: inMinutes(limit + 1), request: normal, now: NOW }))).toEqual([
      'start_too_far',
    ]);
  });

  it('enforces urgency windows', () => {
    const emergency = { urgency: 'emergency' as const, preferredSchedule: null };
    const urgent = { urgency: 'urgent' as const, preferredSchedule: null };
    expect(validateOfferAgainstRequest({ proposedStartAt: inMinutes(23 * 60), request: emergency, now: NOW }).isValid).toBe(true);
    const tooLateEmergency = validateOfferAgainstRequest({ proposedStartAt: inMinutes(25 * 60), request: emergency, now: NOW });
    expect(codes(tooLateEmergency)).toEqual(['emergency_window']);
    expect(tooLateEmergency.errors[0].message).toBe('validation:offer.emergencyWindow');
    expect(validateOfferAgainstRequest({ proposedStartAt: inMinutes(71 * 60), request: urgent, now: NOW }).isValid).toBe(true);
    expect(codes(validateOfferAgainstRequest({ proposedStartAt: inMinutes(73 * 60), request: urgent, now: NOW }))).toEqual([
      'urgent_window',
    ]);
  });

  it('rejects unparseable dates', () => {
    expect(codes(validateOfferAgainstRequest({ proposedStartAt: 'not a date', request: normal, now: NOW }))).toEqual([
      'start_invalid',
    ]);
  });

  it('warns about the preferred schedule and working hours without blocking', () => {
    const start = new Date(2026, 9, 1, 20, 0); // local 20:00 on Oct 1st (a Thursday)
    const request = { urgency: 'normal' as const, preferredSchedule: { date: '2026-10-02', timeWindow: 'morning' as const } };
    const differentDay = validateOfferAgainstRequest({ proposedStartAt: start, request, now: NOW });
    expect(differentDay.isValid).toBe(true);
    expect(differentDay.warnings.map((issue) => issue.code)).toEqual(['different_from_preferred_date']);

    const sameDay = validateOfferAgainstRequest({
      proposedStartAt: new Date(2026, 9, 2, 15, 0),
      request,
      now: NOW,
      availability: createDefaultAvailability(),
    });
    // Friday 15:00: outside the morning window and after the default Friday hours (08:00–13:00).
    expect(sameDay.warnings.map((issue) => issue.code)).toEqual(['outside_preferred_time_window', 'outside_working_hours']);
  });
});
