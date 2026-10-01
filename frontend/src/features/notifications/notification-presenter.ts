/**
 * Turns a structured `AppNotification` into display content (title, body, icon, tone).
 *
 * The backend only sends `type` + `params`; texts are rendered on the client from
 * `notifications:types.<type>.*` so they follow the active language. Formatting of values that
 * depend on the language (category names from the catalog, prices, dates, distances) is injected
 * through `lookups`, which keeps this module pure and easy to test.
 *
 * Person and business names are user data in any script, so they are wrapped in Unicode isolates
 * (`isolateText`): a Latin name inside a Hebrew sentence (or vice versa) keeps its own direction
 * and does not reorder the surrounding words and punctuation.
 */
import type { TFunction } from 'i18next';

import { notificationTypeMeta } from '@/constants/notification-types';
import type { StatusTone } from '@/constants/tones';
import type { AppNotification } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

export interface NotificationLookups {
  /** Localized category name (from the catalog's `LocalizedText`); `''` when unknown. */
  categoryName: (categoryId: string) => string;
  formatPrice: (amount: number, currency: string) => string;
  /** Appointment date + time, e.g. `Wed, Sep 30 at 10:00`. */
  formatDateTime: (isoDate: string) => string;
  formatDistance: (km: number) => string;
}

export interface NotificationContent {
  title: string;
  body: string;
  /** MaterialCommunityIcons glyph. */
  icon: string;
  tone: StatusTone;
}

type NotificationsT = TFunction<'notifications'>;

/** Currency used when a price arrives without one (should not happen with a valid backend). */
const FALLBACK_CURRENCY = 'ILS';

export function getNotificationContent(
  notification: Pick<AppNotification, 'type' | 'params'>,
  t: NotificationsT,
  lookups: NotificationLookups,
): NotificationContent {
  const { params } = notification;
  const meta = notificationTypeMeta(notification.type);
  // A type a newer server added (installed apps cannot be forced to update): a generic item.
  if (!meta) return unknownNotificationContent(t);

  const category = (params.categoryId && lookups.categoryName(params.categoryId)) || t('fallbacks.service');
  const professionalName = params.professionalName ? isolateText(params.professionalName) : t('fallbacks.professional');
  const customerName = params.customerName ? isolateText(params.customerName) : t('fallbacks.customer');
  const price = params.price !== undefined ? lookups.formatPrice(params.price, params.currency ?? FALLBACK_CURRENCY) : '';
  const date = params.scheduledAt ? lookups.formatDateTime(params.scheduledAt) : '';
  /** The other party of a job: professionals get `customerName`, customers `professionalName`. */
  const counterpart = isolateText(params.professionalName || params.customerName || '');

  const content = (title: string, body: string): NotificationContent => ({ title, body, icon: meta.icon, tone: meta.tone });

  switch (notification.type) {
    case 'new_matching_request':
      return content(
        t('types.new_matching_request.title', { category }),
        params.distanceKm !== undefined
          ? t('types.new_matching_request.body', { distance: lookups.formatDistance(params.distanceKm) })
          : t('types.new_matching_request.bodyNoDistance'),
      );
    case 'offer_received':
      return content(
        t('types.offer_received.title', { price }),
        t('types.offer_received.body', { professionalName, category }),
      );
    case 'offer_updated':
      return content(
        t('types.offer_updated.title'),
        t('types.offer_updated.body', { professionalName, category, price }),
      );
    case 'offer_withdrawn':
      return content(t('types.offer_withdrawn.title'), t('types.offer_withdrawn.body', { professionalName, category }));
    case 'offer_accepted':
      return content(
        t('types.offer_accepted.title'),
        t('types.offer_accepted.body', { customerName, price, category, date }),
      );
    case 'offer_not_selected':
      return content(t('types.offer_not_selected.title'), t('types.offer_not_selected.body', { category }));
    case 'offer_expired':
      return content(t('types.offer_expired.title'), t('types.offer_expired.body', { price, category }));
    case 'request_cancelled':
      // Cancelled by the customer's account deletion (the server sends no name then).
      return content(
        t('types.request_cancelled.title'),
        params.reason === 'account_deleted'
          ? t('types.request_cancelled.bodyAccountDeleted', { category })
          : t('types.request_cancelled.body', { customerName, category }),
      );
    case 'job_confirmed':
      return content(
        t('types.job_confirmed.title'),
        t('types.job_confirmed.body', { professionalName, category, date }),
      );
    case 'job_started':
      return content(t('types.job_started.title'), t('types.job_started.body', { professionalName, category }));
    case 'appointment_reminder':
      return content(
        t('types.appointment_reminder.title'),
        t('types.appointment_reminder.body', { category, name: counterpart || professionalName, date }),
      );
    case 'job_completed':
      // The factory sends `professionalName` to customers and `customerName` to professionals.
      return content(
        t('types.job_completed.title'),
        params.professionalName
          ? t('types.job_completed.bodyForCustomer', { category, name: professionalName })
          : t('types.job_completed.bodyForProfessional', { category, name: customerName }),
      );
    case 'job_cancelled':
      return content(t('types.job_cancelled.title'), t('types.job_cancelled.body', { category, date }));
    case 'review_received':
      return content(
        t('types.review_received.title', { count: params.rating ?? 0 }),
        t('types.review_received.body', { customerName, category }),
      );
    case 'new_message':
      return content(
        t('types.new_message.title', { name: counterpart || t('fallbacks.customer') }),
        params.messagePreview ? t('types.new_message.body', { preview: params.messagePreview }) : t('types.new_message.bodyEmpty'),
      );
    default:
      return unknownNotificationContent(t);
  }
}

function unknownNotificationContent(t: NotificationsT): NotificationContent {
  return { title: t('unknownType.title'), body: t('unknownType.body'), icon: 'bell-outline', tone: 'neutral' };
}
