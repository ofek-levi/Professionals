import http from 'node:http';

import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import type { CloudinaryConfig } from '../../config/env.js';
import type { ImageStorage, ImageUpload, StoredImage } from './image-storage.js';

/** Longest edge kept after upload; larger photos are scaled down (never up). */
const MAX_EDGE_PX = 2048;
/** What `destroy` answers for a deleted image, or one that was already gone. */
const DELETED = new Set(['ok', 'not found']);

/**
 * Per-call options that send the API calls to `uploadPrefix` (a local stub standing in for
 * Cloudinary in development, `CLOUDINARY_UPLOAD_PREFIX`). The SDK picks `https` when it is loaded,
 * so a plain-HTTP stub also needs an HTTP agent.
 */
function endpointOptions(uploadPrefix: string | null): { upload_prefix?: string; agent?: http.Agent } {
  if (!uploadPrefix) return {};
  return uploadPrefix.startsWith('http:') ? { upload_prefix: uploadPrefix, agent: new http.Agent({ keepAlive: true }) } : { upload_prefix: uploadPrefix };
}

export class CloudinaryStorage implements ImageStorage {
  readonly configured = true;
  private readonly endpoint: ReturnType<typeof endpointOptions>;

  constructor(
    config: CloudinaryConfig,
    private readonly rootFolder: string,
  ) {
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
    this.endpoint = endpointOptions(config.uploadPrefix);
  }

  upload(input: ImageUpload): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          ...this.endpoint,
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
          resolve({ publicId: result.public_id, url: result.secure_url });
        },
      );
      stream.end(input.buffer);
    });
  }

  /**
   * One Upload API call per image (a post has at most 6): unlike the Admin API's bulk delete it is
   * not limited per hour, and `invalidate` also removes the cached copies from the CDN, so a removed
   * photo stops being served. Rejects with the ids that could not be deleted.
   */
  async destroy(publicIds: string[]): Promise<void> {
    const results = await Promise.allSettled(
      publicIds.map((publicId) => cloudinary.uploader.destroy(publicId, { ...this.endpoint, resource_type: 'image', invalidate: true })),
    );
    const failed = publicIds.filter((_, i) => {
      const result = results[i];
      return result?.status !== 'fulfilled' || !DELETED.has(String((result.value as { result?: unknown } | undefined)?.result));
    });
    if (failed.length > 0) throw new Error(`Cloudinary could not delete ${failed.join(', ')}`);
  }
}
