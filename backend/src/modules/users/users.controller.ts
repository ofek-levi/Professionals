/** `/me` endpoints (thin: validate → service). */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import type { SuccessResponse } from '../../shared/contract/index.js';
import { registerDevice, removeDevice } from './devices.service.js';
import { getCurrentUser, updateLanguage } from './me.service.js';
import { deviceParams, registerDeviceBody, updateMeBody } from './users.schemas.js';

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
  await registerDevice(deps, authOf(req), body);
  return SUCCESS;
};

export const deleteDevice = () => async (req: Request) => {
  const { params } = validateRequest(req, { params: deviceParams });
  await removeDevice(authOf(req), params.token);
  return SUCCESS;
};
