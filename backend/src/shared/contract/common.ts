/**
 * Response DTO types of the REST contract, ported from the app (`frontend/src/types/*`). Views
 * (`modules/<x>/<x>.views.ts`) return these shapes; request payloads are typed by the zod schemas.
 */
import type { ApiErrorCode } from '../error-codes.js';

/** Opaque stable identifier (a MongoDB ObjectId as a hex string). */
export type EntityId = string;
/** ISO-8601 timestamp in UTC. */
export type ISODateTimeString = string;
/** Calendar date `YYYY-MM-DD`. */
export type ISODateString = string;
/** Wall-clock time `HH:mm`. */
export type TimeOfDayString = string;

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface SuccessResponse {
  success: true;
}
