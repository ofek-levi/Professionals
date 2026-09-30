/**
 * Field names of the multipart routes. The API has the same constant
 * (`backend/src/shared/multipart-fields.ts`); its contract check fails when they differ.
 */
export const MULTIPART_FIELDS = {
  /** Text field with the JSON payload of `POST /requests` and `PATCH /requests/:id`. */
  payload: 'data',
  /** Files of a request (0–6). */
  requestPhotos: 'photos',
  /** The one file of `PUT /me/avatar`. */
  avatar: 'avatar',
} as const;

/**
 * A picked image as the app sends it: request photos go with `POST /requests` /
 * `PATCH /requests/:id` (multipart `photos`), the avatar with `PUT /me/avatar` (`avatar`).
 */
export interface LocalImage {
  /** Local file URI (file://, content://, blob:, data:). */
  uri: string;
  mimeType: string | null;
  fileName: string | null;
  /** Size in bytes when the picker reports it (iOS/Android): a photo over the limit is refused before the transfer. */
  fileSize?: number | null;
}
