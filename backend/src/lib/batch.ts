/**
 * Batch loading for views: collect the ids a page of results references, load each collection
 * once with `$in` + projection, then map in memory. Never query inside a `map` (no N+1).
 */
import type { Model, QueryFilter, Types } from 'mongoose';

import { uniqueIds } from './ids.js';

/** Loads documents by id into a Map keyed by the hex id. */
export async function loadByIds<TDoc, TLean extends { _id: Types.ObjectId } = TDoc & { _id: Types.ObjectId }>(
  model: Model<TDoc>,
  ids: Iterable<Types.ObjectId | null | undefined>,
  projection?: Record<string, 0 | 1>,
): Promise<Map<string, TLean>> {
  const unique = uniqueIds(ids);
  if (unique.length === 0) return new Map();
  const docs = await model.find({ _id: { $in: unique } } as QueryFilter<TDoc>, projection).lean<TLean[]>();
  return new Map(docs.map((doc) => [doc._id.toHexString(), doc]));
}

/** Map lookup that fails loudly: a dangling reference is a data bug, not a 404. */
export function required<T>(map: ReadonlyMap<string, T>, id: Types.ObjectId, entity: string): T {
  const value = map.get(id.toHexString());
  if (value === undefined) throw new Error(`${entity} ${id.toHexString()} is missing`);
  return value;
}
