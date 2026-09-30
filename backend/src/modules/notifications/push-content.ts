/**
 * Localized push title/body for a stored notification, in the recipient's language (the in-app
 * inbox renders its own texts from `params`; push needs finished strings).
 */
import { isolateText } from '../../lib/text.js';
import { getCategoryById } from '../../shared/catalog/index.js';
import type { NotificationParams } from '../../shared/contract/index.js';
import { MARKET_TIME_ZONE, type AppLanguage } from '../../shared/domain.js';
import type { NotificationType } from '../../shared/notification-types.js';
import { PUSH_TEXTS } from './push-texts.js';

const LOCALES: Record<AppLanguage, string> = { en: 'en-IL', he: 'he-IL' };
/** Left-to-right/right-to-left isolation keeps a Latin name readable inside Hebrew text. */

function formatPrice(amount: number, currency: string, language: AppLanguage): string {
  try {
    return new Intl.NumberFormat(LOCALES[language], { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDateTime(iso: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MARKET_TIME_ZONE,
  }).format(new Date(iso));
}

const formatDistance = (km: number, language: AppLanguage) => (language === 'he' ? `${km} ק״מ` : `${km} km`);

function formatStars(count: number, language: AppLanguage): string {
  if (language === 'en') return `${count}-star`;
  if (count === 1) return 'כוכב אחד';
  return count === 2 ? 'שני כוכבים' : `${count} כוכבים`;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '');
}

export function pushContent(
  notification: { type: NotificationType; params: NotificationParams },
  language: AppLanguage,
): { title: string; body: string } {
  const texts = PUSH_TEXTS[language];
  const { params, type } = notification;
  const professionalName = params.professionalName ? isolateText(params.professionalName) : texts.fallbacks.professional;
  const customerName = params.customerName ? isolateText(params.customerName) : texts.fallbacks.customer;
  const values: Record<string, string> = {
    category: (params.categoryId && getCategoryById(params.categoryId)?.name[language]) || texts.fallbacks.service,
    price: params.price !== undefined ? formatPrice(params.price, params.currency ?? 'ILS', language) : '',
    date: params.scheduledAt ? formatDateTime(params.scheduledAt, language) : '',
    distance: params.distanceKm !== undefined ? formatDistance(params.distanceKm, language) : '',
    professionalName,
    customerName,
    name: isolateText(params.professionalName ?? params.customerName ?? texts.fallbacks.customer),
    preview: params.messagePreview ?? '',
    stars: formatStars(params.rating ?? 0, language),
  };
  const entry = texts.types[type];
  const useAlt =
    (type === 'new_matching_request' && params.distanceKm === undefined) ||
    (type === 'job_completed' && !params.professionalName) ||
    (type === 'new_message' && !params.messagePreview);
  return { title: fill(entry.title, values), body: fill(useAlt && entry.altBody ? entry.altBody : entry.body, values) };
}
