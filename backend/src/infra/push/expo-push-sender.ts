import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

import { SEND_FAILED, type PushMessage, type PushReceipt, type PushSender, type PushTicket } from './push-sender.js';

/**
 * Expo push service client. Requests are chunked (100 messages / 300 receipt ids, as Expo
 * requires); the SDK retries rate-limited requests. A failing chunk does not stop the others: its
 * messages get `SendFailed` tickets and unanswered receipt ids are simply asked again next time.
 */
export class ExpoPushSender implements PushSender {
  private readonly expo: Expo;

  constructor(accessToken: string | null) {
    this.expo = new Expo(accessToken ? { accessToken } : {});
  }

  isValidToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const expoMessages: ExpoPushMessage[] = messages.map((message) => ({
      to: message.to,
      title: message.title,
      body: message.body,
      data: message.data,
      sound: 'default',
      priority: 'high',
    }));
    const tickets: PushTicket[] = [];
    for (const chunk of this.expo.chunkPushNotifications(expoMessages)) {
      const tokens = chunk.map((message) => String(message.to));
      let chunkTickets: ExpoPushTicket[];
      try {
        chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
      } catch {
        tickets.push(...tokens.map((token) => ({ token, ticketId: null, error: SEND_FAILED })));
        continue;
      }
      chunkTickets.forEach((ticket, index) => {
        const token = tokens[index] ?? '';
        tickets.push(
          ticket.status === 'ok'
            ? { token, ticketId: ticket.id, error: null }
            : { token, ticketId: null, error: ticket.details?.error ?? 'ExpoError' },
        );
      });
    }
    return tickets;
  }

  async getReceipts(ticketIds: string[]): Promise<Map<string, PushReceipt>> {
    const receipts = new Map<string, PushReceipt>();
    for (const chunk of this.expo.chunkPushNotificationReceiptIds(ticketIds)) {
      let result: Awaited<ReturnType<Expo['getPushNotificationReceiptsAsync']>>;
      try {
        result = await this.expo.getPushNotificationReceiptsAsync(chunk);
      } catch {
        continue;
      }
      for (const [id, receipt] of Object.entries(result)) {
        receipts.set(id, receipt.status === 'ok' ? { status: 'ok' } : { status: 'error', error: receipt.details?.error ?? null });
      }
    }
    return receipts;
  }
}
