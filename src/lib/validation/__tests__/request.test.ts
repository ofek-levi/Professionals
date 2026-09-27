import { APP_CONFIG } from '@/constants/app-config';
import { addDays, toDateKey } from '@/utils/dates';

import { zodIssuesToFieldErrors } from '../field-errors';
import {
  createEmptyRequestFormValues,
  createRequestFormSchema,
  createServiceRequestSchema,
  requestToFormValues,
  toCreateRequestPayload,
  toUpdateDraftRequestPayload,
  updateDraftRequestSchema,
  validatePreferredDate,
  validatePreferredDateForUrgency,
  type RequestFormValues,
} from '../request';

const NOW = new Date(2026, 8, 27, 10, 0);
const location = {
  coordinates: { latitude: 32.0567, longitude: 34.77 },
  addressLine: 'Florentin St 24',
  city: 'Tel Aviv-Yafo',
  neighborhood: 'Florentin',
  details: 'Apartment 7',
};

const validPayload = {
  categoryId: 'plumbing',
  description: 'Water is leaking under the kitchen sink',
  location,
  urgency: 'urgent',
  preferredSchedule: { date: '2026-09-29', timeWindow: 'morning' },
  photoIds: ['upl_1'],
  notes: 'Ring twice',
  publish: true,
};

const validForm = (): RequestFormValues => ({
  ...createEmptyRequestFormValues({ categoryId: 'plumbing' }),
  description: 'Water is leaking under the kitchen sink',
  location,
  urgency: 'urgent',
  preferredDate: toDateKey(addDays(NOW, 2)),
  preferredTimeWindow: 'morning',
  notes: '  Ring twice  ',
});

describe('request payload schema', () => {
  it('accepts a valid payload and applies defaults', () => {
    const parsed = createServiceRequestSchema.parse({ ...validPayload, notes: undefined, photoIds: undefined, publish: undefined });
    expect(parsed).toMatchObject({ categoryId: 'plumbing', notes: null, photoIds: [], publish: true });
  });

  it('rejects categories outside the catalog', () => {
    const result = createServiceRequestSchema.safeParse({ ...validPayload, categoryId: 'astrology' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodIssuesToFieldErrors(result.error)).toEqual({ categoryId: ['validation:category.unsupported'] });
    }
    const missing = createServiceRequestSchema.safeParse({ ...validPayload, categoryId: undefined });
    expect(!missing.success && zodIssuesToFieldErrors(missing.error).categoryId).toEqual(['validation:category.required']);
  });

  it('reports field errors with i18n keys', () => {
    const result = createServiceRequestSchema.safeParse({
      ...validPayload,
      description: ' short ',
      location: { ...location, addressLine: '  ', coordinates: { latitude: 200, longitude: 0 } },
      urgency: 'whenever',
      photoIds: Array.from({ length: APP_CONFIG.maxRequestPhotos + 1 }, (_, i) => `p${i}`),
      notes: 'x'.repeat(APP_CONFIG.notesMaxLength + 1),
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(zodIssuesToFieldErrors(result.error)).toEqual({
      description: ['validation:request.descriptionTooShort'],
      'location.addressLine': ['validation:location.addressRequired'],
      'location.coordinates': ['validation:location.coordinatesInvalid'],
      urgency: ['validation:request.urgencyRequired'],
      photoIds: ['validation:request.tooManyPhotos'],
      notes: ['validation:request.notesTooLong'],
    });
  });

  it('keeps partial draft updates partial (no defaults)', () => {
    expect(updateDraftRequestSchema.parse({ description: 'A much longer description here' })).toEqual({
      description: 'A much longer description here',
    });
  });

  it('validates preferred dates relative to now', () => {
    expect(validatePreferredDate(toDateKey(NOW), NOW)).toBeNull();
    expect(validatePreferredDate(toDateKey(addDays(NOW, -1)), NOW)).toBe('validation:request.preferredDateInPast');
    expect(validatePreferredDate(toDateKey(addDays(NOW, APP_CONFIG.maxScheduleDaysAhead)), NOW)).toBeNull();
    expect(validatePreferredDate(toDateKey(addDays(NOW, APP_CONFIG.maxScheduleDaysAhead + 1)), NOW)).toBe(
      'validation:request.preferredDateTooFar',
    );
    expect(validatePreferredDate('2026-13-01', NOW)).toBe('validation:request.preferredDateInvalid');
  });
});

describe('request wizard form', () => {
  const schema = createRequestFormSchema(() => NOW);

  it('accepts valid values and converts them to the payload', () => {
    const values = validForm();
    expect(schema.safeParse(values).success).toBe(true);
    const payload = toCreateRequestPayload(values, ['upl_1'], false);
    expect(payload).toEqual({
      categoryId: 'plumbing',
      description: 'Water is leaking under the kitchen sink',
      location: { ...location },
      urgency: 'urgent',
      preferredSchedule: { date: values.preferredDate, timeWindow: 'morning' },
      photoIds: ['upl_1'],
      notes: 'Ring twice',
      publish: false,
    });
    expect(createServiceRequestSchema.safeParse(payload).success).toBe(true);
    expect(toUpdateDraftRequestPayload(values, [])).not.toHaveProperty('publish');
  });

  it('requires category, location and urgency', () => {
    const result = schema.safeParse(createEmptyRequestFormValues());
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = zodIssuesToFieldErrors(result.error);
    expect(errors.categoryId).toEqual(['validation:category.required']);
    expect(errors.description).toEqual(['validation:request.descriptionRequired']);
    expect(errors.location).toEqual(['validation:location.required']);
    expect(errors.urgency).toEqual(['validation:request.urgencyRequired']);
  });

  it('validates the location fields, preferred date and photos', () => {
    const result = schema.safeParse({
      ...validForm(),
      categoryId: 'unknown',
      location: { ...location, city: '' },
      preferredDate: toDateKey(addDays(NOW, -2)),
      photos: Array.from({ length: APP_CONFIG.maxRequestPhotos + 1 }, (_, i) => ({
        uri: `file:///photo-${i}.jpg`,
        width: 100,
        height: 100,
        mimeType: 'image/jpeg',
        fileName: null,
      })),
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(zodIssuesToFieldErrors(result.error)).toEqual({
      categoryId: ['validation:category.unsupported'],
      'location.city': ['validation:location.cityRequired'],
      preferredDate: ['validation:request.preferredDateInPast'],
      photos: ['validation:request.tooManyPhotos'],
    });
  });

  it('rejects a preferred date that is too late for the urgency', () => {
    const nextWeek = toDateKey(addDays(NOW, 7));
    const result = schema.safeParse({ ...validForm(), urgency: 'emergency', preferredDate: nextWeek });
    expect(!result.success && zodIssuesToFieldErrors(result.error)).toEqual({
      preferredDate: ['validation:request.preferredDateBeyondUrgency'],
    });
    expect(schema.safeParse({ ...validForm(), urgency: 'normal', preferredDate: nextWeek }).success).toBe(true);
    expect(schema.safeParse({ ...validForm(), urgency: 'emergency', preferredDate: toDateKey(addDays(NOW, 1)) }).success).toBe(true);
    expect(validatePreferredDateForUrgency(toDateKey(addDays(NOW, 3)), 'urgent', NOW)).toBeNull();
    expect(validatePreferredDateForUrgency(toDateKey(addDays(NOW, 4)), 'urgent', NOW)).toBe('validation:request.preferredDateBeyondUrgency');
    expect(validatePreferredDateForUrgency(toDateKey(addDays(NOW, -1)), 'urgent', NOW)).toBe('validation:request.preferredDateInPast');
  });

  it('round-trips an existing draft', () => {
    const payload = toCreateRequestPayload(validForm(), ['upl_1'], false);
    const values = requestToFormValues({
      id: 'req_1',
      customerId: 'c',
      ...payload,
      location: { ...payload.location, isApproximate: false },
      photos: [{ id: 'upl_1', url: 'https://example.com/1.jpg', width: 800, height: 600 }],
      status: 'draft',
      offerCount: 0,
      pendingOfferCount: 0,
      acceptedOfferId: null,
      jobId: null,
      publishedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      cancellationComment: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(values.photos[0]).toMatchObject({ uri: 'https://example.com/1.jpg', uploadId: 'upl_1' });
    expect(values.notes).toBe('Ring twice');
    expect(() => toCreateRequestPayload(createEmptyRequestFormValues(), [], true)).toThrow();
  });
});
