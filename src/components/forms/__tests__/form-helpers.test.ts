import { parsePriceInput } from '../price-input';
import { buildTimeSlots } from '../time-slots';

// price-input imports the formatters hook, which pulls in the catalog hook → API singleton.
jest.mock('@/services/api', () => ({ api: {} }));

describe('buildTimeSlots', () => {
  it('creates slots in the range (end excluded)', () => {
    expect(buildTimeSlots({ start: '08:00', end: '10:00', stepMinutes: 30 })).toEqual(['08:00', '08:30', '09:00', '09:30']);
    expect(buildTimeSlots({ start: '22:00', end: '23:59', stepMinutes: 60 })).toEqual(['22:00', '23:00']);
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
