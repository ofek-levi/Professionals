/**
 * Id generation for client-side and mock-backend entities.
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
 * @param now optional clock value (the mock backend passes its injected clock).
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
