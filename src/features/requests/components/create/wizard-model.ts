/**
 * Pure helpers of the create-request wizard: steps and their fields, mapping API field errors
 * back onto wizard fields, and conversions between picked photos and form photos.
 */
import type { CategoryGroupId } from '@/constants/professional-categories';
import type { PickedPhoto } from '@/components/forms';
import type { RequestFormLocation, RequestFormPhoto, RequestFormValues } from '@/lib/validation';
import type { UploadImagePayload } from '@/types/api';
import type { ServiceLocation } from '@/types/domain';

export const REQUEST_WIZARD_STEPS = ['service', 'details', 'location', 'schedule', 'review'] as const;
export type RequestWizardStep = (typeof REQUEST_WIZARD_STEPS)[number];

export type RequestFormField = keyof RequestFormValues;

/** Form fields validated when leaving each step. */
export const STEP_FIELDS: Record<RequestWizardStep, readonly RequestFormField[]> = {
  service: ['categoryId'],
  details: ['description', 'photos', 'notes'],
  location: ['location'],
  schedule: ['urgency', 'preferredDate', 'preferredTimeWindow'],
  review: [],
};

export const REVIEW_STEP_INDEX = REQUEST_WIZARD_STEPS.indexOf('review');

/**
 * First step to show: drafts open on the review, a preselected category skips the service step.
 */
export function getInitialStepIndex(options: { isDraft: boolean; hasCategory: boolean }): number {
  if (options.isDraft) return REVIEW_STEP_INDEX;
  return options.hasCategory ? REQUEST_WIZARD_STEPS.indexOf('details') : 0;
}

/** Maps a server field path (`location.addressLine`, `photoIds`, `preferredSchedule.date`) to a form field. */
export function apiFieldToFormField(path: string): RequestFormField | null {
  const [head, child] = path.split('.');
  switch (head) {
    case 'categoryId':
    case 'description':
    case 'location':
    case 'urgency':
    case 'notes':
      return head;
    case 'photoIds':
    case 'photos':
      return 'photos';
    case 'preferredSchedule':
      return child === 'timeWindow' ? 'preferredTimeWindow' : 'preferredDate';
    case 'preferredDate':
    case 'preferredTimeWindow':
      return head;
    default:
      return null;
  }
}

/** Wizard step index that contains a form field. */
export function stepIndexForField(field: RequestFormField): number {
  const index = REQUEST_WIZARD_STEPS.findIndex((step) => STEP_FIELDS[step].includes(field));
  return index === -1 ? REVIEW_STEP_INDEX : index;
}

/** Earliest step containing one of the fields (review step when none). */
export function firstStepWithError(fields: readonly RequestFormField[]): number {
  return fields.reduce((min, field) => Math.min(min, stepIndexForField(field)), REVIEW_STEP_INDEX);
}

/** Form photos → the `PhotoPicker` value. */
export function formPhotosToPicked(photos: readonly RequestFormPhoto[]): PickedPhoto[] {
  return photos.map((photo) => ({
    uri: photo.uri,
    mimeType: photo.mimeType,
    width: photo.width > 0 ? photo.width : null,
    height: photo.height > 0 ? photo.height : null,
    fileName: photo.fileName,
  }));
}

/** `PhotoPicker` value → form photos, keeping the upload id of photos that were already uploaded. */
export function pickedPhotosToForm(picked: readonly PickedPhoto[], previous: readonly RequestFormPhoto[]): RequestFormPhoto[] {
  return picked.map((photo) => {
    const existing = previous.find((item) => item.uri === photo.uri);
    return {
      uri: photo.uri,
      mimeType: photo.mimeType,
      width: photo.width ?? 0,
      height: photo.height ?? 0,
      fileName: photo.fileName,
      uploadId: existing?.uploadId ?? null,
    };
  });
}

/** Upload payload of a form photo (the API rejects non-positive dimensions). */
export function toUploadPayload(photo: RequestFormPhoto): UploadImagePayload {
  return {
    uri: photo.uri,
    mimeType: photo.mimeType,
    width: photo.width > 0 ? photo.width : null,
    height: photo.height > 0 ? photo.height : null,
    fileName: photo.fileName,
  };
}

/** Photos that still need uploading. */
export function photosToUpload(photos: readonly RequestFormPhoto[]): RequestFormPhoto[] {
  return photos.filter((photo) => !photo.uploadId);
}

/** Description placeholder flavor per catalog group (`requests:details.placeholders.<key>`). */
export type DescriptionPlaceholderKey = CategoryGroupId | 'default';

export function descriptionPlaceholderKey(groupId: string | null | undefined): DescriptionPlaceholderKey {
  switch (groupId) {
    case 'home_repairs':
    case 'construction_renovation':
    case 'moving_transportation':
    case 'other_services':
      return groupId;
    default:
      return 'default';
  }
}

/** Form location → the `LocationPicker` value. */
export function formLocationToService(location: RequestFormLocation | null): ServiceLocation | null {
  if (!location) return null;
  return {
    coordinates: { ...location.coordinates },
    addressLine: location.addressLine,
    city: location.city,
    neighborhood: location.neighborhood,
    details: location.details,
    isApproximate: false,
  };
}

/** `LocationPicker` value → form location (the server controls `isApproximate`). */
export function serviceLocationToForm(location: ServiceLocation): RequestFormLocation {
  return {
    coordinates: { ...location.coordinates },
    addressLine: location.addressLine,
    city: location.city,
    neighborhood: location.neighborhood,
    details: location.details,
  };
}

/** First error message of a (possibly nested) react-hook-form error, e.g. `location.addressLine`. */
export function firstErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) return record.message;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'ref' || key === 'type') continue;
    const nested = firstErrorMessage(value);
    if (nested) return nested;
  }
  return undefined;
}
