/**
 * Payloads of `/me`, `/me/devices` (the device rules are the app's `registerDeviceSchema`) and
 * `/me/deletion`.
 */
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

export const deviceParams = z.object({ token: z.string().max(200) });

/** `POST /me/deletion`: the proof of who is deleting the account (`account-deletion.reauth.ts`). */
export const deleteAccountBody = z.object({
  password: z.string({ error: vm('auth.passwordRequired') }).min(1, vm('auth.passwordRequired')).max(1024, vm('invalid')).optional(),
  googleIdToken: z.string({ error: vm('invalid') }).trim().min(1, vm('required')).max(4096, vm('invalid')).optional(),
});
export type DeleteAccountInput = z.output<typeof deleteAccountBody>;
