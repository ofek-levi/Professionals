/** Auth payloads (`POST /auth/demo-login`, `POST /me/devices`). */
import { z } from 'zod';

import { vm } from './messages';

export const demoLoginSchema = z.object({
  userId: z.string({ error: vm('required') }).trim().min(1, vm('required')),
});

export const registerDeviceSchema = z.object({
  pushToken: z.string({ error: vm('required') }).trim().min(1, vm('required')),
  platform: z.enum(['ios', 'android', 'web'], { error: vm('invalid') }),
});
