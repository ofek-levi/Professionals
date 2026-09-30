import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import type { CloudinaryConfig } from '../../config/env.js';
import type { ImageStorage, ImageUpload, StoredImage } from './image-storage.js';

/** Longest edge kept after upload; larger photos are scaled down (never up). */
const MAX_EDGE_PX = 2048;
/** Cloudinary's Admin API deletes at most 100 resources per call. */
const DELETE_BATCH = 100;

export class CloudinaryStorage implements ImageStorage {
  readonly configured = true;

  constructor(
    config: CloudinaryConfig,
    private readonly rootFolder: string,
  ) {
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
  }

  upload(input: ImageUpload): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${this.rootFolder}/${input.folder}`,
          resource_type: 'image',
          // Incoming transformation: the stored original is bounded and recompressed. HEIC/WebP are
          // converted by `format` (PNG keeps transparency). No `fetch_format: 'auto'` here: automatic
          // format depends on the requesting browser, so it belongs to delivery URLs, not to upload.
          transformation: [{ width: MAX_EDGE_PX, height: MAX_EDGE_PX, crop: 'limit' }, { quality: 'auto' }],
          format: input.mimeType === 'image/png' ? 'png' : 'jpg',
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            reject(new Error(`Cloudinary upload failed: ${error?.message ?? 'no result'}`));
            return;
          }
          resolve({ publicId: result.public_id, url: result.secure_url, width: result.width, height: result.height });
        },
      );
      stream.end(input.buffer);
    });
  }

  async destroy(publicIds: string[]): Promise<void> {
    for (let i = 0; i < publicIds.length; i += DELETE_BATCH) {
      await cloudinary.api.delete_resources(publicIds.slice(i, i + DELETE_BATCH), { resource_type: 'image' });
    }
  }
}
