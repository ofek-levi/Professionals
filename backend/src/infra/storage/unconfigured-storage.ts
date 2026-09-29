import { ApiError } from '../../lib/errors.js';
import type { ImageStorage, StoredImage } from './image-storage.js';

/** Development without Cloudinary credentials: uploads answer 503, deletes are no-ops. */
export class UnconfiguredStorage implements ImageStorage {
  readonly configured = false;

  upload(): Promise<StoredImage> {
    return Promise.reject(ApiError.unavailable('Image uploads are not configured on this server'));
  }

  destroy(): Promise<void> {
    return Promise.resolve();
  }
}
