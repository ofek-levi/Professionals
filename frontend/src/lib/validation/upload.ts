/** Image upload (`POST /uploads/images`). */
import { z } from 'zod';

import { vm } from './messages';

const dimension = z.number().positive(vm('upload.invalid')).nullable().default(null);

export const uploadImageSchema = z.object({
  uri: z.string({ error: vm('upload.invalid') }).trim().min(1, vm('upload.invalid')),
  mimeType: z
    .string()
    .regex(/^image\//, vm('upload.invalid'))
    .nullable()
    .default(null),
  width: dimension,
  height: dimension,
  fileName: z.string().nullable().default(null),
});
