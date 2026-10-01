/**
 * Builds the `params` + `target` of each notification type (ported from the app's
 * `features/notifications/notification-factory.ts`), so every producer sends consistent data.
 * Inputs take the stored documents the callers already have.
 */
import type { Types } from 'mongoose';

import { messagePreview } from '../../lib/text.js';
import type { CategoryId } from '../../shared/catalog/index.js';
import type { NotificationParams, NotificationTarget } from '../../shared/contract/index.js';
import type { Rating, RequestCancellationReason, UserRole } from '../../shared/domain.js';
import type { NotificationType } from '../../shared/notification-types.js';

export interface RequestRef {
  _id: Types.ObjectId;
  categoryId: CategoryId;
}
export interface OfferRef {
  _id: Types.ObjectId;
  request: Types.ObjectId;
  price: number;
  currency: string;
  proposedStartAt: Date;
}
export interface JobRef {
  _id: Types.ObjectId;
  categoryId: CategoryId;
  scheduledStartAt: Date;
  agreedPrice: number;
  currency: string;
}
export interface ReviewRef {
  professional: Types.ObjectId;
  categoryId: CategoryId;
  rating: Rating;
  /** Reviewer's short name ("Noa L."). */
  customerName: string;
}

/** Everything needed to build a notification, by type. */
export type NotificationInput =
  | { type: 'new_matching_request'; request: RequestRef; customerName?: string; distanceKm?: number | null }
  | { type: 'offer_received' | 'offer_updated' | 'offer_withdrawn'; offer: OfferRef; categoryId: CategoryId; professionalName: string }
  | { type: 'offer_accepted'; offer: OfferRef; job: JobRef; customerName: string }
  | { type: 'offer_not_selected'; offer: OfferRef; categoryId: CategoryId; customerName?: string }
  | { type: 'offer_expired'; offer: OfferRef; categoryId: CategoryId }
  | { type: 'request_cancelled'; request: RequestRef; customerName: string; reason: RequestCancellationReason }
  | { type: 'job_confirmed' | 'job_started'; job: JobRef; professionalName: string }
  | { type: 'appointment_reminder' | 'job_completed'; job: JobRef; recipientRole: UserRole; counterpartName: string }
  | { type: 'job_cancelled'; job: JobRef }
  | { type: 'review_received'; review: ReviewRef }
  | {
      type: 'new_message';
      conversationId: Types.ObjectId;
      categoryId?: CategoryId;
      senderRole: UserRole;
      senderName: string;
      messageText: string;
      /**
       * Whether the recipient may still have an unread notification of this chat (they had unread
       * messages), which the new one replaces; `false` skips that lookup on the send path.
       */
      replacesUnread: boolean;
    };

export interface NotificationContent {
  type: NotificationType;
  params: NotificationParams;
  target: NotificationTarget;
}

const hex = (id: Types.ObjectId) => id.toHexString();
const offerTarget = (offer: OfferRef): NotificationTarget => ({ kind: 'offer', offerId: hex(offer._id), requestId: hex(offer.request) });
const jobTarget = (job: JobRef): NotificationTarget => ({ kind: 'job', jobId: hex(job._id) });
const requestTarget = (request: RequestRef): NotificationTarget => ({ kind: 'request', requestId: hex(request._id) });

/** The other party's name under the key the app expects for the recipient's role. */
function counterpart(recipientRole: UserRole, name: string): NotificationParams {
  return recipientRole === 'customer' ? { professionalName: name } : { customerName: name };
}

function content(input: NotificationInput): { params: NotificationParams; target: NotificationTarget } {
  switch (input.type) {
    case 'new_matching_request':
      return {
        params: { categoryId: input.request.categoryId, customerName: input.customerName, distanceKm: input.distanceKm ?? undefined },
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
          scheduledAt: input.offer.proposedStartAt.toISOString(),
        },
        target: offerTarget(input.offer),
      };
    case 'offer_withdrawn':
      return { params: { categoryId: input.categoryId, professionalName: input.professionalName }, target: offerTarget(input.offer) };
    case 'offer_accepted':
      return {
        params: {
          categoryId: input.job.categoryId,
          customerName: input.customerName,
          price: input.job.agreedPrice,
          currency: input.job.currency,
          scheduledAt: input.job.scheduledStartAt.toISOString(),
        },
        target: jobTarget(input.job),
      };
    case 'offer_not_selected':
      return { params: { categoryId: input.categoryId, customerName: input.customerName }, target: offerTarget(input.offer) };
    case 'offer_expired':
      return {
        params: { categoryId: input.categoryId, price: input.offer.price, currency: input.offer.currency },
        target: offerTarget(input.offer),
      };
    case 'request_cancelled':
      return {
        params: {
          categoryId: input.request.categoryId,
          customerName: input.customerName,
          // Only an account deletion changes the text; the customer's own reason is not sent.
          reason: input.reason === 'account_deleted' ? 'account_deleted' : undefined,
        },
        target: requestTarget(input.request),
      };
    case 'job_confirmed':
      return {
        params: {
          categoryId: input.job.categoryId,
          professionalName: input.professionalName,
          scheduledAt: input.job.scheduledStartAt.toISOString(),
        },
        target: jobTarget(input.job),
      };
    case 'job_started':
      return { params: { categoryId: input.job.categoryId, professionalName: input.professionalName }, target: jobTarget(input.job) };
    case 'appointment_reminder':
      return {
        params: {
          categoryId: input.job.categoryId,
          scheduledAt: input.job.scheduledStartAt.toISOString(),
          ...counterpart(input.recipientRole, input.counterpartName),
        },
        target: jobTarget(input.job),
      };
    case 'job_completed':
      return {
        params: {
          categoryId: input.job.categoryId,
          price: input.job.agreedPrice,
          currency: input.job.currency,
          ...counterpart(input.recipientRole, input.counterpartName),
        },
        target: jobTarget(input.job),
      };
    case 'job_cancelled':
      // No name: the professional deleted their account.
      return {
        params: { categoryId: input.job.categoryId, scheduledAt: input.job.scheduledStartAt.toISOString() },
        target: jobTarget(input.job),
      };
    case 'review_received':
      return {
        params: { categoryId: input.review.categoryId, customerName: input.review.customerName, rating: input.review.rating },
        target: { kind: 'professional', professionalId: hex(input.review.professional) },
      };
    case 'new_message':
      return {
        params: {
          categoryId: input.categoryId,
          messagePreview: messagePreview(input.messageText),
          ...(input.senderRole === 'professional' ? { professionalName: input.senderName } : { customerName: input.senderName }),
        },
        target: { kind: 'conversation', conversationId: hex(input.conversationId) },
      };
  }
}

/** Params without `undefined` entries (stored and sent exactly like the app's factory output). */
export function buildNotificationContent(input: NotificationInput): NotificationContent {
  const { params, target } = content(input);
  const compact = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as NotificationParams;
  return { type: input.type, params: compact, target };
}
