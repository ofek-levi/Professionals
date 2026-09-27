import { APP_CONFIG } from '@/constants/app-config';
import { computeOfferExpiry } from '@/features/offers/offer-status-machine';
import type { Offer, UrgencyLevel } from '@/types/domain';

export type OfferInput = Pick<Offer, 'id' | 'requestId' | 'professionalId' | 'price' | 'proposedStartAt' | 'createdAt'> &
  Partial<Offer> & {
    /** Used to derive `expiresAt` when it is not given. */
    urgency?: UrgencyLevel;
  };

/** Builds a pending offer; `expiresAt` follows the urgency rule relative to `createdAt`. */
export function createOffer({ urgency = 'normal', ...input }: OfferInput): Offer {
  return {
    currency: APP_CONFIG.defaultCurrency,
    estimatedDurationMinutes: null,
    message: null,
    status: 'pending',
    statusReason: null,
    expiresAt: computeOfferExpiry(urgency, input.proposedStartAt, input.createdAt),
    updatedAt: input.createdAt,
    respondedAt: null,
    ...input,
  };
}
