/**
 * Cursor pagination (cursors are opaque to clients).
 * - `paginate`: offset cursors, for lists whose order does not grow at the front.
 * - `paginateNewestFirst`: keyset cursors for newest-first feeds (messages, notifications). New
 *   items are added at the front while a client holds a cursor, so an offset would shift and
 *   repeat items; a keyset cursor resumes strictly after the last item the client received.
 */
import { APP_CONFIG } from '@/constants/app-config';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import type { Paginated, PaginationParams } from '@/types/api';

/** Contract limit shared with the client (`APP_CONFIG.maxPageSize`). */
export const MAX_PAGE_SIZE = APP_CONFIG.maxPageSize;

const OFFSET_PREFIX = 'o';
const KEYSET_PREFIX = 'k';
const KEYSET_SEPARATOR = '.';

const invalidCursor = () => DomainError.validation({ cursor: [vm('invalid')] }, 'Invalid pagination cursor');

function pageLimit(limit: number | undefined): number {
  return Math.min(Math.max(1, Math.floor(limit ?? APP_CONFIG.pageSize)), MAX_PAGE_SIZE);
}

function encodeCursor(offset: number): string {
  return `${OFFSET_PREFIX}${offset.toString(36)}`;
}

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const offset = cursor.startsWith(OFFSET_PREFIX) ? parseInt(cursor.slice(1), 36) : NaN;
  if (!Number.isInteger(offset) || offset < 0) throw invalidCursor();
  return offset;
}

export function paginate<T>(items: readonly T[], params: PaginationParams = {}): Paginated<T> {
  const offset = decodeCursor(params.cursor);
  const limit = pageLimit(params.limit);
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    items: page,
    nextCursor: nextOffset < items.length && page.length > 0 ? encodeCursor(nextOffset) : null,
    totalCount: items.length,
  };
}

// ────────────────────────────── Keyset (newest first) ──────────────────────────────

interface FeedKey {
  createdAt: string;
  id: string;
}

/** Newest-first order: `createdAt` descending, ties by id descending. */
export function compareNewestFirst(a: FeedKey, b: FeedKey): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);
}

function encodeKeysetCursor(item: FeedKey): string {
  return `${KEYSET_PREFIX}${Date.parse(item.createdAt).toString(36)}${KEYSET_SEPARATOR}${item.id}`;
}

function decodeKeysetCursor(cursor: string | null | undefined): FeedKey | null {
  if (!cursor) return null;
  const separator = cursor.indexOf(KEYSET_SEPARATOR);
  if (!cursor.startsWith(KEYSET_PREFIX) || separator === -1) throw invalidCursor();
  const time = parseInt(cursor.slice(KEYSET_PREFIX.length, separator), 36);
  const id = cursor.slice(separator + 1);
  if (!Number.isFinite(time) || !id) throw invalidCursor();
  return { createdAt: new Date(time).toISOString(), id };
}

/** Pages a feed newest first; the cursor points at the last item returned. */
export function paginateNewestFirst<T extends FeedKey>(items: readonly T[], params: PaginationParams = {}): Paginated<T> {
  const sorted = [...items].sort(compareNewestFirst);
  const after = decodeKeysetCursor(params.cursor);
  const remaining = after ? sorted.filter((item) => compareNewestFirst(after, item) < 0) : sorted;
  const page = remaining.slice(0, pageLimit(params.limit));
  const last = page[page.length - 1];
  return {
    items: page,
    nextCursor: last && remaining.length > page.length ? encodeKeysetCursor(last) : null,
    totalCount: sorted.length,
  };
}
