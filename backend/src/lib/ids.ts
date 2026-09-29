/** ObjectId helpers. Ids travel as 24-char hex strings; a malformed id is a missing resource. */
import { Types } from 'mongoose';

import { ApiError } from './errors.js';

export type ObjectId = Types.ObjectId;

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID.test(value);
}

/** Parses a path/body id; a malformed id answers 404 (it cannot exist) instead of 400. */
export function parseObjectId(value: unknown, entity: string): ObjectId {
  if (!isObjectIdString(value)) throw ApiError.notFound(entity);
  return new Types.ObjectId(value);
}

export function newObjectId(): ObjectId {
  return new Types.ObjectId();
}

/** Hex string of an ObjectId (views). */
export function idOf(value: ObjectId | { _id: ObjectId }): string {
  return (value instanceof Types.ObjectId ? value : value._id).toHexString();
}

/** De-duplicated ObjectIds (for `$in` batch loads). */
export function uniqueIds(ids: Iterable<ObjectId | null | undefined>): ObjectId[] {
  const seen = new Map<string, ObjectId>();
  for (const id of ids) if (id) seen.set(id.toHexString(), id);
  return [...seen.values()];
}
