/** Helpers shared by route handlers. */
import type { PaginationParams, SuccessResponse } from '@/types/api';

import type { QueryReader } from '../router';
import { MAX_PAGE_SIZE } from '../pagination';

export const SUCCESS: SuccessResponse = { success: true };

export function paginationFrom(query: QueryReader): PaginationParams {
  return { cursor: query.string('cursor') ?? null, limit: query.integer('limit', { min: 1, max: MAX_PAGE_SIZE }) };
}
