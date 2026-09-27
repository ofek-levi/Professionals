import type { RequestFormPhoto } from '@/lib/validation';

import {
  apiFieldToFormField,
  descriptionPlaceholderKey,
  firstErrorMessage,
  firstStepWithError,
  formLocationToService,
  formPhotosToPicked,
  getInitialStepIndex,
  photosToUpload,
  pickedPhotosToForm,
  PREFERRED_DATE_DAYS,
  preferredDateDayCount,
  REQUEST_WIZARD_STEPS,
  serviceLocationToForm,
  stepIndexForField,
  toUploadPayload,
} from '../wizard-model';

const photo = (overrides: Partial<RequestFormPhoto> = {}): RequestFormPhoto => ({
  uri: 'file:///a.jpg',
  width: 800,
  height: 600,
  mimeType: 'image/jpeg',
  fileName: 'a.jpg',
  uploadId: null,
  ...overrides,
});

describe('wizard steps', () => {
  it('starts drafts on the review and skips the service step for a preselected category', () => {
    expect(REQUEST_WIZARD_STEPS[getInitialStepIndex({ isDraft: true, hasCategory: true })]).toBe('review');
    expect(REQUEST_WIZARD_STEPS[getInitialStepIndex({ isDraft: false, hasCategory: true })]).toBe('details');
    expect(REQUEST_WIZARD_STEPS[getInitialStepIndex({ isDraft: false, hasCategory: false })]).toBe('service');
  });

  it('finds the step of each field', () => {
    expect(REQUEST_WIZARD_STEPS[stepIndexForField('categoryId')]).toBe('service');
    expect(REQUEST_WIZARD_STEPS[stepIndexForField('photos')]).toBe('details');
    expect(REQUEST_WIZARD_STEPS[stepIndexForField('location')]).toBe('location');
    expect(REQUEST_WIZARD_STEPS[stepIndexForField('preferredDate')]).toBe('schedule');
    expect(REQUEST_WIZARD_STEPS[firstStepWithError(['urgency', 'description'])]).toBe('details');
    expect(REQUEST_WIZARD_STEPS[firstStepWithError([])]).toBe('review');
  });

  it('maps API field paths to form fields', () => {
    expect(apiFieldToFormField('location.addressLine')).toBe('location');
    expect(apiFieldToFormField('photoIds')).toBe('photos');
    expect(apiFieldToFormField('photoIds.2')).toBe('photos');
    expect(apiFieldToFormField('preferredSchedule.date')).toBe('preferredDate');
    expect(apiFieldToFormField('preferredSchedule.timeWindow')).toBe('preferredTimeWindow');
    expect(apiFieldToFormField('categoryId')).toBe('categoryId');
    expect(apiFieldToFormField('root')).toBeNull();
  });
});

describe('photo conversions', () => {
  it('round-trips picker values and keeps upload ids', () => {
    const uploaded = photo({ uri: 'https://cdn/x.jpg', uploadId: 'upl_1', width: 0, height: 0 });
    const picked = formPhotosToPicked([uploaded, photo()]);
    expect(picked[0]).toEqual({ uri: 'https://cdn/x.jpg', mimeType: 'image/jpeg', width: null, height: null, fileName: 'a.jpg' });

    const next = pickedPhotosToForm([...picked, { uri: 'blob:new', mimeType: null, width: null, height: null, fileName: null }], [uploaded, photo()]);
    expect(next.map((item) => item.uploadId)).toEqual(['upl_1', null, null]);
    expect(next[2]).toMatchObject({ width: 0, height: 0 });
    expect(photosToUpload(next).map((item) => item.uri)).toEqual(['file:///a.jpg', 'blob:new']);
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
  it('converts between the picker and the form location', () => {
    const form = {
      coordinates: { latitude: 32.1, longitude: 34.8 },
      addressLine: 'Herzl St 5',
      city: 'Haifa',
      neighborhood: null,
      details: 'Floor 2',
    };
    const service = formLocationToService(form);
    expect(service).toEqual({ ...form, isApproximate: false });
    expect(serviceLocationToForm({ ...form, isApproximate: true })).toEqual(form);
    expect(formLocationToService(null)).toBeNull();
  });

  it('finds nested error messages', () => {
    expect(firstErrorMessage({ message: 'validation:location.required', type: 'custom' })).toBe('validation:location.required');
    expect(firstErrorMessage({ addressLine: { message: 'validation:location.addressRequired', type: 'custom' } })).toBe(
      'validation:location.addressRequired',
    );
    expect(firstErrorMessage(undefined)).toBeUndefined();
  });
});

describe('preferredDateDayCount', () => {
  it('limits the preferred dates to what the urgency allows', () => {
    const morning = new Date(2026, 8, 27, 9, 0);
    expect(preferredDateDayCount(null, morning)).toBe(PREFERRED_DATE_DAYS);
    expect(preferredDateDayCount('flexible', morning)).toBe(PREFERRED_DATE_DAYS);
    expect(preferredDateDayCount('normal', morning)).toBe(PREFERRED_DATE_DAYS);
    // Emergency: within 24 h → today and tomorrow. Urgent: within 72 h → today + 3 days.
    expect(preferredDateDayCount('emergency', morning)).toBe(2);
    expect(preferredDateDayCount('urgent', morning)).toBe(4);
  });
});
