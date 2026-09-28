/**
 * Pure builders for in-app notifications. The mock backend creates every notification through
 * `buildNotification`, so params and navigation targets are consistent for each type.
 * The client renders `notifications:types.<type>.title|body` with `params`.
 *
 * Output is deterministic for a given input and `{ id, userId, now }`.
 */
import type { CategoryId } from '@/constants/professional-categories';
import { getMessagePreview } from '@/features/messaging/message-rules';
import type {
  AppNotification,
  EntityId,
  ISODateTimeString,
  Job,
  NotificationParams,
  NotificationTarget,
  Offer,
  Review,
  ServiceRequest,
  UserRole,
} from '@/types/domain';
import { toDate, type DateInput } from '@/utils/dates';

type RequestRef = Pick<ServiceRequest, 'id' | 'categoryId'>;
type OfferRef = Pick<Offer, 'id' | 'requestId' | 'price' | 'currency' | 'proposedStartAt'>;
type JobRef = Pick<Job, 'id' | 'categoryId' | 'scheduledStartAt' | 'agreedPrice' | 'currency'>;
type ReviewRef = Pick<Review, 'id' | 'professionalId' | 'rating' | 'categoryId' | 'customerDisplayName'>;

/** Everything needed to build a notification, discriminated by notification type. */
export type NotificationInput =
  | { type: 'new_matching_request'; request: RequestRef; customerName?: string; distanceKm?: number | null }
  | { type: 'offer_received' | 'offer_updated'; offer: OfferRef; categoryId: CategoryId; professionalName: string }
  | { type: 'offer_withdrawn'; offer: OfferRef; categoryId: CategoryId; professionalName: string }
  | { type: 'offer_accepted'; offer: OfferRef; job: JobRef; customerName: string }
  | { type: 'offer_not_selected'; offer: OfferRef; categoryId: CategoryId; customerName?: string }
  | { type: 'offer_expired'; offer: OfferRef; categoryId: CategoryId }
  | { type: 'request_cancelled'; request: RequestRef; customerName: string }
  | { type: 'job_confirmed' | 'job_started'; job: JobRef; professionalName: string }
  | { type: 'appointment_reminder' | 'job_completed'; job: JobRef; recipientRole: UserRole; counterpartName: string }
  | { type: 'review_received'; review: ReviewRef }
  | {
      type: 'new_message';
      conversationId: EntityId;
      categoryId?: CategoryId;
      senderRole: UserRole;
      senderName: string;
      messageText: string;
    };

interface NotificationMeta {
  id: EntityId;
  /** Recipient. */
  userId: EntityId;
  now: DateInput;
  /** Seed data can create already-read notifications. */
  readAt?: ISODateTimeString | null;
}

const offerTarget = (offer: OfferRef): NotificationTarget => ({ kind: 'offer', offerId: offer.id, requestId: offer.requestId });
const jobTarget = (job: JobRef): NotificationTarget => ({ kind: 'job', jobId: job.id });
const requestTarget = (request: RequestRef): NotificationTarget => ({ kind: 'request', requestId: request.id });

/** Removes `undefined` entries so params serialize identically to a real backend payload. */
function compact(params: NotificationParams): NotificationParams {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as NotificationParams;
}

/** Name param key for a counterpart of the given role. */
function counterpartParams(recipientRole: UserRole, counterpartName: string): NotificationParams {
  return recipientRole === 'customer' ? { professionalName: counterpartName } : { customerName: counterpartName };
}

function buildNotificationContent(input: NotificationInput): { params: NotificationParams; target: NotificationTarget } {
  switch (input.type) {
    case 'new_matching_request':
      return {
        params: {
          categoryId: input.request.categoryId,
          customerName: input.customerName,
          distanceKm: input.distanceKm ?? undefined,
        },
        target: requestTarget(input.request),
      };
    case 'offer_received':
    case 'offer_updated':
      return {
        params: {
          categoryId: input.categoryId,
          professionalName: input.professionalName,
          price: input.offer.price,
          currency: input.offer.currency,
          scheduledAt: input.offer.proposedStartAt,
        },
        target: offerTarget(input.offer),
      };
    case 'offer_withdrawn':
      return {
        params: { categoryId: input.categoryId, professionalName: input.professionalName },
        target: offerTarget(input.offer),
      };
    case 'offer_accepted':
      return {
        params: {
          categoryId: input.job.categoryId,
          customerName: input.customerName,
          price: input.job.agreedPrice,
          currency: input.job.currency,
          scheduledAt: input.job.scheduledStartAt,
        },
        target: jobTarget(input.job),
      };
    case 'offer_not_selected':
      return {
        params: { categoryId: input.categoryId, customerName: input.customerName },
        target: offerTarget(input.offer),
      };
    case 'offer_expired':
      return {
        params: { categoryId: input.categoryId, price: input.offer.price, currency: input.offer.currency },
        target: offerTarget(input.offer),
      };
    case 'request_cancelled':
      return {
        params: { categoryId: input.request.categoryId, customerName: input.customerName },
        target: requestTarget(input.request),
      };
    case 'job_confirmed':
      return {
        params: {
          categoryId: input.job.categoryId,
          professionalName: input.professionalName,
          scheduledAt: input.job.scheduledStartAt,
        },
        target: jobTarget(input.job),
      };
    case 'job_started':
      return {
        params: { categoryId: input.job.categoryId, professionalName: input.professionalName },
        target: jobTarget(input.job),
      };
    case 'appointment_reminder':
      return {
        params: {
          categoryId: input.job.categoryId,
          scheduledAt: input.job.scheduledStartAt,
          ...counterpartParams(input.recipientRole, input.counterpartName),
        },
        target: jobTarget(input.job),
      };
    case 'job_completed':
      return {
        params: {
          categoryId: input.job.categoryId,
          price: input.job.agreedPrice,
          currency: input.job.currency,
          ...counterpartParams(input.recipientRole, input.counterpartName),
        },
        target: jobTarget(input.job),
      };
    case 'review_received':
      return {
        params: {
          categoryId: input.review.categoryId,
          customerName: input.review.customerDisplayName,
          rating: input.review.rating,
        },
        target: { kind: 'professional', professionalId: input.review.professionalId },
      };
    case 'new_message':
      return {
        params: {
          categoryId: input.categoryId,
          messagePreview: getMessagePreview(input.messageText),
          ...(input.senderRole === 'professional'
            ? { professionalName: input.senderName }
            : { customerName: input.senderName }),
        },
        target: { kind: 'conversation', conversationId: input.conversationId },
      };
  }
}

/** Builds a complete `AppNotification` for `meta.userId`. */
export function buildNotification(input: NotificationInput, meta: NotificationMeta): AppNotification {
  const { params, target } = buildNotificationContent(input);
  return {
    id: meta.id,
    userId: meta.userId,
    type: input.type,
    params: compact(params),
    target,
    readAt: meta.readAt ?? null,
    createdAt: toDate(meta.now).toISOString(),
  };
}
