/**
 * Pure helpers of the one-screen request form: the fields it shows, mapping API field errors back
 * onto them, photo and location conversions, and what a draft keeps of its hidden fields.
 */
import type { Href } from 'expo-router';

import type { PickedPhoto } from '@/components/forms';
import type { CategoryGroupId } from '@/constants/professional-categories';
import { routes } from '@/lib/routes';
import { validatePreferredDateForUrgency, type RequestFormLocation, type RequestFormPhoto, type RequestFormValues } from '@/lib/validation';
import type { UploadImagePayload } from '@/types/api';
import type { ServiceLocation, UrgencyLevel } from '@/types/domain';

/** Fields the form shows, top to bottom (errors scroll to the first one). */
const REQUEST_FORM_FIELDS = ['categoryId', 'description', 'urgency', 'location', 'photos'] as const;
export type RequestFormField = (typeof REQUEST_FORM_FIELDS)[number];

/** A new request starts as "Normal" – most jobs are, and it keeps the form to a few taps. */
export const DEFAULT_URGENCY: UrgencyLevel = 'normal';

/** Search param of the request screen that shows the one-time "Request posted" banner. */
export const POSTED_PARAM = 'posted';

/** The request screen right after posting (with the one-time success banner). */
export function postedRequestHref(requestId: string): Href {
  return `${String(routes.request(requestId))}?${POSTED_PARAM}=1` as Href;
}

/** Maps a server field path (`location.addressLine`, `photoIds.2`) to a visible form field. */
export function apiFieldToFormField(path: string): RequestFormField | null {
  const [head] = path.split('.');
  switch (head) {
    case 'categoryId':
    case 'description':
    case 'location':
    case 'urgency':
    case 'photos':
      return head;
    case 'photoIds':
      return 'photos';
    default:
      return null;
  }
}

/** The first field (top to bottom) among `fields`, or `null`. */
export function firstFormField(fields: readonly string[]): RequestFormField | null {
  return REQUEST_FORM_FIELDS.find((field) => fields.includes(field)) ?? null;
}

/**
 * A draft's preferred date (no longer editable here) is kept only while it is still valid for the
 * chosen urgency; otherwise it is dropped so it never blocks posting.
 */
export function keepPreferredDate(date: string | null, urgency: UrgencyLevel | null, now: Date): string | null {
  if (!date) return null;
  return validatePreferredDateForUrgency(date, urgency ?? DEFAULT_URGENCY, now) ? null : date;
}

/** Initial values: Normal urgency unless a draft says otherwise. */
export function withDefaultUrgency(values: RequestFormValues): RequestFormValues {
  return values.urgency ? values : { ...values, urgency: DEFAULT_URGENCY };
}

/** Newly picked photos → form photos (not uploaded yet). */
export function pickedPhotosToForm(picked: readonly PickedPhoto[]): RequestFormPhoto[] {
  return picked.map((photo) => ({
    uri: photo.uri,
    mimeType: photo.mimeType,
    width: photo.width ?? 0,
    height: photo.height ?? 0,
    fileName: photo.fileName,
    uploadId: null,
  }));
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

/** Photos that still need uploading (a draft's photos are already uploaded). */
export function photosToUpload(photos: readonly RequestFormPhoto[]): RequestFormPhoto[] {
  return photos.filter((photo) => !photo.uploadId);
}

/** Description placeholder flavor per catalog group (`requests:form.placeholders.<key>`). */
type DescriptionPlaceholderKey = CategoryGroupId | 'default';

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

/** One line for the address row: "Florentin St 24, Tel Aviv-Yafo". */
export function addressLabel(location: Pick<RequestFormLocation, 'addressLine' | 'city' | 'neighborhood'>): string {
  const place = location.city || location.neighborhood;
  return [location.addressLine.trim(), place?.trim()].filter(Boolean).join(', ');
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
