import { z } from 'zod';

import { phoneSchema, serviceLocationInputSchema } from '../auth/auth-fields.schemas.js';
import { avatarUrlSchema, notificationPreferencesSchema, personNameSchema } from '../professionals/profile-fields.schemas.js';

/** `PATCH /customer/profile` (every field optional; `null` clears avatar / default location). */
export const updateCustomerProfileBody = z
  .object({
    firstName: personNameSchema('profile.firstNameRequired'),
    lastName: personNameSchema('profile.lastNameRequired'),
    phone: phoneSchema,
    avatarUrl: avatarUrlSchema,
    defaultLocation: serviceLocationInputSchema.nullable(),
    notificationPreferences: notificationPreferencesSchema,
  })
  .partial();

export type UpdateCustomerProfileInput = z.output<typeof updateCustomerProfileBody>;
