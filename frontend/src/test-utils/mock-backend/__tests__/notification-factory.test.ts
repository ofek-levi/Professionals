import { NOTIFICATION_TYPES, type NotificationType } from '@/constants/notification-types';
import type { Job, Offer, Review, ServiceRequest } from '@/types/domain';

import { buildNotification, type NotificationInput } from '../server/notification-factory';

const NOW = '2026-09-27T07:00:00.000Z';
const request: Pick<ServiceRequest, 'id' | 'categoryId'> = { id: 'req_1', categoryId: 'plumbing' };
const offer: Pick<Offer, 'id' | 'requestId' | 'price' | 'currency' | 'proposedStartAt'> = {
  id: 'off_1',
  requestId: 'req_1',
  price: 450,
  currency: 'ILS',
  proposedStartAt: '2026-09-28T09:00:00.000Z',
};
const job: Pick<Job, 'id' | 'categoryId' | 'scheduledStartAt' | 'agreedPrice' | 'currency'> = {
  id: 'job_1',
  categoryId: 'plumbing',
  scheduledStartAt: '2026-09-28T09:00:00.000Z',
  agreedPrice: 450,
  currency: 'ILS',
};
const review: Pick<Review, 'id' | 'professionalId' | 'rating' | 'categoryId' | 'customerDisplayName'> = {
  id: 'rev_1',
  professionalId: 'pro_1',
  rating: 5,
  categoryId: 'plumbing',
  customerDisplayName: 'Noa L.',
};

const INPUTS: Record<NotificationType, NotificationInput> = {
  new_matching_request: { type: 'new_matching_request', request, customerName: 'Noa L.', distanceKm: 2.4 },
  offer_received: { type: 'offer_received', offer, categoryId: 'plumbing', professionalName: 'AquaFix Plumbing' },
  offer_updated: { type: 'offer_updated', offer, categoryId: 'plumbing', professionalName: 'AquaFix Plumbing' },
  offer_withdrawn: { type: 'offer_withdrawn', offer, categoryId: 'plumbing', professionalName: 'AquaFix Plumbing' },
  offer_accepted: { type: 'offer_accepted', offer, job, customerName: 'Noa L.' },
  offer_not_selected: { type: 'offer_not_selected', offer, categoryId: 'plumbing', customerName: 'Noa L.' },
  offer_expired: { type: 'offer_expired', offer, categoryId: 'plumbing' },
  request_cancelled: { type: 'request_cancelled', request, customerName: 'Noa L.' },
  job_confirmed: { type: 'job_confirmed', job, professionalName: 'AquaFix Plumbing' },
  job_started: { type: 'job_started', job, professionalName: 'AquaFix Plumbing' },
  appointment_reminder: { type: 'appointment_reminder', job, recipientRole: 'customer', counterpartName: 'AquaFix Plumbing' },
  job_completed: { type: 'job_completed', job, recipientRole: 'professional', counterpartName: 'Noa L.' },
  review_received: { type: 'review_received', review },
  new_message: {
    type: 'new_message',
    conversationId: 'cnv_1',
    categoryId: 'plumbing',
    senderRole: 'professional',
    senderName: 'AquaFix Plumbing',
    messageText: '  See you\n\n\n tomorrow at 9!  ',
  },
};

const build = (type: NotificationType) => buildNotification(INPUTS[type], { id: `ntf_${type}`, userId: 'user_1', now: NOW });

describe('notification factory', () => {
  it('builds every notification type deterministically', () => {
    for (const type of NOTIFICATION_TYPES) {
      const notification = build(type);
      expect(notification).toMatchObject({ id: `ntf_${type}`, userId: 'user_1', type, readAt: null, createdAt: NOW });
      expect(build(type)).toEqual(notification);
      expect(notification.params.categoryId).toBe('plumbing');
      // No undefined values leak into the payload.
      expect(Object.values(notification.params)).not.toContain(undefined);
    }
  });

  it('targets the right screen for each type', () => {
    expect(build('new_matching_request').target).toEqual({ kind: 'request', requestId: 'req_1' });
    for (const type of ['offer_received', 'offer_updated', 'offer_withdrawn', 'offer_not_selected', 'offer_expired'] as const) {
      expect(build(type).target).toEqual({ kind: 'offer', offerId: 'off_1', requestId: 'req_1' });
    }
    for (const type of ['offer_accepted', 'job_confirmed', 'job_started', 'appointment_reminder', 'job_completed'] as const) {
      expect(build(type).target).toEqual({ kind: 'job', jobId: 'job_1' });
    }
    expect(build('request_cancelled').target).toEqual({ kind: 'request', requestId: 'req_1' });
    expect(build('review_received').target).toEqual({ kind: 'professional', professionalId: 'pro_1' });
    expect(build('new_message').target).toEqual({ kind: 'conversation', conversationId: 'cnv_1' });
  });

  it('provides the params needed to render each message', () => {
    expect(build('offer_received').params).toEqual({
      categoryId: 'plumbing',
      professionalName: 'AquaFix Plumbing',
      price: 450,
      currency: 'ILS',
      scheduledAt: '2026-09-28T09:00:00.000Z',
    });
    expect(build('offer_accepted').params).toMatchObject({ customerName: 'Noa L.', price: 450, scheduledAt: job.scheduledStartAt });
    expect(build('new_matching_request').params).toMatchObject({ customerName: 'Noa L.', distanceKm: 2.4 });
    expect(build('review_received').params).toMatchObject({ customerName: 'Noa L.', rating: 5 });
    expect(build('appointment_reminder').params).toMatchObject({ professionalName: 'AquaFix Plumbing', scheduledAt: job.scheduledStartAt });
    expect(build('job_completed').params).toMatchObject({ customerName: 'Noa L.', price: 450 });
    expect(build('new_message').params).toMatchObject({
      professionalName: 'AquaFix Plumbing',
      messagePreview: 'See you tomorrow at 9!',
    });
  });

  it('can create already-read notifications (seed data)', () => {
    const read = buildNotification(INPUTS.offer_expired, { id: 'n', userId: 'u', now: NOW, readAt: NOW });
    expect(read.readAt).toBe(NOW);
  });
});
