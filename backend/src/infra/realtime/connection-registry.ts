/** Open sockets of this instance, by user id. */
import { WebSocket } from 'ws';

export class ConnectionRegistry {
  private readonly byUser = new Map<string, Set<WebSocket>>();

  add(userId: string, socket: WebSocket): void {
    const sockets = this.byUser.get(userId) ?? new Set<WebSocket>();
    sockets.add(socket);
    this.byUser.set(userId, sockets);
  }

  remove(userId: string, socket: WebSocket): void {
    const sockets = this.byUser.get(userId);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) this.byUser.delete(userId);
  }

  /** Open sockets of `userId` on this instance. */
  countFor(userId: string): number {
    return this.byUser.get(userId)?.size ?? 0;
  }

  /** Sends one serialized frame to every open socket of `userIds`; returns how many got it. */
  deliver(userIds: readonly string[], frame: string): number {
    let delivered = 0;
    for (const userId of userIds) {
      for (const socket of this.byUser.get(userId) ?? []) {
        if (socket.readyState !== WebSocket.OPEN) continue;
        socket.send(frame);
        delivered += 1;
      }
    }
    return delivered;
  }

  all(): WebSocket[] {
    return [...this.byUser.values()].flatMap((sockets) => [...sockets]);
  }

  get size(): number {
    let count = 0;
    for (const sockets of this.byUser.values()) count += sockets.size;
    return count;
  }
}
