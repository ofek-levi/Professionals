/**
 * Offer status as the professional who sent it sees it (see `getProfessionalOfferOutcome`): an
 * accepted offer whose request was cancelled afterwards shows as a cancelled job, never as
 * "Accepted"; a pending offer declined by the request's cancellation as "Request cancelled", not
 * "Not selected".
 */
import { useTranslation } from 'react-i18next';

import { OfferStatusBadge } from '@/components/offers';
import { Badge, type BadgeSize } from '@/components/ui';
import type { ProfessionalOfferOutcome } from '@/features/offers/offer-status-machine';

export function ProfessionalOfferStatusBadge({ outcome, size = 'md' }: { outcome: ProfessionalOfferOutcome; size?: BadgeSize }) {
  const { t } = useTranslation('offers');
  if (outcome === 'job_cancelled') {
    return <Badge label={t('jobCancelled.badge')} tone="danger" size={size} testID="offer-status-job_cancelled" />;
  }
  if (outcome === 'request_cancelled') {
    return <Badge label={t('requestCancelled.badge')} tone="neutral" size={size} testID="offer-status-request_cancelled" />;
  }
  return <OfferStatusBadge status={outcome} size={size} />;
}
