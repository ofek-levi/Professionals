import type { Env } from '../../config/env.js';
import { CloudinaryStorage } from './cloudinary-storage.js';
import type { ImageStorage } from './image-storage.js';
import { UnconfiguredStorage } from './unconfigured-storage.js';

export type { ImageStorage, ImageUpload, StoredImage } from './image-storage.js';
export { MemoryImageStorage } from './memory-storage.js';

export function createImageStorage(env: Env): ImageStorage {
  return env.cloudinary ? new CloudinaryStorage(env.cloudinary, `professionals/${env.appEnv}`) : new UnconfiguredStorage();
}
