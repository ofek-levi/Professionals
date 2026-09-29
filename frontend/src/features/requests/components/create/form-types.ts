import type { z } from 'zod';

import type { requestFormSchema } from '@/lib/validation';

/** Parsed (validated) request form values. */
export type RequestFormOutput = z.output<typeof requestFormSchema>;
