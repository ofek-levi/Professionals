/** `POST /uploads/images`: checks the image, stores it (Cloudinary) and records the upload. */
import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { vm } from '../../shared/validation-messages.js';
import { UploadModel, type UploadDoc } from './upload.model.js';
import { detectImageType } from './image-signature.js';

/** Storage sub-folder (`professionals/${APP_ENV}/images`); the purpose is only known on attach. */
export const UPLOAD_FOLDER = 'images';

export async function storeImage(deps: Pick<AppDeps, 'storage' | 'logger'>, auth: AuthContext, buffer: Buffer): Promise<UploadDoc> {
  const mimeType = detectImageType(buffer);
  if (!mimeType) throw ApiError.validation({ file: [vm('upload.invalid')] }, 'Only JPEG, PNG, WebP and HEIC images are accepted');
  const stored = await deps.storage.upload({ buffer, mimeType, folder: UPLOAD_FOLDER });
  try {
    const doc = await UploadModel.create({
      owner: auth.userId,
      publicId: stored.publicId,
      url: stored.url,
      width: stored.width,
      height: stored.height,
    });
    return doc.toObject<UploadDoc>();
  } catch (error) {
    // Nothing references the stored image yet: remove it rather than leak it in storage.
    await deps.storage.destroy([stored.publicId]).catch((cleanupError: unknown) => {
      deps.logger.warn({ err: cleanupError, publicId: stored.publicId }, 'could not remove an unrecorded upload');
    });
    throw error;
  }
}
