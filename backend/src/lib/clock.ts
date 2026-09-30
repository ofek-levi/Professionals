/** Injectable time source: services call `deps.clock.now()` so tests and cron jobs control time. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** API form of an optional instant (`null` stays `null`). */
export function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

/** Manually driven clock for tests. */
export class FakeClock implements Clock {
  private current: number;

  constructor(start: Date | string = '2026-10-01T09:00:00.000Z') {
    this.current = new Date(start).getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  set(value: Date | string): void {
    this.current = new Date(value).getTime();
  }

  advance(ms: number): void {
    this.current += ms;
  }

  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60_000);
  }
}
