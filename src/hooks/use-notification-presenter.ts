import { useTranslation } from 'react-i18next';

import {
  getNotificationContent,
  type NotificationContent,
  type NotificationLookups,
} from '@/features/notifications/notification-presenter';
import { useCategoryLookup, type CategoryLookup } from '@/hooks/queries/use-category-catalog';
import { pickLocalizedText, useAppLanguage } from '@/i18n/hooks';
import type { AppLanguage, AppNotification } from '@/types/domain';
import { formatCurrency, formatDateTime, formatDistanceKm } from '@/utils/format';

/** Lookups for `getNotificationContent` bound to a catalog and a language. */
export function createNotificationLookups(catalog: Pick<CategoryLookup, 'getCategory'>, language: AppLanguage): NotificationLookups {
  return {
    categoryName: (categoryId) => pickLocalizedText(catalog.getCategory(categoryId)?.name, language),
    formatPrice: (amount, currency) => formatCurrency(amount, currency, language),
    formatDateTime: (isoDate) => formatDateTime(isoDate, language, { relativeDay: false, preset: 'short' }),
    formatDistance: (km) => formatDistanceKm(km, language),
  };
}

/**
 * Returns `(notification) => { title, body, icon, tone }` in the active language – for the
 * notification list, banners and dashboards.
 */
export function useNotificationPresenter(): (notification: Pick<AppNotification, 'type' | 'params'>) => NotificationContent {
  const { t } = useTranslation('notifications');
  const catalog = useCategoryLookup();
  const language = useAppLanguage();
  const lookups = createNotificationLookups(catalog, language);
  return (notification) => getNotificationContent(notification, t, lookups);
}
