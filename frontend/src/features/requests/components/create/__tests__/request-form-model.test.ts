import { createEmptyRequestFormValues, type RequestFormPhoto } from '@/lib/validation';

import {
  addressLabel,
  apiFieldToFormField,
  DEFAULT_URGENCY,
  descriptionPlaceholderKey,
  firstErrorMessage,
  firstFormField,
  formLocationToService,
  keepPreferredDate,
  photosToUpload,
  pickedPhotosToForm,
  postedRequestHref,
  serviceLocationToForm,
  toUploadPayload,
  withDefaultUrgency,
} from '../request-form-model';

const photo = (overrides: Partial<RequestFormPhoto> = {}): RequestFormPhoto => ({
  uri: 'file:///a.jpg',
  width: 800,
  height: 600,
  mimeType: 'image/jpeg',
  fileName: 'a.jpg',
  uploadId: null,
  ...overrides,
});

describe('form fields', () => {
  it('maps API field paths to visible form fields', () => {
    expect(apiFieldToFormField('location.addressLine')).toBe('location');
    expect(apiFieldToFormField('photoIds')).toBe('photos');
    expect(apiFieldToFormField('photoIds.2')).toBe('photos');
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
  it('converts picked photos and form photos', () => {
    const uploaded = photo({ uri: 'https://cdn/x.jpg', uploadId: 'upl_1', width: 0, height: 0 });
    const added = pickedPhotosToForm([{ uri: 'blob:new', mimeType: null, width: null, height: null, fileName: null }]);
    expect(added[0]).toMatchObject({ uri: 'blob:new', width: 0, height: 0, uploadId: null });
    expect(photosToUpload([uploaded, photo(), ...added]).map((item) => item.uri)).toEqual(['file:///a.jpg', 'blob:new']);
  });

  it('never sends non-positive dimensions to the upload API', () => {
    expect(toUploadPayload(photo({ width: 0, height: 0 }))).toMatchObject({ width: null, height: null });
    expect(toUploadPayload(photo())).toMatchObject({ width: 800, height: 600 });
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
