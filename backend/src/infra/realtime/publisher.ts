/**
 * `publish(userIds, event)` sends a `RealtimeEvent` to every open socket of those users on every
 * API instance: the event goes through Redis pub/sub (`${APP_ENV}:realtime`) and each instance
 * delivers it to its local sockets (`realtime-server.ts`). Publish after the data is committed
 * (inside a transaction: `tx.afterCommit(() => realtime.publish(...))`).
 */
import type { Logger } from '../../lib/logger.js';
import type { RealtimeEvent } from '../../shared/contract/index.js';
import type { Redis } from '../redis.js';

export interface RealtimePublisher {
  publish(userIds: Iterable<string>, event: RealtimeEvent): Promise<void>;
}

/** Wire format on the Redis channel. */
export interface RealtimeEnvelope {
  userIds: string[];
  event: RealtimeEvent;
}

export class RedisRealtimePublisher implements RealtimePublisher {
  constructor(
    private readonly redis: Redis,
    private readonly channel: string,
    private readonly logger: Logger,
  ) {}

  async publish(userIds: Iterable<string>, event: RealtimeEvent): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    const envelope: RealtimeEnvelope = { userIds: unique, event };
    try {
      await this.redis.publish(this.channel, JSON.stringify(envelope));
    } catch (error) {
      // Realtime is best effort: the app refetches on reconnect/focus.
      this.logger.warn({ err: error, type: event.type }, 'realtime publish failed');
    }
  }
}

/** Test double that records what was published. */
export class MemoryRealtimePublisher implements RealtimePublisher {
  readonly published: RealtimeEnvelope[] = [];

  publish(userIds: Iterable<string>, event: RealtimeEvent): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length > 0) this.published.push({ userIds: unique, event });
    return Promise.resolve();
  }

  /** Events delivered to `userId`, oldest first. */
  eventsFor(userId: string): RealtimeEvent[] {
    return this.published.filter((envelope) => envelope.userIds.includes(userId)).map((envelope) => envelope.event);
  }

  clear(): void {
    this.published.length = 0;
  }
}
