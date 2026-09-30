/**
 * Field names of the multipart routes (`middleware/multipart.ts`). The app has the same constant
 * (`frontend/src/types/api/images.ts`); the contract check fails when they differ.
 */
export const MULTIPART_FIELDS = {
  /** Text field with the JSON payload of `POST /requests` and `PATCH /requests/:id`. */
  payload: 'data',
  /** Files of a request (0–6). */
  requestPhotos: 'photos',
  /** The one file of `PUT /me/avatar`. */
  avatar: 'avatar',
} as const;
