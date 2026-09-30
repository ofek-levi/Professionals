/** Reads the `data` of a push notification (sent by the server, so validated). Pure. */
import { NOTIFICATION_TYPES } from '@/constants/notification-types';
import type { NotificationTarget, NotificationType } from '@/types/domain';

import type { PushTap } from './types';

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

function parseTarget(value: unknown): NotificationTarget | null {
  if (!isObject(value)) return null;
  const { kind } = value;
  const id = (key: string) => text(value[key]);
  switch (kind) {
    case 'request': {
      const requestId = id('requestId');
      return requestId ? { kind, requestId } : null;
    }
    case 'offer': {
      const offerId = id('offerId');
      const requestId = id('requestId');
      return offerId && requestId ? { kind, offerId, requestId } : null;
    }
    case 'job': {
      const jobId = id('jobId');
      return jobId ? { kind, jobId } : null;
    }
    case 'conversation': {
      const conversationId = id('conversationId');
      return conversationId ? { kind, conversationId } : null;
    }
    case 'professional': {
      const professionalId = id('professionalId');
      return professionalId ? { kind, professionalId } : null;
    }
    case 'none':
      return { kind };
    default:
      return null;
  }
}

function parseType(value: unknown): NotificationType | null {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value) ? (value as NotificationType) : null;
}

/** The tap of a push whose `data` is `{ notificationId, notificationType, target }`, else `null`. */
export function parsePushTap(data: unknown): PushTap | null {
  if (!isObject(data)) return null;
  const target = parseTarget(data.target);
  if (!target) return null;
  return { notificationId: text(data.notificationId), notificationType: parseType(data.notificationType), target };
}
