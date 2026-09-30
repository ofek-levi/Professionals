/**
 * Image storage of the double: an image is "stored" with the thing that shows it (a request's
 * photos, a user's avatar) under a public id, like the backend's Cloudinary folders.
 */
import type { ServerContext } from './context';
import type { ImageFile } from './multipart';

export interface StoredImage {
  publicId: string;
  url: string;
}

export function storeImage(ctx: ServerContext, folder: 'requests' | 'avatars', file: ImageFile): StoredImage {
  const publicId = `test/${folder}/${ctx.newId('img')}`;
  return { publicId, url: `https://images.test/${publicId}.${file.extension}` };
}
