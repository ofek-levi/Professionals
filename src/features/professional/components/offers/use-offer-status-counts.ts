import { useProfessionalOffers } from '@/hooks';
import type { ProOfferFilter } from '@/features/offers/components/offer-display';

/**
 * Number of offers per status chip, read from each status list's `totalCount` (one tiny page per
 * status). Hooks are called explicitly (no loop) to keep a stable hook order.
 */
export function useOfferStatusCounts(): { counts: Partial<Record<ProOfferFilter, number>>; refetch: () => void } {
  const pending = useProfessionalOffers({ statuses: ['pending'], limit: 1 });
  const accepted = useProfessionalOffers({ statuses: ['accepted'], limit: 1 });
  const rejected = useProfessionalOffers({ statuses: ['rejected'], limit: 1 });
  const withdrawn = useProfessionalOffers({ statuses: ['withdrawn'], limit: 1 });
  const expired = useProfessionalOffers({ statuses: ['expired'], limit: 1 });
  const all = useProfessionalOffers({ limit: 1 });
  return {
    counts: {
      pending: pending.data?.totalCount,
      accepted: accepted.data?.totalCount,
      rejected: rejected.data?.totalCount,
      withdrawn: withdrawn.data?.totalCount,
      expired: expired.data?.totalCount,
      all: all.data?.totalCount,
    },
    refetch: () => {
      [pending, accepted, rejected, withdrawn, expired, all].forEach((query) => void query.refetch());
    },
  };
}
