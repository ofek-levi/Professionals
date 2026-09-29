import type { ImageStorage, ImageUpload, StoredImage } from './image-storage.js';

/** In-memory storage for tests: `images` holds what is currently stored. */
export class MemoryImageStorage implements ImageStorage {
  readonly configured = true;
  readonly images = new Map<string, StoredImage & { folder: string; bytes: number }>();
  private next = 1;

  upload(input: ImageUpload): Promise<StoredImage> {
    const publicId = `test/${input.folder}/img-${this.next++}`;
    const image = { publicId, url: `https://images.test/${publicId}.jpg`, width: 800, height: 600 };
    this.images.set(publicId, { ...image, folder: input.folder, bytes: input.buffer.length });
    return Promise.resolve(image);
  }

  destroy(publicIds: string[]): Promise<void> {
    publicIds.forEach((id) => this.images.delete(id));
    return Promise.resolve();
  }
}
