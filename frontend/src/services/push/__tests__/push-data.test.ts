/** The `data` of a push notification (`{ notificationId, notificationType, target }`) is validated. */
import { parsePushTap } from '../push-data';

describe('push data', () => {
  it('reads every target kind', () => {
    const targets = [
      { kind: 'request', requestId: 'req_1' },
      { kind: 'offer', offerId: 'off_1', requestId: 'req_1' },
      { kind: 'job', jobId: 'job_1' },
      { kind: 'conversation', conversationId: 'cnv_1' },
      { kind: 'professional', professionalId: 'user_avi' },
      { kind: 'none' },
    ];
    for (const target of targets) {
      expect(parsePushTap({ notificationId: 'ntf_1', notificationType: 'offer_received', target })).toEqual({
        notificationId: 'ntf_1',
        notificationType: 'offer_received',
        target,
      });
    }
  });

  it('keeps the target when the id or type is missing or unknown', () => {
    expect(parsePushTap({ target: { kind: 'job', jobId: 'job_1' } })).toEqual({
      notificationId: null,
      notificationType: null,
      target: { kind: 'job', jobId: 'job_1' },
    });
    expect(parsePushTap({ notificationId: '', notificationType: 'party_invite', target: { kind: 'none' } })).toMatchObject({
      notificationId: null,
      notificationType: null,
    });
  });

  it('ignores anything without a valid target', () => {
    for (const data of [null, 'x', [], {}, { target: null }, { target: { kind: 'job' } }, { target: { kind: 'offer', offerId: 'o' } }, { target: { kind: 'spaceship', id: 1 } }]) {
      expect(parsePushTap(data)).toBeNull();
    }
    // Extra fields are dropped, never forwarded.
    expect(parsePushTap({ target: { kind: 'job', jobId: 'job_1', url: 'https://evil.example.com' } })?.target).toEqual({ kind: 'job', jobId: 'job_1' });
  });
});
