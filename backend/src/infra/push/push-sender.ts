/**
 * Push delivery (Expo push service). One message per device token; the sender chunks requests.
 * A ticket id is later exchanged for a receipt (`notifications.jobs.ts` checks them every 15 min and
 * removes tokens Expo reports as `DeviceNotRegistered` from their session).
 */
export interface PushMessage {
  /** Expo push token (`ExponentPushToken[…]`). */
  to: string;
  title: string;
  body: string;
  /** Deep-link payload: `{ notificationId, notificationType, target }`. */
  data: Record<string, unknown>;
}

export interface PushTicket {
  token: string;
  /** Receipt id to check later; `null` when the send failed immediately. */
  ticketId: string | null;
  /** Expo error code, e.g. `DeviceNotRegistered`. */
  error: string | null;
}

export type PushReceipt = { status: 'ok' } | { status: 'error'; error: string | null };

export interface PushSender {
  isValidToken(token: string): boolean;
  /** Tickets in the same order as `messages`. */
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  /** Receipts by ticket id (ids Expo does not know yet are missing from the map). */
  getReceipts(ticketIds: string[]): Promise<Map<string, PushReceipt>>;
}

export const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';
/** Ticket error when the request to the push service itself failed (network, 5xx). */
export const SEND_FAILED = 'SendFailed';
