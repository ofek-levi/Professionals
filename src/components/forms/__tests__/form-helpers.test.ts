import { parsePriceInput } from '../price-input';
import { buildTimeSlots } from '../time-slots';

// price-input imports the formatters hook, which pulls in the catalog hook → API singleton.
jest.mock('@/services/api', () => ({ api: {} }));

describe('buildTimeSlots', () => {
  const now = new Date(2026, 8, 27, 13, 10);

  it('creates 30 minute slots in the range', () => {
    const slots = buildTimeSlots({ start: '08:00', end: '10:00', stepMinutes: 30, now });
    expect(slots.map((slot) => slot.time)).toEqual(['08:00', '08:30', '09:00', '09:30']);
    expect(slots.every((slot) => !slot.disabled)).toBe(true);
  });

  it('disables past slots (plus lead time) for today only', () => {
    const today = buildTimeSlots({ start: '13:00', end: '15:00', stepMinutes: 30, date: '2026-09-27', now, minLeadMinutes: 30 });
    expect(today.filter((slot) => slot.disabled).map((slot) => slot.time)).toEqual(['13:00', '13:30']);
    const tomorrow = buildTimeSlots({ start: '13:00', end: '15:00', stepMinutes: 30, date: '2026-09-28', now, minLeadMinutes: 30 });
    expect(tomorrow.some((slot) => slot.disabled)).toBe(false);
  });
});

describe('parsePriceInput', () => {
  it('keeps digits only', () => {
    expect(parsePriceInput('1,250')).toBe(1250);
    expect(parsePriceInput('₪ 400')).toBe(400);
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('abc')).toBeNull();
  });
});
