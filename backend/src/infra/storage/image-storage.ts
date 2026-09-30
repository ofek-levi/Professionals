/**
 * Image storage (Cloudinary in every deployed environment). Images live under
 * `professionals/${APP_ENV}/<folder>` and are resized on upload. An image is stored only on the
 * document that shows it (`requests.photos`, `users.avatar`) with its `publicId`, which deletes it
 * once that document no longer does.
 */
export interface StoredImage {
  publicId: string;
  url: string;
}

export interface ImageUpload {
  buffer: Buffer;
  mimeType: string;
  /** Sub-folder: `requests` or `avatars`. */
  folder: string;
}

export interface ImageStorage {
  /** `false` when uploads are disabled (development without credentials). */
  readonly configured: boolean;
  upload(input: ImageUpload): Promise<StoredImage>;
  destroy(publicIds: string[]): Promise<void>;
}
