/**
 * Shared plumbing for query hooks: user scoping and cursor pagination.
 */
import type { InfiniteData } from '@tanstack/react-query';

import { APP_CONFIG } from '@/constants/app-config';
import { useSession } from '@/features/auth/session-provider';
import type { Paginated } from '@/types/api';
import type { UserRole } from '@/types/domain';

export interface QueryScope {
  /** Signed-in user id (first element of every user-scoped query key). */
  userId: string | null;
  role: UserRole | null;
  /** `true` only when signed in (and, when `requiredRole` is given, with that role). */
  enabled: boolean;
}

/** Scopes a query to the signed-in user; disabled when signed out or for another role. */
export function useQueryScope(requiredRole?: UserRole): QueryScope {
  const { status, userId, role } = useSession();
  const enabled = status === 'signedIn' && Boolean(userId) && (!requiredRole || role === requiredRole);
  return { userId, role, enabled };
}

// ─────────────────────────────── Pagination ───────────────────────────────

export const DEFAULT_PAGE_SIZE = APP_CONFIG.pageSize;

/** Cursor of a page (`null` = first page). */
export type PageParam = string | null;

export type PaginatedInfiniteData<T> = InfiniteData<Paginated<T>, PageParam>;

/** Infinite query data plus the flattened `items` and the server's `totalCount`. */
export interface PaginatedList<T> extends PaginatedInfiniteData<T> {
  items: T[];
  totalCount: number;
}

/**
 * `select` for cursor-paginated infinite queries (stable reference → memoized by React Query).
 * Items are de-duplicated by id: when a list reorders between two page loads (or the cache got an
 * item prepended) the same row must not render twice (duplicate list keys).
 */
export function selectPaginatedList<T extends { id: string }>(data: PaginatedInfiniteData<T>): PaginatedList<T> {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return { ...data, items, totalCount: data.pages[0]?.totalCount ?? 0 };
}

export function getNextPageParam<T>(lastPage: Paginated<T>): PageParam {
  return lastPage.nextCursor;
}

export const INITIAL_PAGE_PARAM: PageParam = null;
