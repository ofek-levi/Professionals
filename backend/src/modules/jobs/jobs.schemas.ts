/** Job route params and the `GET /jobs` query. */
import { z } from 'zod';

import { paginationQueryShape } from '../../lib/pagination.js';
import { queryEnum } from '../../lib/query-schemas.js';
import { JOB_SCOPES } from '../../shared/domain.js';

export const jobParams = z.object({ jobId: z.string() });

export const listJobsQuery = z.object({ ...paginationQueryShape, scope: queryEnum(JOB_SCOPES).transform((scope) => scope ?? 'all') });
export type ListJobsQuery = z.output<typeof listJobsQuery>;
