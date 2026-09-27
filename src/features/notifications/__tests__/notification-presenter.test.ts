import { NOTIFICATION_TYPE_META, NOTIFICATION_TYPES, type NotificationType } from '@/constants/notification-types';
import { i18n, initI18n } from '@/i18n';
import type { AppLanguage } from '@/types/domain';
import { isolateText, stripIsolates } from '@/utils/bidi';

import { buildNotification, type NotificationInput } from '../notification-factory';
import { getNotificationContent, type NotificationLookups } from '../notification-presenter';

const offer = { id: 'off_1', requestId: 'req_1', price: 450, currency: 'ILS' as const, proposedStartAt: '2026-09-30T07:00:00.000Z' };
const job = {
  id: 'job_1',
  categoryId: 'plumbing' as const,
  scheduledStartAt: '2026-09-30T07:00:00.000Z',
  agreedPrice: 450,
  currency: 'ILS' as const,
};

/** One realistic factory input per notification type. */
const INPUTS: Record<NotificationType, NotificationInput> = {
  new_matching_request: { type: 'new_matching_request', request: { id: 'req_1', categoryId: 'plumbing' }, distanceKm: 3.2 },
  offer_received: { type: 'offer_received', offer, categoryId: 'plumbing', professionalName: 'Yossi Mizrahi' },
  offer_updated: { type: 'offer_updated', offer, categoryId: 'plumbing', professionalName: 'Yossi Mizrahi' },
  offer_withdrawn: { type: 'offer_withdrawn', offer, categoryId: 'plumbing', professionalName: 'Yossi Mizrahi' },
  offer_accepted: { type: 'offer_accepted', offer, job, customerName: 'Noa Levi' },
  offer_not_selected: { type: 'offer_not_selected', offer, categoryId: 'plumbing' },
  offer_expired: { type: 'offer_expired', offer, categoryId: 'plumbing' },
  request_cancelled: { type: 'request_cancelled', request: { id: 'req_1', categoryId: 'plumbing' }, customerName: 'Noa Levi' },
  job_confirmed: { type: 'job_confirmed', job, professionalName: 'Yossi Mizrahi' },
  job_started: { type: 'job_started', job, professionalName: 'Yossi Mizrahi' },
  appointment_reminder: { type: 'appointment_reminder', job, recipientRole: 'customer', counterpartName: 'Yossi Mizrahi' },
  job_completed: { type: 'job_completed', job, recipientRole: 'customer', counterpartName: 'Yossi Mizrahi' },
  review_received: {
    type: 'review_received',
    review: { id: 'rev_1', professionalId: 'pro_1', rating: 5, categoryId: 'plumbing', customerDisplayName: 'Noa Levi' },
  },
  new_message: {
    type: 'new_message',
    conversationId: 'conv_1',
    categoryId: 'plumbing',
    senderRole: 'professional',
    senderName: 'Yossi Mizrahi',
    messageText: 'I can come tomorrow at 10:00',
  },
};

const lookups: NotificationLookups = {
  categoryName: (id) => (id === 'plumbing' ? 'PLUMBING' : ''),
  formatPrice: (amount, currency) => `${currency}${amount}`,
  formatDateTime: () => 'WED 10:00',
  formatDistance: (km) => `${km}KM`,
};

function contentFor(type: NotificationType, language: AppLanguage) {
  const notification = buildNotification(INPUTS[type], { id: `ntf_${type}`, userId: 'u1', now: '2026-09-27T07:00:00.000Z' });
  return getNotificationContent(notification, i18n.getFixedT(language, 'notifications'), lookups);
}

beforeAll(async () => {
  await initI18n('en');
});

describe('getNotificationContent', () => {
  it.each(NOTIFICATION_TYPES.flatMap((type) => (['en', 'he'] as const).map((language) => [type, language] as const)))(
    'renders %s in %s without missing keys or placeholders',
    (type, language) => {
      const content = contentFor(type, language);
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.body.length).toBeGreaterThan(0);
      expect(`${content.title} ${content.body}`).not.toMatch(/\{\{|\}\}|types\./);
      expect(content.icon).toBe(NOTIFICATION_TYPE_META[type].icon);
      expect(content.tone).toBe(NOTIFICATION_TYPE_META[type].tone);
    },
  );

  it('interpolates names, category, price and date', () => {
    expect(contentFor('offer_received', 'en')).toMatchObject({
      title: 'New offer: ILS450',
      body: `${isolateText('Yossi Mizrahi')} sent an offer for your PLUMBING request.`,
    });
    expect(contentFor('offer_accepted', 'en').body).toContain('WED 10:00');
    expect(contentFor('new_matching_request', 'en').body).toContain('3.2KM');
    expect(contentFor('new_message', 'en')).toMatchObject({
      title: `New message from ${isolateText('Yossi Mizrahi')}`,
      body: 'I can come tomorrow at 10:00',
    });
  });

  it('isolates names so they keep their direction inside the other language', () => {
    const t = i18n.getFixedT('he', 'notifications');
    const message = { type: 'new_message' as const, params: { professionalName: 'BrightSpark Electric', conversationId: 'c1' } };
    const content = getNotificationContent(message, t, lookups);
    expect(content.title).toBe(`הודעה חדשה מאת ${isolateText('BrightSpark Electric')}`);
    // No Hebrew prefix letter glued to a Latin name.
    expect(stripIsolates(contentFor('offer_received', 'he').body)).toContain('מאת Yossi Mizrahi');
    expect(stripIsolates(contentFor('review_received', 'he').body)).toContain('מאת Noa Levi');
    // Fallback names are translated text, not user data, and stay as they are.
    expect(getNotificationContent({ type: 'job_started', params: {} }, i18n.getFixedT('en', 'notifications'), lookups).body).not.toMatch(
      /[\u2066-\u2069]/,
    );
  });

  it('uses the recipient-specific completion text', () => {
    expect(contentFor('job_completed', 'en').body).toContain('Leave a review');
    const professionalInput: NotificationInput = {
      type: 'job_completed',
      job,
      recipientRole: 'professional',
      counterpartName: 'Noa Levi',
    };
    const notification = buildNotification(professionalInput, { id: 'n', userId: 'u', now: '2026-09-27T07:00:00.000Z' });
    const content = getNotificationContent(notification, i18n.getFixedT('en', 'notifications'), lookups);
    expect(content.body).toBe(`The PLUMBING job for ${isolateText('Noa Levi')} is complete. Great work!`);
  });

  it('pluralizes review stars (including the Hebrew dual)', () => {
    const t = (language: AppLanguage) => i18n.getFixedT(language, 'notifications');
    const review = (rating: number) => ({ type: 'review_received' as const, params: { rating, customerName: 'Noa' } });
    expect(getNotificationContent(review(5), t('en'), lookups).title).toBe('New 5-star review');
    expect(getNotificationContent(review(2), t('he'), lookups).title).toBe('ביקורת חדשה: שני כוכבים');
    expect(getNotificationContent(review(1), t('he'), lookups).title).toBe('ביקורת חדשה: כוכב אחד');
  });

  it('falls back gracefully when optional params are missing', () => {
    const content = getNotificationContent(
      { type: 'new_matching_request', params: {} },
      i18n.getFixedT('en', 'notifications'),
      lookups,
    );
    expect(content.title).toBe('New service request nearby');
    expect(content.body).toContain('in your service area');
  });
});
