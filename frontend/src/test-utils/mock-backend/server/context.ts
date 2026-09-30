/**
 * Per-operation server context ("unit of work"). Every request and scheduled task runs through
 * `createUnitOfWorkRunner`, which:
 * - wraps mutations in a database transaction (all-or-nothing),
 * - buffers realtime events in an outbox and delivers them only after a successful commit,
 * - closes the realtime sockets of revoked sessions only when the work succeeded.
 */
import type { RealtimeEvent } from '@/services/realtime/types';
import { createId } from '@/utils/id';

import type { MockDatabase } from './db';
import type { MockEventBus } from './types';

export interface ServerContext {
  readonly db: MockDatabase;
  /** Injected clock. */
  now(): Date;
  nowIso(): string;
  newId(prefix: string): string;
  /** Queues a realtime event for `userId` (delivered after commit, de-duplicated). */
  emit(userId: string, event: RealtimeEvent): void;
  /** The session ended (sign-out, revocation): its realtime sockets close with 4001 after commit. */
  sessionRevoked(sessionId: string): void;
}

interface UnitOfWorkDeps {
  db: MockDatabase;
  clock: () => Date;
  bus: MockEventBus;
}

export type UnitOfWorkRunner = <T>(work: (ctx: ServerContext) => T, options?: { transactional?: boolean }) => T;

export function createUnitOfWorkRunner({ db, clock, bus }: UnitOfWorkDeps): UnitOfWorkRunner {
  return (work, { transactional = true } = {}) => {
    const outbox: [string, RealtimeEvent][] = [];
    const seen = new Set<string>();
    const revokedSessions: string[] = [];
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
      sessionRevoked(sessionId) {
        revokedSessions.push(sessionId);
      },
    };
    const result = transactional ? db.transaction(() => work(ctx)) : work(ctx);
    for (const [userId, event] of outbox) bus.emit(userId, event);
    for (const sessionId of revokedSessions) bus.revokeSession(sessionId);
    return result;
  };
}
