/**
 * Offer status as its reader sees it. For the professional who sent it (see
 * `getProfessionalOfferOutcome`) an accepted offer whose request was cancelled afterwards shows as
 * a cancelled job, never as "Accepted"; reasons are worded for the professional or the customer.
 */
import { useTranslation } from 'react-i18next';

import { OfferStatusBadge } from '@/components/offers';
import { Badge, type BadgeSize } from '@/components/ui';
import { OFFER_STATUS_META } from '@/constants/offer-statuses';
import type { StatusTone } from '@/constants/tones';
import type { ProfessionalOfferOutcome } from '@/features/offers/offer-status-machine';
import type { Offer, UserRole } from '@/types/domain';

const JOB_CANCELLED_ICON = 'briefcase-remove-outline';

export function ProfessionalOfferStatusBadge({ outcome, size = 'md' }: { outcome: ProfessionalOfferOutcome; size?: BadgeSize }) {
  const { t } = useTranslation('offers');
  if (outcome === 'job_cancelled') {
    return <Badge label={t('jobCancelled.badge')} tone="danger" icon={JOB_CANCELLED_ICON} size={size} testID="offer-status-job_cancelled" />;
  }
  return <OfferStatusBadge status={outcome} size={size} />;
}

export interface OfferReasonDisplay {
  text: string;
  icon: string;
  tone: StatusTone;
}

/**
 * The explanation shown under a decided offer (`null` while pending or without a reason), worded
 * for the reader: the professional who sent it or the customer who received it.
 */
export function useOfferReason(
  outcome: ProfessionalOfferOutcome,
  statusReason: Offer['statusReason'],
  viewer: UserRole = 'professional',
): OfferReasonDisplay | null {
  const { t } = useTranslation(['offers', 'customer', 'common']);
  if (outcome === 'job_cancelled') return { text: t('offers:jobCancelled.reason'), icon: JOB_CANCELLED_ICON, tone: 'danger' };
  if (outcome === 'pending' || !statusReason) return null;
  const meta = OFFER_STATUS_META[outcome];
  const text = viewer === 'customer' ? t(`customer:offers.reasons.${statusReason}`) : t(`common:offerStatusReason.${statusReason}`);
  return { text, icon: meta.icon, tone: meta.tone };
}
