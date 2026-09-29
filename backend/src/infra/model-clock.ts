/**
 * Clock behind mongoose's automatic `createdAt`/`updatedAt`, so stored timestamps follow
 * `deps.clock` (tests drive time with `FakeClock`). `createApp` installs the deps clock.
 */
import { systemClock, type Clock } from '../lib/clock.js';

let current: Clock = systemClock;

export function setModelClock(clock: Clock): void {
  current = clock;
}

/** Current time of the model clock. */
export function modelNow(): Date {
  return current.now();
}

/** Schema `timestamps` option using the model clock. */
export function modelTimestamps(fields: { createdAt?: boolean; updatedAt?: boolean } = {}) {
  return {
    createdAt: fields.createdAt ?? true,
    updatedAt: fields.updatedAt ?? true,
    currentTime: () => current.now(),
  };
}
