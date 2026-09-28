import { initI18n } from '@/i18n';

import {
  formatCurrency,
  formatDate,
  formatDateLabel,
  formatDateTime,
  formatDistanceKm,
  formatRelative,
  formatTime,
  getCurrencySymbol,
} from '../format';

/** Strips bidi control marks Intl inserts for Hebrew and normalizes non-breaking spaces. */
const clean = (value: string) => value.replace(/[\u200e\u200f\u061c]/g, '').replace(/\u00a0/g, ' ');

describe('utils/format', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  const now = new Date(2026, 8, 27, 10, 0, 0); // Sun, Sep 27 2026 10:00 local

  it('formats currency per language without decimals for whole amounts', () => {
    expect(formatCurrency(1250, 'ILS', 'en')).toBe('₪1,250');
    expect(clean(formatCurrency(1250, 'ILS', 'he'))).toBe('1,250 ₪');
    expect(formatCurrency(99.5, 'USD', 'en')).toBe('$99.50');
    expect(getCurrencySymbol('ILS', 'en')).toBe('₪');
  });

  it('formats distances with sensible precision', () => {
    expect(formatDistanceKm(0.04, 'en')).toBe('0.1 km');
    expect(formatDistanceKm(3.26, 'en')).toBe('3.3 km');
    expect(formatDistanceKm(12.6, 'en', { away: true })).toBe('13 km away');
    expect(formatDistanceKm(3.26, 'he')).toBe('3.3 ק״מ');
    expect(formatDistanceKm(3.26, 'he', { away: true })).toBe('במרחק 3.3 ק״מ');
  });

  it('formats dates and 24h times in both languages', () => {
    const date = new Date(2026, 8, 27, 14, 30);
    expect(formatDate(date, 'en', 'medium')).toBe('Sep 27, 2026');
    expect(formatDate(date, 'he', 'medium')).toBe('27 בספט׳ 2026');
    expect(formatTime(date, 'en')).toBe('14:30');
    expect(formatTime(date, 'he')).toBe('14:30');
    expect(formatDate('2026-09-27', 'en', 'dayMonth')).toBe('Sep 27');
  });

  it('uses relative day labels', () => {
    expect(formatDateLabel(now, 'en', { now })).toBe('Today');
    expect(formatDateLabel(new Date(2026, 8, 28), 'en', { now })).toBe('Tomorrow');
    expect(formatDateLabel(new Date(2026, 8, 28), 'he', { now })).toBe('מחר');
    expect(formatDateLabel(new Date(2026, 8, 30), 'en', { now })).toBe('Wed, Sep 30');
    expect(formatDateLabel(new Date(2026, 8, 28), 'en', { now, relativeDay: false, preset: 'dayMonth' })).toBe('Sep 28');
    expect(formatDateTime(new Date(2026, 8, 28, 9, 0), 'en', { now })).toBe('Tomorrow at 09:00');
    expect(formatDateTime(new Date(2026, 8, 28, 9, 0), 'he', { now })).toBe('מחר בשעה 09:00');
  });

  it('lower-cases relative words for use inside a sentence', () => {
    const tomorrowMorning = new Date(2026, 8, 28, 9, 0);
    expect(formatDateLabel(now, 'en', { now, casing: 'inline' })).toBe('today');
    expect(formatDateLabel(new Date(2026, 8, 26), 'en', { now, casing: 'inline' })).toBe('yesterday');
    expect(formatDateTime(tomorrowMorning, 'en', { now, casing: 'inline' })).toBe('tomorrow at 09:00');
    expect(formatDateTime(tomorrowMorning, 'en', { now, casing: 'sentence' })).toBe('Tomorrow at 09:00');
    expect(formatDateTime(tomorrowMorning, 'he', { now, casing: 'inline' })).toBe('מחר בשעה 09:00');
    expect(formatRelative(new Date(now.getTime() - 20_000), 'en', now, { casing: 'inline' })).toBe('just now');
    expect(formatRelative(new Date(now.getTime() - 20_000), 'he', now, { casing: 'inline' })).toBe('הרגע');
    // Dates keep their own casing.
    expect(formatDateLabel(new Date(2026, 8, 30), 'en', { now, casing: 'inline' })).toBe('Wed, Sep 30');
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000), 'en', now, { casing: 'inline' })).toBe('5 minutes ago');
  });

  it('formats relative times', () => {
    expect(formatRelative(new Date(now.getTime() - 20_000), 'en', now)).toBe('Just now');
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000), 'en', now)).toBe('5 minutes ago');
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000), 'he', now)).toBe('לפני 5 דקות');
    expect(formatRelative(new Date(now.getTime() + 3 * 3_600_000), 'en', now)).toBe('in 3 hours');
  });
});
