/**
 * The idempotency key (`clientRequestId`) of posting the request form: the same key while the
 * payload is unchanged, so a retry after a timeout or a lost response gets the request the first
 * attempt created (with its photos) instead of a second one; a changed payload gets a new key.
 */
import { createId } from '@/utils/id';

export interface SubmissionKeys {
  keyFor(payload: unknown): string;
}

export function createSubmissionKeys(makeKey: () => string = () => createId('creq')): SubmissionKeys {
  let current: { payload: string; key: string } | null = null;
  return {
    keyFor(payload) {
      const serialized = JSON.stringify(payload);
      if (current?.payload !== serialized) current = { payload: serialized, key: makeKey() };
      return current.key;
    },
  };
}
