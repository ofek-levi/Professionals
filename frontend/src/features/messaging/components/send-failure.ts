/**
 * Why a chat message was not sent, and whether sending it again can work:
 * - `offline`: network error, timeout or server error — retrying can work;
 * - `rateLimited`: too many messages (429, 60 per minute) — retrying works a bit later;
 * - `closed`: the chat was closed (409, the job was cancelled) — retrying never works;
 * - `rejected`: the server refused the message itself (400/403/404/422) — retrying never works.
 */
import { toApiError } from '@/services/api/errors';

export type SendFailureReason = 'offline' | 'rateLimited' | 'closed' | 'rejected';

export function sendFailureReason(error: unknown): SendFailureReason {
  const { status } = toApiError(error);
  if (status === 429) return 'rateLimited';
  if (status === 409) return 'closed';
  if (status >= 400 && status < 500 && status !== 408) return 'rejected';
  return 'offline';
}

export function canRetrySend(reason: SendFailureReason): boolean {
  return reason === 'offline' || reason === 'rateLimited';
}
