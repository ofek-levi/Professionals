/**
 * Every Redis key and pub/sub channel is namespaced by `APP_ENV` (`development:`, `staging:`,
 * `production:`) so environments can share a Redis without seeing each other's data. Build keys
 * only through this helper.
 */
export interface RedisKeys {
  readonly prefix: string;
  /** `${prefix}:${parts.join(':')}` */
  key(...parts: (string | number)[]): string;
}

export function createRedisKeys(prefix: string): RedisKeys {
  return {
    prefix,
    key: (...parts) => [prefix, ...parts].join(':'),
  };
}

/** Well-known key namespaces (the second segment of every key). */
export const KEY_SPACES = {
  cache: 'cache',
  rateLimit: 'rl',
  cronLock: 'lock',
  pushTickets: 'push-tickets',
  geocoderGate: 'geo-gate',
  realtimeChannel: 'realtime',
  revokedSession: 'revoked-sid',
  /** Pub/sub: session ids just revoked (realtime servers close their sockets). */
  sessionRevokedChannel: 'session-revoked',
} as const;
