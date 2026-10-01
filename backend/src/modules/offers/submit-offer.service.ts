/**
 * `POST /requests/:id/offers` (the mock's `submitOffer`): the professional covers the category and
 * the area, has no active offer on the request yet, and proposes an allowed time. One transaction
 * locks the professional's account (`lockActiveAccount`), inserts the offer and recounts the request
 * (`open → offers_received`); the customer is notified and the professional's response time is
 * refreshed after the commit.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { requestAcceptsOffers } from '../../shared/statuses.js';
import { vm } from '../../shared/validation-messages.js';
import { createNotification } from '../notifications/create-notification.service.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { refreshResponseTime } from '../reviews/professional-stats.service.js';
import { coversCategory, isWithinServiceArea } from '../requests/matching.service.js';
import { loadRequest } from '../requests/request-access.js';
import { publishRequestUpdated } from '../requests/request-events.js';
import { lockActiveAccount } from '../users/me.service.js';
import { publishOfferUpdated } from './offer-events.js';
import { assertProposedStart, assertSupportedCurrency, computeOfferExpiry } from './offer-rules.js';
import { syncRequestOfferCounters } from './offer-counters.service.js';
import { OfferModel, type OfferDoc } from './offer.model.js';
import type { CreateOfferInput } from './offers.schemas.js';

type SubmitDeps = Pick<AppDeps, 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background' | 'cache'>;
type OfferingProfessional = Pick<ProfessionalDoc, '_id' | 'displayName' | 'categoryIds' | 'serviceArea'>;

const duplicateOffer = () => ApiError.conflict('You already have an active offer on this request', 'DUPLICATE_OFFER');

export async function submitOffer(deps: SubmitDeps, auth: AuthContext, requestId: Types.ObjectId, input: CreateOfferInput): Promise<OfferDoc> {
  try {
    return await withTransaction(deps.logger, async (tx) => {
      await lockActiveAccount(auth.userId, tx);
      const professional = await ProfessionalModel.findById(auth.userId, { displayName: 1, categoryIds: 1, serviceArea: 1 })
        .session(tx.session)
        .lean<OfferingProfessional>();
      if (!professional) throw ApiError.notFound('Professional');
      const request = await loadRequest(requestId, tx.session);
      if (request.status === 'draft') throw ApiError.notFound('Request');
      if (!requestAcceptsOffers(request.status)) throw ApiError.conflict('This request no longer accepts offers', 'REQUEST_NOT_ACCEPTING_OFFERS');
      if (!coversCategory(professional, request.categoryId)) {
        throw ApiError.validation({ categoryId: [vm('category.notOffered')] }, 'You do not offer this service category', 'UNSUPPORTED_CATEGORY');
      }
      if (!isWithinServiceArea(professional, request)) {
        throw ApiError.validation({ location: [vm('location.outsideServiceArea')] }, 'The request is outside your service area', 'OUTSIDE_SERVICE_AREA');
      }
      const active = await OfferModel.exists({ request: request._id, professional: professional._id, status: { $in: ['pending', 'accepted'] } }).session(tx.session);
      if (active) throw duplicateOffer();
      const now = deps.clock.now();
      assertSupportedCurrency(input.currency);
      assertProposedStart(input.proposedStartAt, request.urgency, now);

      const [created] = await OfferModel.create(
        [
          {
            request: request._id,
            professional: professional._id,
            price: input.price,
            currency: input.currency,
            proposedStartAt: input.proposedStartAt,
            estimatedDurationMinutes: input.estimatedDurationMinutes,
            message: input.message,
            status: 'pending',
            expiresAt: computeOfferExpiry(request.urgency, input.proposedStartAt, now),
          },
        ],
        { session: tx.session },
      );
      if (!created) throw new Error('Offer was not created');
      const offer = created.toObject<OfferDoc>();
      const updatedRequest = await syncRequestOfferCounters(request._id, tx);
      // A derived statistic: recomputed after the commit, off the request (see professional-stats).
      tx.afterCommit(() => deps.background.run('response-time', () => refreshResponseTime(deps, professional._id)));
      await createNotification(
        deps,
        request.customer,
        { type: 'offer_received', offer, categoryId: request.categoryId, professionalName: professional.displayName },
        tx,
      );
      await publishOfferUpdated(deps, offer, request.customer, tx);
      await publishRequestUpdated(deps, updatedRequest, { tx });
      return offer;
    });
  } catch (error) {
    // Two concurrent submissions: the unique active-offer index rejects the second one.
    if (isDuplicateKeyError(error)) throw duplicateOffer();
    throw error;
  }
}
