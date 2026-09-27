/**
 * Per-operation server context ("unit of work"). Every request, scheduled task and simulator action
 * runs through `createUnitOfWorkRunner`, which:
 * - wraps mutations in a database transaction (all-or-nothing),
 * - buffers realtime events in an outbox and delivers them only after a successful commit,
 * - runs `afterCommit` callbacks (e.g. simulator timers) only when the work succeeded.
 */
import type { RealtimeEvent } from '@/services/realtime/types';
import type { Message } from '@/types/domain';
import { createId } from '@/utils/id';

import type { MockDatabase } from './db';
import type { MockEventBus } from './types';

/** Extension points used by the demo simulator. */
export interface ServerHooks {
  onRequestPublished(ctx: ServerContext, requestId: string): void;
  onMessageSent(ctx: ServerContext, message: Message): void;
}

export const NO_HOOKS: ServerHooks = {
  onRequestPublished: () => undefined,
  onMessageSent: () => undefined,
};

export interface ServerContext {
  readonly db: MockDatabase;
  /** Injected clock. */
  now(): Date;
  nowIso(): string;
  newId(prefix: string): string;
  /** Queues a realtime event for `userId` (delivered after commit, de-duplicated). */
  emit(userId: string, event: RealtimeEvent): void;
  afterCommit(callback: () => void): void;
  readonly hooks: ServerHooks;
}

export interface UnitOfWorkDeps {
  db: MockDatabase;
  clock: () => Date;
  bus: MockEventBus;
  hooks: ServerHooks;
}

export type UnitOfWorkRunner = <T>(work: (ctx: ServerContext) => T, options?: { transactional?: boolean }) => T;

export function createUnitOfWorkRunner({ db, clock, bus, hooks }: UnitOfWorkDeps): UnitOfWorkRunner {
  return (work, { transactional = true } = {}) => {
    const outbox: [string, RealtimeEvent][] = [];
    const seen = new Set<string>();
    const afterCommit: (() => void)[] = [];
    const ctx: ServerContext = {
      db,
      now: () => clock(),
      nowIso: () => clock().toISOString(),
      newId: (prefix) => createId(prefix, clock()),
      emit(userId, event) {
        const key = `${userId}|${JSON.stringify(event)}`;
        if (seen.has(key)) return;
        seen.add(key);
        outbox.push([userId, event]);
      },
      afterCommit(callback) {
        afterCommit.push(callback);
      },
      hooks,
    };
    const result = transactional ? db.transaction(() => work(ctx)) : work(ctx);
    for (const [userId, event] of outbox) bus.emit(userId, event);
    for (const callback of afterCommit) callback();
    return result;
  };
}
