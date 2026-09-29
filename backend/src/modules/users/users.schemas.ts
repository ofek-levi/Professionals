/** Payloads of `/me` and `/me/devices` (the device rules are the app's `registerDeviceSchema`). */
import { z } from 'zod';

import { DEVICE_PLATFORMS, SUPPORTED_LANGUAGES } from '../../shared/domain.js';
import { vm } from '../../shared/validation-messages.js';

export const updateMeBody = z.object({
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES, { error: vm('invalid') }),
});

export const registerDeviceBody = z.object({
  pushToken: z.string({ error: vm('required') }).trim().min(1, vm('required')).max(200, vm('invalid')),
  platform: z.enum(DEVICE_PLATFORMS, { error: vm('invalid') }),
});
export type RegisterDeviceInput = z.output<typeof registerDeviceBody>;

export const deviceParams = z.object({ token: z.string().max(200) });
