import type { Control } from 'react-hook-form';
import type { z } from 'zod';

import type { RequestFormValues, requestFormSchema } from '@/lib/validation';

/** Parsed (validated) wizard values. */
export type RequestFormOutput = z.output<typeof requestFormSchema>;

export type RequestFormControl = Control<RequestFormValues, unknown, RequestFormOutput>;
