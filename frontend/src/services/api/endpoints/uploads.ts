import type { UploadedImage, UploadImagePayload } from '@/types/api';
import type { ApiClient } from '../client';
import { buildImageFormData } from '../upload-form';

/** An image of up to 8 MB on a slow mobile connection. */
const UPLOAD_TIMEOUT_MS = 90_000;

export function createUploadsApi(client: ApiClient) {
  return {
    /**
     * `POST /uploads/images` (multipart, field `file`) → 201 `{ id, url, width, height }`.
     * 400 `fieldErrors.file` for anything but a JPEG/PNG/WebP/HEIC image of at most 8 MB,
     * 429 over the upload limits.
     */
    uploadImage: async (payload: UploadImagePayload) =>
      client.post<UploadedImage>('/uploads/images', await buildImageFormData(payload), { timeoutMs: UPLOAD_TIMEOUT_MS }),
  };
}
