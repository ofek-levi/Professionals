/** `/me` endpoints (thin: validate → service). */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import { uploadedImages } from '../../middleware/multipart.js';
import { clientIpKey } from '../../middleware/rate-limit.js';
import type { SuccessResponse } from '../../shared/contract/index.js';
import { vm } from '../../shared/validation-messages.js';
import { registerPushToken, removePushToken } from '../auth/push-token.service.js';
import { deleteAccount, getDeletionImpact } from './account-deletion.service.js';
import { AVATAR_IMAGE, removeAvatar, setAvatar } from './avatar.service.js';
import { getCurrentUser, updateLanguage } from './me.service.js';
import { deleteAccountBody, deviceParams, registerDeviceBody, updateMeBody } from './users.schemas.js';

const SUCCESS: SuccessResponse = { success: true };

export const getMe = () => (req: Request) => getCurrentUser(authOf(req));

export const updateMe = () => async (req: Request) => {
  const { body } = validateRequest(req, { body: updateMeBody });
  const auth = authOf(req);
  await updateLanguage(auth, body.preferredLanguage);
  return getCurrentUser(auth);
};

export const addDevice = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: registerDeviceBody });
  await registerPushToken(deps, authOf(req), body.pushToken);
  return SUCCESS;
};

export const deleteDevice = () => async (req: Request) => {
  const { params } = validateRequest(req, { params: deviceParams });
  await removePushToken(authOf(req), params.token);
  return SUCCESS;
};

/** `PUT /v1/me/avatar` (multipart, one image in `avatar`) → `CurrentUserResponse` */
export const putAvatar = (deps: AppDeps) => async (req: Request) => {
  const [file] = uploadedImages(req);
  if (!file) throw ApiError.validation({ [AVATAR_IMAGE.field]: [vm('upload.invalid')] }, `Attach the image as the multipart field "${AVATAR_IMAGE.field}"`);
  const auth = authOf(req);
  await setAvatar(deps, auth, file);
  return getCurrentUser(auth);
};

/** `DELETE /v1/me/avatar` → `CurrentUserResponse` (idempotent) */
export const deleteAvatar = (deps: AppDeps) => async (req: Request) => {
  const auth = authOf(req);
  await removeAvatar(deps, auth);
  return getCurrentUser(auth);
};

/** `GET /v1/me/deletion-impact` → `AccountDeletionImpact` */
export const deletionImpact = () => (req: Request) => getDeletionImpact(authOf(req));

/** `POST /v1/me/deletion` → `SuccessResponse` (the account is gone: the app signs out locally) */
export const deleteMe = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: deleteAccountBody });
  await deleteAccount(deps, authOf(req), body, clientIpKey(req));
  return SUCCESS;
};
