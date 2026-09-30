import { z } from 'zod';

import { phoneSchema, serviceLocationInputSchema } from '../auth/auth-fields.schemas.js';
import { notificationPreferencesSchema, personNameSchema } from '../professionals/profile-fields.schemas.js';

/** `PATCH /customer/profile` (every field optional; `null` clears the default location). The avatar is `PUT /me/avatar`. */
export const updateCustomerProfileBody = z
  .object({
    firstName: personNameSchema('profile.firstNameRequired'),
    lastName: personNameSchema('profile.lastNameRequired'),
    phone: phoneSchema,
    defaultLocation: serviceLocationInputSchema.nullable(),
    notificationPreferences: notificationPreferencesSchema,
  })
  .partial();

export type UpdateCustomerProfileInput = z.output<typeof updateCustomerProfileBody>;
