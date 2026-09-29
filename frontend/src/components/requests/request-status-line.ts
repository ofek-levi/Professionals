/**
 * The single status line of a customer's request card: what the request needs from the customer
 * (or where it stands), in one short phrase with a tone.
 */
import type { StatusTone } from '@/constants/tones';
import type { ServiceRequest } from '@/types/domain';

type RequestStatusLineKind =
  | 'draft'
  | 'waitingForOffers'
  | 'offersToReview'
  | 'booked'
  | 'inProgress'
  | 'completed'
  | 'cancelled';

interface RequestStatusLine {
  kind: RequestStatusLineKind;
  tone: StatusTone;
  /** Offers waiting for a decision (`offersToReview` only). */
  count: number;
}

export function getRequestStatusLine(request: Pick<ServiceRequest, 'status' | 'pendingOfferCount'>): RequestStatusLine {
  const line = (kind: RequestStatusLineKind, tone: StatusTone, count = 0): RequestStatusLine => ({ kind, tone, count });
  switch (request.status) {
    case 'draft':
      return line('draft', 'neutral');
    case 'open':
      return line('waitingForOffers', 'neutral');
    case 'offers_received':
      return request.pendingOfferCount > 0
        ? line('offersToReview', 'brand', request.pendingOfferCount)
        : line('waitingForOffers', 'neutral');
    case 'professional_selected':
    case 'scheduled':
      return line('booked', 'info');
    case 'in_progress':
      return line('inProgress', 'warning');
    case 'completed':
      return line('completed', 'success');
    case 'cancelled':
      return line('cancelled', 'neutral');
  }
}
