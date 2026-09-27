import {
  adjustEndForStart,
  clampRadiusKm,
  firstEndOption,
  firstNestedMessage,
  isLanguageOption,
  mapProfileServerFieldErrors,
  RADIUS_PRESETS_KM,
} from '../pro-form-model';

describe('professional profile form model', () => {
  it('keeps radius presets within the configured bounds', () => {
    expect(RADIUS_PRESETS_KM).toEqual([5, 10, 15, 25, 40, 60, 80]);
    expect(clampRadiusKm(1)).toBe(3);
    expect(clampRadiusKm(12.4)).toBe(12);
    expect(clampRadiusKm(500)).toBe(80);
  });

  it('starts end options half an hour after the start', () => {
    expect(firstEndOption('08:00')).toBe('08:30');
    expect(firstEndOption('23:00')).toBe('23:30');
    expect(firstEndOption('23:30')).toBe('23:30');
  });

  it('moves the end when the start passes it', () => {
    expect(adjustEndForStart('09:00', '17:00', '08:00')).toBe('17:00');
    expect(adjustEndForStart('18:00', '17:00', '08:00')).toBe('23:30');
    expect(adjustEndForStart('12:00', '11:00', '08:00')).toBe('15:00');
  });

  it('recognizes language options', () => {
    expect(isLanguageOption('he')).toBe(true);
    expect(isLanguageOption('xx')).toBe(false);
  });

  it('maps nested server errors to flat form fields', () => {
    expect(
      mapProfileServerFieldErrors({
        'contact.phone': ['validation:profile.phoneInvalid'],
        'business.licenseNumber': ['validation:profile.licenseNumberInvalid'],
        'startingPrice.amount': ['validation:offer.priceTooLow'],
        'serviceArea.radiusKm': ['validation:profile.radiusTooLarge'],
        'availability.days': ['validation:profile.availabilityNoDays'],
        bio: ['validation:profile.bioTooShort', 'other'],
        unknownField: ['x'],
      }),
    ).toEqual({
      phone: 'validation:profile.phoneInvalid',
      licenseNumber: 'validation:profile.licenseNumberInvalid',
      startingPrice: 'validation:offer.priceTooLow',
      'serviceArea.radiusKm': 'validation:profile.radiusTooLarge',
      'availability.days': 'validation:profile.availabilityNoDays',
      bio: 'validation:profile.bioTooShort',
    });
    expect(mapProfileServerFieldErrors(undefined)).toEqual({});
  });

  it('finds the first nested error message', () => {
    expect(firstNestedMessage(undefined)).toBeUndefined();
    expect(firstNestedMessage({ message: 'validation:required', type: 'custom' })).toBe('validation:required');
    expect(
      firstNestedMessage({ ref: { message: 'ignored' }, addressLine: { type: 'custom', message: 'validation:location.addressRequired' } }),
    ).toBe('validation:location.addressRequired');
    expect(firstNestedMessage({ sun: { end: { message: 'validation:profile.availabilityEndBeforeStart' } } })).toBe(
      'validation:profile.availabilityEndBeforeStart',
    );
  });
});
