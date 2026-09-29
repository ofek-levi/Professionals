import { useTranslation } from 'react-i18next';

import { getRequestStatusLine } from '@/components/requests';
import type { StatusTone } from '@/constants/tones';
import { useFormatters } from '@/i18n/hooks';
import type { ServiceRequest } from '@/types/domain';

/**
 * The one-line status of a customer's request in lists ("3 offers to review", "Booked · Tue
 * 10:00", "Waiting for offers"…) with its tone – the same words as the request card.
 */
export function useRequestStatusText() {
  const { t } = useTranslation('common');
  const format = useFormatters();
  return (
    request: Pick<ServiceRequest, 'status' | 'pendingOfferCount'>,
    appointmentAt?: string | null,
  ): { label: string; tone: StatusTone } => {
    const line = getRequestStatusLine(request);
    switch (line.kind) {
      case 'offersToReview':
        return { label: t('request.statusLine.offersToReview', { count: line.count }), tone: line.tone };
      case 'booked':
        return {
          label: appointmentAt ? t('request.statusLine.bookedAt', { when: format.dateTime(appointmentAt) }) : t('request.statusLine.booked'),
          tone: line.tone,
        };
      default:
        return { label: t(`request.statusLine.${line.kind}`), tone: line.tone };
    }
  };
}
