/** Offset based cursor pagination (the cursor is opaque to clients). */
import { APP_CONFIG } from '@/constants/app-config';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import type { Paginated, PaginationParams } from '@/types/api';

export const MAX_PAGE_SIZE = 100;

const CURSOR_PREFIX = 'o';

export function encodeCursor(offset: number): string {
  return `${CURSOR_PREFIX}${offset.toString(36)}`;
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const offset = cursor.startsWith(CURSOR_PREFIX) ? parseInt(cursor.slice(1), 36) : NaN;
  if (!Number.isInteger(offset) || offset < 0) {
    throw DomainError.validation({ cursor: [vm('invalid')] }, 'Invalid pagination cursor');
  }
  return offset;
}

export function paginate<T>(items: readonly T[], params: PaginationParams = {}): Paginated<T> {
  const offset = decodeCursor(params.cursor);
  const limit = Math.min(Math.max(1, Math.floor(params.limit ?? APP_CONFIG.pageSize)), MAX_PAGE_SIZE);
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    items: page,
    nextCursor: nextOffset < items.length && page.length > 0 ? encodeCursor(nextOffset) : null,
    totalCount: items.length,
  };
}
