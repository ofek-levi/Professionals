import type { NextFunction, Request, Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { authOf } from '../../middleware/auth.js';
import { vm } from '../../shared/validation-messages.js';
import { chargeUploadBytes } from './upload-quota.js';
import { storeImage } from './uploads.service.js';
import { toUploadedImage } from './uploads.views.js';

/** Fails fast (503) before the file is read when image storage is not configured (development). */
export const requireStorage = (deps: Pick<AppDeps, 'storage'>) => (_req: Request, _res: Response, next: NextFunction) => {
  next(deps.storage.configured ? undefined : ApiError.unavailable('Image uploads are not configured on this server'));
};

/** `POST /v1/uploads/images` (multipart, field `file`) → 201 `UploadedImage`. */
export const uploadImage = (deps: AppDeps) => async (req: Request) => {
  if (!req.file) throw ApiError.validation({ file: [vm('upload.invalid')] }, 'Attach the image as the multipart field "file"');
  const auth = authOf(req);
  await chargeUploadBytes(deps, auth.userId.toHexString(), req.file.size);
  return toUploadedImage(await storeImage(deps, auth, req.file.buffer));
};
