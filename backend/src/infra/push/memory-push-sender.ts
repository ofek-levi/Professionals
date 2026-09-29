import { SEND_FAILED, type PushMessage, type PushReceipt, type PushSender, type PushTicket } from './push-sender.js';

/**
 * In-memory push sender for tests: records `sent` messages. Tokens in `unregistered` get an
 * immediate `DeviceNotRegistered` ticket, tokens in `failing` a `SendFailed` one (the request to
 * Expo failed); `receipts` can be preset per ticket id.
 */
export class MemoryPushSender implements PushSender {
  readonly sent: PushMessage[] = [];
  readonly unregistered = new Set<string>();
  readonly failing = new Set<string>();
  readonly receipts = new Map<string, PushReceipt>();
  private nextTicket = 1;

  isValidToken(token: string): boolean {
    return /^Expo(nent)?PushToken\[.+\]$/.test(token);
  }

  send(messages: PushMessage[]): Promise<PushTicket[]> {
    this.sent.push(...messages);
    return Promise.resolve(
      messages.map((message): PushTicket => {
        if (this.failing.has(message.to)) return { token: message.to, ticketId: null, error: SEND_FAILED };
        if (this.unregistered.has(message.to)) return { token: message.to, ticketId: null, error: 'DeviceNotRegistered' };
        return { token: message.to, ticketId: `ticket-${this.nextTicket++}`, error: null };
      }),
    );
  }

  getReceipts(ticketIds: string[]): Promise<Map<string, PushReceipt>> {
    return Promise.resolve(
      new Map(ticketIds.flatMap((id) => {
        const receipt = this.receipts.get(id);
        return receipt ? [[id, receipt] as const] : [];
      })),
    );
  }
}
