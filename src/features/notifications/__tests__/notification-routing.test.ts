import { routes } from '@/lib/routes';

import { getNotificationHref, notificationTargetToHref } from '../notification-routing';

describe('notificationTargetToHref', () => {
  it('maps every target kind to its route', () => {
    expect(notificationTargetToHref({ kind: 'request', requestId: 'req 1' })).toBe(routes.request('req 1'));
    expect(notificationTargetToHref({ kind: 'offer', offerId: 'off_1', requestId: 'req_1' })).toBe('/offers/off_1');
    expect(notificationTargetToHref({ kind: 'job', jobId: 'job_1' })).toBe('/jobs/job_1');
    expect(notificationTargetToHref({ kind: 'conversation', conversationId: 'conv_1' })).toBe('/conversations/conv_1');
    expect(notificationTargetToHref({ kind: 'professional', professionalId: 'pro_1' })).toBe('/professionals/pro_1');
    expect(notificationTargetToHref({ kind: 'none' })).toBeNull();
  });

  it('encodes ids in URLs', () => {
    expect(notificationTargetToHref({ kind: 'request', requestId: 'a/b' })).toBe('/requests/a%2Fb');
  });
});

describe('getNotificationHref', () => {
  it('opens the reviews list for a new review', () => {
    expect(getNotificationHref({ type: 'review_received', target: { kind: 'professional', professionalId: 'pro_1' } })).toBe(
      '/professionals/pro_1/reviews',
    );
  });

  it('falls back to the target route for other types', () => {
    expect(getNotificationHref({ type: 'offer_received', target: { kind: 'offer', offerId: 'off_1', requestId: 'r' } })).toBe(
      '/offers/off_1',
    );
    expect(getNotificationHref({ type: 'new_message', target: { kind: 'none' } })).toBeNull();
  });
});
