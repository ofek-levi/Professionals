import { createEmptyRequestFormValues, type RequestFormPhoto } from '@/lib/validation';
import { ApiError } from '@/services/api/errors';

import {
  addressLabel,
  apiFieldToFormField,
  DEFAULT_URGENCY,
  descriptionPlaceholderKey,
  firstErrorMessage,
  firstFormField,
  formLocationToService,
  isPhotoUploadFailure,
  keepPreferredDate,
  newPhotoFiles,
  pickedPhotosToForm,
  postedRequestHref,
  serviceLocationToForm,
  withDefaultUrgency,
} from '../request-form-model';

const photo = (overrides: Partial<RequestFormPhoto> = {}): RequestFormPhoto => ({
  uri: 'file:///a.jpg',
  mimeType: 'image/jpeg',
  fileName: 'a.jpg',
  fileSize: 1024,
  publicId: null,
  ...overrides,
});

describe('form fields', () => {
  it('maps API field paths to visible form fields', () => {
    expect(apiFieldToFormField('location.addressLine')).toBe('location');
    expect(apiFieldToFormField('photos')).toBe('photos');
    // A draft photo that is gone (edited elsewhere) is reported on `keepPhotos`.
    expect(apiFieldToFormField('keepPhotos')).toBe('photos');
    expect(apiFieldToFormField('categoryId')).toBe('categoryId');
    expect(apiFieldToFormField('urgency')).toBe('urgency');
    // Hidden or unknown fields have no place on the form.
    expect(apiFieldToFormField('preferredSchedule.date')).toBeNull();
    expect(apiFieldToFormField('notes')).toBeNull();
    expect(apiFieldToFormField('root')).toBeNull();
  });

  it('finds the topmost field with an error', () => {
    expect(firstFormField(['photos', 'description', 'location'])).toBe('description');
    expect(firstFormField(['categoryId', 'urgency'])).toBe('categoryId');
    expect(firstFormField(['notes'])).toBeNull();
  });

  it('preselects Normal urgency but keeps a draft’s choice', () => {
    expect(DEFAULT_URGENCY).toBe('normal');
    expect(withDefaultUrgency(createEmptyRequestFormValues()).urgency).toBe('normal');
    expect(withDefaultUrgency({ ...createEmptyRequestFormValues(), urgency: 'emergency' }).urgency).toBe('emergency');
  });

  it('links to the posted request with the one-time banner', () => {
    expect(postedRequestHref('req 1')).toBe('/requests/req%201?posted=1');
  });
});

describe('keepPreferredDate', () => {
  const morning = new Date(2026, 8, 27, 9, 0);

  it('keeps a draft’s preferred date only while it still fits the urgency', () => {
    expect(keepPreferredDate(null, 'normal', morning)).toBeNull();
    expect(keepPreferredDate('2026-09-30', 'normal', morning)).toBe('2026-09-30');
    expect(keepPreferredDate('2026-09-30', null, morning)).toBe('2026-09-30');
    // Emergency: within 24 hours → a date three days out no longer fits.
    expect(keepPreferredDate('2026-09-30', 'emergency', morning)).toBeNull();
    // Past dates are dropped.
    expect(keepPreferredDate('2026-09-20', 'flexible', morning)).toBeNull();
  });
});

describe('photo conversions', () => {
  it('sends only the photos that are not stored on the draft yet, as files', () => {
    const stored = photo({ uri: 'https://cdn/x.jpg', publicId: 'test/requests/x' });
    const added = pickedPhotosToForm([{ uri: 'blob:new', mimeType: null, fileName: null }]);
    expect(added).toEqual([{ uri: 'blob:new', mimeType: null, fileName: null, fileSize: null, publicId: null }]);
    expect(newPhotoFiles([stored, photo(), ...added])).toEqual([
      { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg', fileSize: 1024 },
      { uri: 'blob:new', mimeType: null, fileName: null, fileSize: null },
    ]);
  });
});

describe('isPhotoUploadFailure', () => {
  const error = (status: number, code: ApiError['code'], fieldErrors?: Record<string, string[]>) =>
    new ApiError(status, { code, message: 'x', ...(fieldErrors ? { fieldErrors } : {}) });

  it('recognises the refusals that name the photos: a refused photo, the image limits, the photo service', () => {
    expect(isPhotoUploadFailure(error(400, 'VALIDATION_ERROR', { photos: ['validation:upload.invalid'] }), true)).toBe(true);
    expect(isPhotoUploadFailure(error(413, 'VALIDATION_ERROR', { photos: ['validation:upload.invalid'] }), true)).toBe(true);
    expect(isPhotoUploadFailure(error(429, 'RATE_LIMITED', { photos: ['validation:upload.rateLimited'] }), true)).toBe(true);
    expect(isPhotoUploadFailure(error(503, 'SERVER_ERROR', { photos: ['validation:upload.unavailable'] }), true)).toBe(true);
  });

  it('leaves every other failure to the form, even with photos sent', () => {
    // The request limit (30 posts / h) runs before the image limit: removing the photos would not help.
    expect(isPhotoUploadFailure(error(429, 'RATE_LIMITED'), true)).toBe(false);
    expect(isPhotoUploadFailure(error(503, 'SERVER_ERROR'), true)).toBe(false);
    expect(isPhotoUploadFailure(error(500, 'SERVER_ERROR'), true)).toBe(false);
    expect(isPhotoUploadFailure(error(400, 'VALIDATION_ERROR', { description: ['validation:request.descriptionTooShort'] }), true)).toBe(false);
    // Too many photos is a message under the photos field.
    expect(isPhotoUploadFailure(error(400, 'VALIDATION_ERROR', { photos: ['validation:request.tooManyPhotos'] }), true)).toBe(false);
  });

  it('blames a proxy’s own 413 (no API body) on the photos only while they are being sent', () => {
    expect(isPhotoUploadFailure(error(413, 'VALIDATION_ERROR'), true)).toBe(true);
    expect(isPhotoUploadFailure(error(413, 'VALIDATION_ERROR'), false)).toBe(false);
  });
});

describe('descriptionPlaceholderKey', () => {
  it('uses the category group, falling back to a default', () => {
    expect(descriptionPlaceholderKey('moving_transportation')).toBe('moving_transportation');
    expect(descriptionPlaceholderKey(undefined)).toBe('default');
    expect(descriptionPlaceholderKey('unknown')).toBe('default');
  });
});

describe('location and error helpers', () => {
  const form = {
    coordinates: { latitude: 32.1, longitude: 34.8 },
    addressLine: 'Herzl St 5',
    city: 'Haifa',
    neighborhood: 'Hadar',
    details: 'Floor 2',
  };

  it('converts between the picker and the form location', () => {
    expect(formLocationToService(form)).toEqual({ ...form, isApproximate: false });
    expect(serviceLocationToForm({ ...form, isApproximate: true })).toEqual(form);
    expect(formLocationToService(null)).toBeNull();
  });

  it('labels an address in one line', () => {
    expect(addressLabel(form)).toBe('Herzl St 5, Haifa');
    expect(addressLabel({ ...form, city: '' })).toBe('Herzl St 5, Hadar');
    expect(addressLabel({ ...form, addressLine: ' ' })).toBe('Haifa');
  });

  it('finds nested error messages', () => {
    expect(firstErrorMessage({ message: 'validation:location.required', type: 'custom' })).toBe('validation:location.required');
    expect(firstErrorMessage({ addressLine: { message: 'validation:location.addressRequired', type: 'custom' } })).toBe(
      'validation:location.addressRequired',
    );
    expect(firstErrorMessage(undefined)).toBeUndefined();
  });
});
