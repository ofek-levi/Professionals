/**
 * Id generation for client-side entities (e.g. optimistic chat messages) and the test double.
 *
 * Ids look like `req_0mf3k2x1a0001q7zk`: a prefix, a base-36 timestamp (so ids created later sort
 * after earlier ones), a per-process counter (unique within the same millisecond) and random
 * characters (unique across devices / app launches).
 */

const TIME_LENGTH = 9;
const COUNTER_LENGTH = 4;
const RANDOM_LENGTH = 4;
const COUNTER_MODULO = 36 ** COUNTER_LENGTH;
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

let counter = 0;

function randomChars(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Creates a unique, roughly time-sortable id.
 * @param prefix short entity prefix, e.g. `req`, `off`, `job`.
 * @param now optional clock value (the test double passes its injected clock).
 */
export function createId(prefix: string, now: Date = new Date()): string {
  counter = (counter + 1) % COUNTER_MODULO;
  const time = Math.max(0, now.getTime()).toString(36).padStart(TIME_LENGTH, '0');
  const sequence = counter.toString(36).padStart(COUNTER_LENGTH, '0');
  return `${prefix}_${time}${sequence}${randomChars(RANDOM_LENGTH)}`;
}

/** Idempotency key for chat messages (sent with `POST /conversations/:id/messages`). */
export function createClientMessageId(): string {
  return createId('cmsg');
}

/**
 * Orders ids by their code units, for sort tie-breaks. Ids are ASCII, so this needs no locale:
 * `localeCompare` depends on the device locale and, on Hermes, creates a platform collator (a JNI
 * round-trip on Android) on every call.
 */
export function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
