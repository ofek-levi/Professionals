/**
 * Helpers used to write the seed scenarios: a clock relative to the seed "now" and thin wrappers
 * around the factories that insert rows into the database.
 */
import { computeRequestOfferStats } from '../server/offer-counters';
import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { findNextWorkingSlot } from '@/features/profiles/availability';
import { distanceFromServiceAreaKm } from '../server/request-matching';
import { requestStatusForPendingOffers } from '@/features/requests/request-status-machine';
import type { NotificationInput } from '../server/notification-factory';
import type { ISODateString, ISODateTimeString, RequestPhoto, ServiceLocation, ServiceRequest } from '@/types/domain';
import { addDays, addMinutes, combineDateAndTime, roundUpToMinutes, toDateKey } from '@/utils/dates';

import {
  createConversation,
  createJob,
  createMessage,
  createNotification,
  createOffer,
  createRequest,
  createReview,
  type ConversationInput,
  type JobInput,
  type MessageInput,
  type OfferInput,
  type RequestInput,
  type ReviewInput,
} from '../factories';
import type { MockDatabase, StoredConversation, StoredJob } from '../server/db';
import { computeCustomerStats, computeProfessionalStats } from '../server/services/review-service';
import { locationFromPlace } from '../server/services/geo-service';

const MINUTE_MS = 60_000;

/** Time helpers relative to the seed's "now" (local wall-clock where a time of day is given). */
class SeedTime {
  constructor(readonly now: Date) {}

  minutesAgo(minutes: number): ISODateTimeString {
    return new Date(this.now.getTime() - minutes * MINUTE_MS).toISOString();
  }

  hoursAgo(hours: number): ISODateTimeString {
    return this.minutesAgo(hours * 60);
  }

  daysAgo(days: number, time?: string): ISODateTimeString {
    if (!time) return this.minutesAgo(days * 24 * 60);
    return combineDateAndTime(toDateKey(addDays(this.now, -days)), time);
  }

  minutesFromNow(minutes: number): ISODateTimeString {
    return addMinutes(this.now, minutes).toISOString();
  }

  /** Local date `dayOffset` days from today at `time`. */
  atDay(dayOffset: number, time: string): ISODateTimeString {
    return combineDateAndTime(this.dateKey(dayOffset), time);
  }

  dateKey(dayOffset: number): ISODateString {
    return toDateKey(addDays(this.now, dayOffset));
  }

  /**
   * Earliest 15-minute slot at least `minMinutes` from now during daytime (08:00–19:00);
   * otherwise 08:30 the next morning.
   */
  daytimeSlot(minMinutes: number): ISODateTimeString {
    const candidate = roundUpToMinutes(addMinutes(this.now, minMinutes), 15);
    const hour = candidate.getHours();
    if (hour >= 8 && hour < 19) return candidate.toISOString();
    const nextMorning = new Date(candidate.getTime());
    if (hour >= 19) nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(8, 30, 0, 0);
    return nextMorning.toISOString();
  }

  /**
   * First day offset ≥ `minOffset` that is not a Saturday (most trades do not work on Shabbat).
   */
  workdayOffset(minOffset: number): number {
    let offset = minOffset;
    while (addDays(this.now, offset).getDay() === 6) offset += 1;
    return offset;
  }

  /** Adds minutes to an ISO instant. */
  plus(iso: ISODateTimeString, minutes: number): ISODateTimeString {
    return new Date(Date.parse(iso) + minutes * MINUTE_MS).toISOString();
  }
}

export class SeedBuilder {
  readonly t: SeedTime;
  private notificationSequence = 0;

  constructor(
    readonly db: MockDatabase,
    now: Date,
  ) {
    this.t = new SeedTime(now);
  }

  /**
   * First slot inside the professional's working hours at or after `from` (falls back to `from`).
   */
  workingSlot(professionalId: string, from: ISODateTimeString, durationMinutes = 60): ISODateTimeString {
    const professional = this.db.professionals.require(professionalId, 'Professional');
    return findNextWorkingSlot(professional.availability, from, { durationMinutes })?.toISOString() ?? from;
  }

  /**
   * Proposed start for a seeded offer: the professional's next working slot from `preferred`,
   * unless that would break the offer time rules (urgency windows) – then `preferred` itself.
   */
  offerStart(
    professionalId: string,
    preferred: ISODateTimeString,
    durationMinutes: number,
    request: Pick<ServiceRequest, 'urgency' | 'preferredSchedule'>,
    offeredAt: ISODateTimeString,
  ): ISODateTimeString {
    const slot = this.workingSlot(professionalId, preferred, durationMinutes);
    return validateOfferAgainstRequest({ proposedStartAt: slot, request, now: offeredAt }).isValid ? slot : preferred;
  }

  /** Distance (km, 0.1 precision) from a professional's service-area center to a request. */
  distance(professionalId: string, request: Pick<ServiceRequest, 'location'>): number {
    const professional = this.db.professionals.require(professionalId, 'Professional');
    return distanceFromServiceAreaKm(professional.serviceArea, request.location.coordinates);
  }

  location(placeId: string, streetIndex: number, houseNumber: number, details: string | null = null): ServiceLocation {
    return locationFromPlace(placeId, streetIndex, houseNumber, details);
  }

  /** Deterministic stock photo for a request (registered as the owner's upload so drafts can be edited). */
  photo(requestId: string, index: number, ownerId: string, createdAt: ISODateTimeString): RequestPhoto {
    const photo: RequestPhoto = {
      id: `upl_${requestId}_${index}`,
      url: `https://picsum.photos/seed/${requestId}-${index}/1200/900`,
      width: 1200,
      height: 900,
    };
    this.db.uploads.insert({ ...photo, ownerId, mimeType: 'image/jpeg', fileName: `photo-${index}.jpg`, createdAt });
    return photo;
  }

  request(input: RequestInput) {
    return this.db.requests.insert(createRequest(input));
  }

  offer(input: OfferInput) {
    return this.db.offers.insert(createOffer(input));
  }

  job(input: JobInput): StoredJob {
    return this.db.jobs.insert(createJob(input));
  }

  conversation(input: ConversationInput): StoredConversation {
    return this.db.conversations.insert(createConversation(input));
  }

  message(input: MessageInput) {
    return this.db.messages.insert(createMessage(input));
  }

  review(input: ReviewInput) {
    return this.db.reviews.insert(createReview(input));
  }

  notification(userId: string, createdAt: ISODateTimeString, input: NotificationInput, read = false) {
    this.notificationSequence += 1;
    return this.db.notifications.insert(
      createNotification({
        id: `ntf_seed_${String(this.notificationSequence).padStart(3, '0')}`,
        userId,
        createdAt,
        readAt: read ? this.t.plus(createdAt, 20) : null,
        input,
      }),
    );
  }

  /** Makes every denormalized value consistent with the source rows. */
  finalize(): void {
    for (const request of this.db.requests.all()) {
      const stats = computeRequestOfferStats(this.db.offers.filter((offer) => offer.requestId === request.id));
      this.db.requests.update(request.id, {
        offerCount: stats.offerCount,
        pendingOfferCount: stats.pendingOfferCount,
        status: requestStatusForPendingOffers(request.status, stats.pendingOfferCount),
      });
    }
    for (const conversation of this.db.conversations.all()) {
      const last = this.db.messages
        .filter((message) => message.conversationId === conversation.id)
        .reduce<string>((latest, message) => (message.createdAt > latest ? message.createdAt : latest), conversation.createdAt);
      this.db.conversations.update(conversation.id, { updatedAt: last });
    }
    for (const professional of this.db.professionals.all()) {
      this.db.professionals.update(professional.id, { stats: computeProfessionalStats(this.db, professional.id) });
    }
    for (const profile of this.db.customerProfiles.all()) {
      this.db.customerProfiles.update(profile.userId, { stats: computeCustomerStats(this.db, profile.userId) });
    }
  }
}
