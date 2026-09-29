import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import { getCustomerProfile, updateCustomerProfile } from './customer-profile.service.js';
import { updateCustomerProfileBody } from './customers.schemas.js';

/** `GET /v1/customer/profile` → `{ user, profile }` */
export const getProfile = () => (req: Request) => getCustomerProfile(authOf(req, 'customer'));

/** `PATCH /v1/customer/profile` → `{ user, profile }` */
export const updateProfile = (deps: AppDeps) => (req: Request) => {
  const { body } = validateRequest(req, { body: updateCustomerProfileBody });
  return updateCustomerProfile(deps, authOf(req, 'customer'), body);
};
