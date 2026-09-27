import { useCallback } from 'react';

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

  // Built from the queries' own refetch functions (stable per observer): the query result objects
  // are new on every render, so a closure over them would change identity on every render.
  const { refetch: refetchPending } = pending;
  const { refetch: refetchAccepted } = accepted;
  const { refetch: refetchRejected } = rejected;
  const { refetch: refetchWithdrawn } = withdrawn;
  const { refetch: refetchExpired } = expired;
  const { refetch: refetchAll } = all;
  const refetch = useCallback(() => {
    for (const refetchOne of [refetchPending, refetchAccepted, refetchRejected, refetchWithdrawn, refetchExpired, refetchAll]) {
      void refetchOne();
    }
  }, [refetchPending, refetchAccepted, refetchRejected, refetchWithdrawn, refetchExpired, refetchAll]);

  return {
    counts: {
      pending: pending.data?.totalCount,
      accepted: accepted.data?.totalCount,
      rejected: rejected.data?.totalCount,
      withdrawn: withdrawn.data?.totalCount,
      expired: expired.data?.totalCount,
      all: all.data?.totalCount,
    },
    refetch,
  };
}
