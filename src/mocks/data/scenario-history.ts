/**
 * Generated job history: completed requests with accepted (and sometimes competing) offers,
 * completed jobs, short conversations and reviews, so every professional has a realistic rating
 * history. Deterministic (seeded PRNG) and relative to the seed "now".
 */
import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { isWithinServiceArea } from '@/features/requests/request-matching';
import { createSeededRandom } from '@/features/shared/seeded-random';
import type { UrgencyLevel } from '@/types/domain';

import { customerShortName } from '../server/queries';
import { describeHistoricalRequest, randomRating, randomReviewComment } from './content';
import { getPlace } from './places';
import { randomDuration, randomQuote } from './price-ranges';
import { DEMO_PROFESSIONAL_IDS, PROFESSIONALS } from './professionals';
import type { SeedBuilder } from './seed-builder';
import { CUSTOMERS } from './users';

const pad = (value: number) => String(value).padStart(2, '0');
const DEMO_PRO_ID_SET: ReadonlySet<string> = new Set(Object.values(DEMO_PROFESSIONAL_IDS));

export function seedHistory(b: SeedBuilder): void {
  const { t, db } = b;
  const random = createSeededRandom('professionals-history-v1');
  const customers = CUSTOMERS.filter((customer) => !customer.isDemo);
  let sequence = 0;

  for (const seed of PROFESSIONALS) {
    const professional = db.professionals.require(seed.id, 'Professional');
    let latestReviewId: string | null = null;

    for (let index = 0; index < seed.historyJobs; index += 1) {
      sequence += 1;
      const key = `h${pad(sequence)}`;
      const categoryId = random.pick(seed.historyCategoryIds ?? seed.categoryIds);

      // A customer living inside the service area (or a nearby address when nobody does).
      const eligible = customers.filter((customer) =>
        isWithinServiceArea(
          professional.serviceArea,
          b.location(customer.home.placeId, customer.home.streetIndex, customer.home.houseNumber).coordinates,
        ),
      );
      const customer = eligible.length > 0 ? random.pick(eligible) : random.pick(customers);
      const basePlace = getPlace(seed.base.placeId);
      const location =
        eligible.length > 0
          ? b.location(customer.home.placeId, customer.home.streetIndex, customer.home.houseNumber, customer.home.details)
          : b.location(basePlace.id, random.int(0, basePlace.streets.length - 1), random.int(2, 90));

      const urgency: UrgencyLevel = random.pick(['normal', 'normal', 'urgent', 'flexible'] as const);
      const createdAt = t.daysAgo(random.int(14, 320), `${pad(random.int(7, 21))}:${pad(random.pick([5, 20, 35, 50]))}`);
      const publishedAt = t.plus(createdAt, random.int(1, 6));
      const offerAt = t.plus(publishedAt, random.int(12, 240));
      const acceptedAt = t.plus(offerAt, random.int(45, 18 * 60));
      const durationMinutes = randomDuration(categoryId, random);
      const leadMinutes =
        urgency === 'urgent' ? random.int(2, 20) * 60 : urgency === 'flexible' ? random.int(2, 6) * 24 * 60 : random.int(1, 3) * 24 * 60;
      // Inside working hours when possible, but never outside the urgency window of the offer.
      const withinRules = (start: string, offeredAt: string) =>
        validateOfferAgainstRequest({ proposedStartAt: start, request: { urgency, preferredSchedule: null }, now: offeredAt }).isValid;
      const preferredStart = b.workingSlot(seed.id, t.plus(acceptedAt, leadMinutes), Math.min(durationMinutes, 8 * 60));
      const startAt = withinRules(preferredStart, offerAt) ? preferredStart : t.plus(acceptedAt, 60);
      const price = randomQuote(categoryId, random);

      const requestId = `req_${key}`;
      const offerId = `off_${key}_won`;
      const jobId = `job_${key}`;
      const conversationId = `cnv_${key}`;
      const completedAt = t.plus(startAt, durationMinutes + random.int(0, 40));
      const reviewed = random.chance(0.85);
      const reviewId = reviewed ? `rev_${key}` : null;

      b.request({
        id: requestId,
        customerId: customer.id,
        categoryId,
        description: describeHistoricalRequest(categoryId, random),
        location,
        urgency,
        status: 'completed',
        acceptedOfferId: offerId,
        jobId,
        createdAt,
        publishedAt,
        updatedAt: completedAt,
      });
      const offer = b.offer({
        id: offerId,
        requestId,
        professionalId: seed.id,
        price,
        urgency,
        proposedStartAt: startAt,
        estimatedDurationMinutes: durationMinutes,
        status: 'accepted',
        statusReason: 'accepted_by_customer',
        respondedAt: acceptedAt,
        createdAt: offerAt,
        updatedAt: acceptedAt,
      });

      // Sometimes another matching professional competed for the job and lost.
      const competitors = db.professionals.filter(
        (candidate) =>
          candidate.id !== seed.id &&
          (candidate.categoryIds as readonly string[]).includes(categoryId) &&
          isWithinServiceArea(candidate.serviceArea, location.coordinates),
      );
      if (competitors.length > 0 && random.chance(0.45)) {
        const competitor = random.pick(competitors);
        const competitorOfferAt = t.plus(offerAt, random.int(5, 40));
        const competitorStart = t.plus(startAt, random.int(1, 3) * 60);
        const competitorOffer = b.offer({
          id: `off_${key}_lost`,
          requestId,
          professionalId: competitor.id,
          price: Math.round((price * random.float(1.05, 1.4)) / 10) * 10,
          urgency,
          proposedStartAt: withinRules(competitorStart, competitorOfferAt) ? competitorStart : startAt,
          estimatedDurationMinutes: durationMinutes,
          status: 'rejected',
          statusReason: 'another_offer_accepted',
          respondedAt: acceptedAt,
          createdAt: competitorOfferAt,
          updatedAt: acceptedAt,
        });
        if (DEMO_PRO_ID_SET.has(competitor.id)) {
          b.notification(
            competitor.userId,
            acceptedAt,
            {
              type: 'offer_not_selected',
              offer: competitorOffer,
              categoryId,
              customerName: customerShortName(db.users.require(customer.id, 'User')),
            },
            true,
          );
        }
      }

      b.conversation({
        id: conversationId,
        jobId,
        requestId,
        customerId: customer.id,
        professionalUserId: professional.userId,
        createdAt: acceptedAt,
      });
      b.message({
        id: `msg_${key}_1`,
        conversationId,
        senderId: professional.userId,
        text: `Hi ${customer.firstName}, thanks for choosing ${professional.displayName}! I’ll see you at the scheduled time.`,
        createdAt: t.plus(acceptedAt, 12),
        readAt: t.plus(acceptedAt, 40),
      });
      b.message({
        id: `msg_${key}_2`,
        conversationId,
        senderId: customer.id,
        text: random.pick(['Great, thanks!', 'Perfect, see you then.', 'תודה, נתראה!', 'Thanks! The parking is in front of the building.']),
        createdAt: t.plus(acceptedAt, 41),
        readAt: t.plus(acceptedAt, 70),
      });
      b.job({
        id: jobId,
        conversationId,
        request: db.requests.require(requestId, 'Request'),
        offer,
        status: 'completed',
        confirmedAt: t.plus(acceptedAt, random.int(10, 120)),
        startedAt: t.plus(startAt, random.int(0, 15)),
        completedAt,
        completedBy: random.chance(0.7) ? 'professional' : 'customer',
        reviewId,
        createdAt: acceptedAt,
        updatedAt: completedAt,
      });

      if (reviewId) {
        const rating = randomRating(random);
        const customerUser = db.users.require(customer.id, 'User');
        const review = b.review({
          id: reviewId,
          jobId,
          professionalId: seed.id,
          customerId: customer.id,
          categoryId,
          rating,
          comment: randomReviewComment(rating, random),
          customerDisplayName: customerShortName(customerUser),
          customerAvatarUrl: customerUser.avatarUrl,
          createdAt: t.plus(completedAt, random.int(60, 36 * 60)),
        });
        if (!latestReviewId || review.createdAt > db.reviews.require(latestReviewId, 'Review').createdAt) latestReviewId = review.id;
      }
    }

    if (seed.isDemo && latestReviewId) {
      const review = db.reviews.require(latestReviewId, 'Review');
      b.notification(professional.userId, review.createdAt, { type: 'review_received', review }, true);
    }
  }
}
