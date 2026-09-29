/**
 * Image storage (Cloudinary in every deployed environment). Images live under
 * `professionals/${APP_ENV}/<folder>` and are resized on upload; callers keep `publicId` to delete
 * them later (orphan-upload cron, replaced avatars).
 */
export interface StoredImage {
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface ImageUpload {
  buffer: Buffer;
  mimeType: string;
  /** Sub-folder, e.g. `requests` or `avatars`. */
  folder: string;
}

export interface ImageStorage {
  /** `false` when uploads are disabled (development without credentials). */
  readonly configured: boolean;
  upload(input: ImageUpload): Promise<StoredImage>;
  destroy(publicIds: string[]): Promise<void>;
}
