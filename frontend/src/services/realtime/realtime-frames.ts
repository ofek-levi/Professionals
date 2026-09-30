/** Parsing of server frames and the reconnect delay of the realtime connection. Pure. */
import { REALTIME_EVENT_TYPES, type RealtimeEvent } from './types';

const EVENT_TYPES: ReadonlySet<string> = new Set(REALTIME_EVENT_TYPES);

/** A `RealtimeEvent` from a text frame, or `null` for anything else (ignored). */
export function parseRealtimeFrame(data: unknown): RealtimeEvent | null {
  if (typeof data !== 'string') return null;
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return null;
    const { type } = value as { type?: unknown };
    return typeof type === 'string' && EVENT_TYPES.has(type) ? (value as RealtimeEvent) : null;
  } catch {
    return null;
  }
}

export interface BackoffOptions {
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = { baseDelayMs: 1_000, maxDelayMs: 30_000 };

/**
 * Delay before reconnect attempt `attempt` (0-based): exponential, capped, with "equal jitter"
 * (half fixed, half random) so clients dropped together (a deploy) do not come back together.
 */
export function reconnectDelayMs(attempt: number, random: () => number, { baseDelayMs, maxDelayMs }: BackoffOptions = DEFAULT_BACKOFF): number {
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  return Math.round(cap / 2 + random() * (cap / 2));
}
