import { requestStatusForJobStatus } from '@/features/jobs/job-status-machine';
import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { computeRequestOfferStats } from '../server/offer-counters';
import { requestStatusForPendingOffers } from '@/features/requests/request-status-machine';

import { PLACES } from '../data/places';
import { MAIN_CUSTOMER_IDS, MAIN_PRO_IDS, SEED_IDS } from '../data/seed';
import { computeCustomerStats, computeProfessionalStats } from '../server/services/review-service';
import { runScheduledTasks } from '../server/services/scheduler';
import { createTestEnvironment, TEST_NOW, type TestEnvironment } from '../testing/test-server';

describe('seed data integrity', () => {
  let env: TestEnvironment;
  beforeAll(async () => {
    env = await createTestEnvironment();
  });
  const db = () => env.server.internals.db;

  it('has the expected volume of data', () => {
    expect(db().users.count((user) => user.role === 'customer')).toBeGreaterThanOrEqual(8);
    expect(db().professionals.size).toBeGreaterThanOrEqual(15);
    expect(db().jobs.count((job) => job.status === 'completed')).toBeGreaterThanOrEqual(30);
    expect(db().reviews.size).toBeGreaterThanOrEqual(25);
    expect(PLACES.length).toBeGreaterThanOrEqual(40);
  });

  it('keeps every reference valid', () => {
    const { users, customerProfiles, professionals, requests, offers, jobs, reviews, notifications, conversations, messages } = db();
    for (const request of requests.all()) {
      expect(users.get(request.customerId)?.role).toBe('customer');
      if (request.acceptedOfferId) {
        const accepted = offers.get(request.acceptedOfferId);
        expect(accepted?.requestId).toBe(request.id);
        expect(accepted?.status).toBe('accepted');
      }
      if (request.jobId) expect(jobs.get(request.jobId)?.requestId).toBe(request.id);
      for (const photo of request.photos) expect(db().uploads.get(photo.id)?.ownerId).toBe(request.customerId);
    }
    for (const offer of offers.all()) {
      expect(requests.has(offer.requestId)).toBe(true);
      expect(professionals.has(offer.professionalId)).toBe(true);
    }
    for (const job of jobs.all()) {
      const request = requests.require(job.requestId, 'Request');
      expect(request.jobId).toBe(job.id);
      expect(request.acceptedOfferId).toBe(job.offerId);
      expect(offers.get(job.offerId)?.professionalId).toBe(job.professionalId);
      expect(job.customerId).toBe(request.customerId);
      expect(conversations.get(job.conversationId)?.jobId).toBe(job.id);
      if (job.reviewId) expect(reviews.get(job.reviewId)?.jobId).toBe(job.id);
    }
    for (const review of reviews.all()) {
      const job = jobs.require(review.jobId, 'Job');
      expect(job.status).toBe('completed');
      expect(job.reviewId).toBe(review.id);
      expect(review.professionalId).toBe(job.professionalId);
      expect(review.customerId).toBe(job.customerId);
    }
    for (const conversation of conversations.all()) {
      const job = jobs.require(conversation.jobId, 'Job');
      const participantIds = conversation.participants.map((participant) => participant.userId).sort();
      expect(participantIds).toEqual([job.customerId, professionals.require(job.professionalId, 'Pro').userId].sort());
    }
    for (const message of messages.all()) {
      const conversation = conversations.require(message.conversationId, 'Conversation');
      expect(conversation.participants.some((participant) => participant.userId === message.senderId)).toBe(true);
    }
    for (const notification of notifications.all()) expect(users.has(notification.userId)).toBe(true);
    for (const profile of customerProfiles.all()) expect(users.get(profile.userId)?.role).toBe('customer');
  });

  it('never has more than one accepted offer per request', () => {
    for (const request of db().requests.all()) {
      const accepted = db().offers.filter((offer) => offer.requestId === request.id && offer.status === 'accepted');
      expect(accepted.length).toBeLessThanOrEqual(1);
      expect(accepted[0]?.id ?? null).toBe(request.acceptedOfferId);
    }
  });

  it('keeps counters, statuses and stats consistent with the source rows', () => {
    for (const request of db().requests.all()) {
      const stats = computeRequestOfferStats(db().offers.filter((offer) => offer.requestId === request.id));
      expect({ offerCount: request.offerCount, pendingOfferCount: request.pendingOfferCount }).toEqual({
        offerCount: stats.offerCount,
        pendingOfferCount: stats.pendingOfferCount,
      });
      expect(requestStatusForPendingOffers(request.status, request.pendingOfferCount)).toBe(request.status);
    }
    for (const job of db().jobs.all()) {
      expect(db().requests.require(job.requestId, 'Request').status).toBe(requestStatusForJobStatus(job.status));
    }
    for (const professional of db().professionals.all()) {
      expect(professional.stats).toEqual(computeProfessionalStats(db(), professional.id));
    }
    for (const profile of db().customerProfiles.all()) {
      expect(profile.stats).toEqual(computeCustomerStats(db(), profile.userId));
    }
  });

  it('only contains offers that respected the time rules when they were made', () => {
    for (const offer of db().offers.all()) {
      const request = db().requests.require(offer.requestId, 'Request');
      const result = validateOfferAgainstRequest({ proposedStartAt: offer.proposedStartAt, request, now: offer.createdAt });
      expect({ offer: offer.id, errors: result.errors.map((issue) => issue.code) }).toEqual({ offer: offer.id, errors: [] });
    }
  });

  it('has nothing overdue at seed time', () => {
    const changed = env.server.internals.run((ctx) => runScheduledTasks(ctx));
    expect(changed).toBe(false);
  });

  it('is deterministic for the same clock', async () => {
    const other = await createTestEnvironment({ now: TEST_NOW });
    expect(other.server.internals.db.exportTables()).toEqual(db().exportTables());
  });

  it('seeds the main accounts with their role profiles and no demo metadata', () => {
    for (const userId of Object.values(MAIN_CUSTOMER_IDS)) {
      expect(db().users.require(userId, 'User').role).toBe('customer');
      expect(db().customerProfiles.require(userId, 'Customer profile').defaultLocation?.city).toBeTruthy();
    }
    for (const professionalId of Object.values(MAIN_PRO_IDS)) {
      expect(db().users.require(professionalId, 'User').role).toBe('professional');
      expect(db().professionals.require(professionalId, 'Professional').serviceArea.label).not.toBe('');
    }
    for (const user of db().users.all()) {
      expect(Object.keys(user).filter((key) => /demo/i.test(key))).toEqual([]);
    }
    // Nobody is signed in at seed time.
    expect(db().sessions.size).toBe(0);
    expect(db().devices.size).toBe(0);
  });

  it('gives every main professional at least 3 matching open requests', async () => {
    for (const professionalId of Object.values(MAIN_PRO_IDS)) {
      const page = await env.as(professionalId).requests.getNearbyOpenRequests();
      expect({ professionalId, count: page.totalCount >= 3 }).toEqual({ professionalId, count: true });
      for (const request of page.items) {
        expect(request.isMatch).toBe(true);
        expect(request.location.isApproximate).toBe(true);
      }
    }
  });

  it('gives every main account read and unread notifications', async () => {
    for (const userId of [...Object.values(MAIN_CUSTOMER_IDS), ...Object.values(MAIN_PRO_IDS)]) {
      const own = db().notifications.filter((notification) => notification.userId === userId);
      expect({ userId, unread: own.some((n) => n.readAt === null), read: own.some((n) => n.readAt !== null) }).toEqual({
        userId,
        unread: true,
        read: true,
      });
    }
  });

  it('seeds Noa’s and Daniel’s scenarios', () => {
    const status = (id: string) => db().requests.require(id, 'Request').status;
    const R = SEED_IDS.requests;
    expect(status(R.noaDraft)).toBe('draft');
    expect(status(R.noaAc)).toBe('open');
    expect(db().requests.require(R.noaAc, 'Request').offerCount).toBe(0);
    expect(status(R.noaLeak)).toBe('offers_received');
    const leakOffers = db().offers.filter((offer) => offer.requestId === R.noaLeak);
    expect(leakOffers.filter((offer) => offer.status === 'pending')).toHaveLength(3);
    expect(new Set(leakOffers.map((offer) => offer.price)).size).toBe(3);
    expect(leakOffers.some((offer) => offer.professionalId === MAIN_PRO_IDS.avi)).toBe(true);
    expect(status(R.noaLighting)).toBe('professional_selected');
    expect(db().messages.count((message) => message.conversationId === SEED_IDS.conversations.noaLighting)).toBeGreaterThan(2);
    expect(status(R.noaWardrobe)).toBe('completed');
    expect(db().jobs.require(SEED_IDS.jobs.noaWardrobe, 'Job').reviewId).not.toBeNull();
    expect(status(R.noaDishwasher)).toBe('completed');
    expect(db().jobs.require(SEED_IDS.jobs.noaDishwasher, 'Job').reviewId).toBeNull();
    expect(status(R.noaKidsRoom)).toBe('cancelled');
    expect(status(R.danielMoving)).toBe('offers_received');
    expect(db().offers.find((offer) => offer.requestId === R.danielMoving && offer.professionalId === MAIN_PRO_IDS.rami)).toBeDefined();
    expect(status(R.danielWifi)).toBe('in_progress');
    expect(status(R.danielPainting)).toBe('open');
  });
});

describe.each([
  ['Friday late night', new Date(2026, 9, 2, 23, 50)],
  ['Saturday just after midnight', new Date(2026, 9, 3, 0, 20)],
  ['Thursday evening', new Date(2026, 9, 1, 19, 40)],
  ['Monday noon', new Date(2026, 8, 28, 12, 5)],
])('seed data at %s', (_label, now) => {
  it('is internally consistent and has nothing overdue', async () => {
    const env = await createTestEnvironment({ now });
    const db = env.server.internals.db;
    for (const offer of db.offers.all()) {
      const request = db.requests.require(offer.requestId, 'Request');
      expect(validateOfferAgainstRequest({ proposedStartAt: offer.proposedStartAt, request, now: offer.createdAt }).errors).toEqual([]);
      if (offer.status === 'pending') {
        expect(Date.parse(offer.expiresAt)).toBeGreaterThan(now.getTime());
        expect(Date.parse(offer.proposedStartAt)).toBeGreaterThan(now.getTime());
      }
      expect(Date.parse(offer.createdAt)).toBeLessThanOrEqual(now.getTime());
    }
    for (const request of db.requests.all()) expect(Date.parse(request.createdAt)).toBeLessThanOrEqual(now.getTime());
    for (const message of db.messages.all()) expect(Date.parse(message.createdAt)).toBeLessThanOrEqual(now.getTime());
    for (const review of db.reviews.all()) expect(Date.parse(review.createdAt)).toBeLessThanOrEqual(now.getTime());
    expect(env.server.internals.run((ctx) => runScheduledTasks(ctx))).toBe(false);
    for (const professionalId of Object.values(MAIN_PRO_IDS)) {
      expect((await env.as(professionalId).requests.getNearbyOpenRequests()).totalCount).toBeGreaterThanOrEqual(3);
    }
  });
});
