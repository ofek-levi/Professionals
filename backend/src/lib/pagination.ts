/**
 * Keyset (cursor) pagination: `?cursor=&limit=` → `{items, nextCursor, totalCount}`.
 *
 * A cursor is the base64url JSON of the sort-key values of the last item returned (sort fields +
 * `_id` as the tie breaker) plus the first page's `totalCount`, so the next page resumes strictly
 * after that item: stable under inserts, and served by an index on exactly the sort fields (the
 * leading key also becomes an index bound, see `afterCursorFilter`). Sort fields must never be null.
 *
 * `totalCount` is counted on the first page only and echoed from the cursor on later ones (the app
 * reads it from the first page; recounting on every "load more" would scan the whole list again).
 */
import { Types, type Model, type PipelineStage, type QueryFilter } from 'mongoose';
import { z } from 'zod';

import type { Paginated } from '../shared/contract/index.js';
import { APP_CONFIG } from '../shared/limits.js';
import { vm } from '../shared/validation-messages.js';
import { ApiError } from './errors.js';
import { queryNumber, queryString } from './query-schemas.js';

export const DEFAULT_PAGE_SIZE = APP_CONFIG.pageSize;
export const MAX_PAGE_SIZE = APP_CONFIG.maxPageSize;

export type CursorValue = string | number | boolean | Date | Types.ObjectId;
export interface SortKey {
  /** Dotted document path, e.g. `updatedAt` or `lastMessage.createdAt`. */
  path: string;
  direction: 1 | -1;
}
/** Sort keys; must end with `_id` so every position is unique. */
export type SortSpec = readonly [...SortKey[], { path: '_id'; direction: 1 | -1 }];

/** `path` descending, newest `_id` first among equals (the most common list order). */
export function descendingBy(path: string): SortSpec {
  return [
    { path, direction: -1 },
    { path: '_id', direction: -1 },
  ];
}
export const NEWEST_FIRST = descendingBy('createdAt');
export const RECENTLY_UPDATED = descendingBy('updatedAt');

export interface PageParams {
  cursor: string | undefined;
  limit: number;
}

/** `cursor` + `limit` query fields; merge into a module's query schema with `.extend(...)`. */
export const paginationQueryShape = {
  cursor: queryString(1024),
  limit: queryNumber({ min: 1, max: MAX_PAGE_SIZE })
    .refine((value) => value === undefined || Number.isInteger(value), vm('invalid'))
    .transform((value) => value ?? DEFAULT_PAGE_SIZE),
};
export const paginationQuerySchema = z.object(paginationQueryShape);

const invalidCursor = () => ApiError.validation({ cursor: [vm('invalid')] }, 'Invalid pagination cursor');

type EncodedValue = string | number | boolean | { d: number } | { o: string };

function encodeValue(value: CursorValue): EncodedValue {
  if (value instanceof Date) return { d: value.getTime() };
  if (value instanceof Types.ObjectId) return { o: value.toHexString() };
  return value;
}

function decodeValue(value: unknown): CursorValue {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value && typeof value === 'object') {
    if ('d' in value && typeof value.d === 'number' && Number.isFinite(value.d)) return new Date(value.d);
    if ('o' in value && typeof value.o === 'string' && Types.ObjectId.isValid(value.o)) return new Types.ObjectId(value.o);
  }
  throw invalidCursor();
}

/** Position after `values` (sort keys of the last item) in a list of `totalCount` items. */
export interface PageCursor {
  values: CursorValue[];
  totalCount: number;
}

export function encodeCursor({ values, totalCount }: PageCursor): string {
  return Buffer.from(JSON.stringify({ k: values.map(encodeValue), n: totalCount })).toString('base64url');
}

/** Decodes a cursor made for `spec` (wrong shape → 400 `fieldErrors.cursor`). */
export function decodeCursor(cursor: string, spec: SortSpec): PageCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }
  if (!parsed || typeof parsed !== 'object' || !('k' in parsed) || !('n' in parsed)) throw invalidCursor();
  const { k, n } = parsed;
  if (!Array.isArray(k) || k.length !== spec.length || typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw invalidCursor();
  return { values: k.map(decodeValue), totalCount: n };
}

/** The cursor of `page` (`null` on the first page). */
export function readCursor(page: PageParams, spec: SortSpec): PageCursor | null {
  return page.cursor ? decodeCursor(page.cursor, spec) : null;
}

function readPath(doc: unknown, path: string): unknown {
  let current: unknown = doc;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Sort-key values of `doc` (reads the sort paths from the document). */
function sortValuesOf(doc: unknown, spec: SortSpec): CursorValue[] {
  return spec.map(({ path }) => {
    const value = readPath(doc, path);
    if (value === null || value === undefined) throw new Error(`Sort field "${path}" is empty; it cannot be paginated`);
    return value as CursorValue;
  });
}

/** `$sort` document for `spec`. */
export function sortOf(spec: SortSpec): Record<string, 1 | -1> {
  return Object.fromEntries(spec.map(({ path, direction }) => [path, direction]));
}

/**
 * Filter selecting the items strictly after `values` in `spec` order (works in find and `$match`).
 * The `$or` alone is exact but the planner cannot turn it into index bounds, so every page would
 * rescan the list from its start; the redundant range on the leading key bounds the index scan.
 */
export function afterCursorFilter(spec: SortSpec, values: readonly CursorValue[]): Record<string, unknown> {
  const branches = spec.map((key, index) => {
    const branch: Record<string, unknown> = {};
    for (let i = 0; i < index; i += 1) branch[spec[i]?.path ?? ''] = values[i];
    branch[key.path] = { [key.direction === 1 ? '$gt' : '$lt']: values[index] };
    return branch;
  });
  const [lead] = spec;
  if (branches.length === 1 || !lead) return branches[0] ?? {};
  return { [lead.path]: { [lead.direction === 1 ? '$gte' : '$lte']: values[0] }, $or: branches };
}

/** Builds the page from `limit + 1` fetched docs (the extra one only proves there is a next page). */
export function toPage<T>(docs: T[], params: PageParams, spec: SortSpec, totalCount: number): Paginated<T> {
  const items = docs.slice(0, params.limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: docs.length > params.limit && last !== undefined ? encodeCursor({ values: sortValuesOf(last, spec), totalCount }) : null,
    totalCount,
  };
}

interface FindPageOptions<TDoc> {
  filter: QueryFilter<TDoc>;
  sort: SortSpec;
  page: PageParams;
  projection?: Record<string, 0 | 1>;
  /** First-page total when the caller already knows it (default: `countDocuments(filter)`). */
  totalCount?: Promise<number>;
}

/**
 * One page of `model.find(filter)` in `sort` order (lean docs) plus the total count (first page
 * only), queried in parallel. Needs an index whose keys are the equality fields of `filter`
 * followed by `sort`.
 */
export async function findPage<TDoc, TLean = TDoc & { _id: Types.ObjectId }>(
  model: Model<TDoc>,
  { filter, sort, page, projection, totalCount }: FindPageOptions<TDoc>,
): Promise<Paginated<TLean>> {
  const cursor = readCursor(page, sort);
  const pageFilter = (cursor ? { $and: [filter, afterCursorFilter(sort, cursor.values)] } : filter) as QueryFilter<TDoc>;
  const [docs, total] = await Promise.all([
    model
      .find(pageFilter, projection)
      .sort(sortOf(sort))
      .limit(page.limit + 1)
      .lean<TLean[]>(),
    cursor ? cursor.totalCount : (totalCount ?? model.countDocuments(filter).exec()),
  ]);
  return toPage(docs, page, sort, total);
}

/** Pipeline stages for keyset paging inside an aggregation (after the stage computing the keys). */
export function pageStages(sort: SortSpec, cursor: PageCursor | null, limit: number): PipelineStage[] {
  const stages: PipelineStage[] = [];
  if (cursor) stages.push({ $match: afterCursorFilter(sort, cursor.values) });
  stages.push({ $sort: sortOf(sort) }, { $limit: limit + 1 });
  return stages;
}
