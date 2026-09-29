import {
  createChannelId,
  isChannelId,
  MAX_PAGE_MESSAGE_LENGTH,
  parsePageMessage,
  serializeHostMessage,
  toSafeJson,
} from '../map-protocol';

const CHANNEL = 'abcdefghijklmnop1234';
const BOOT = 'abcdefgh12345678';
const raw = (message: Record<string, unknown>, channel: unknown = CHANNEL) => JSON.stringify({ ...message, channel });

describe('parsePageMessage', () => {
  it('accepts well-formed messages on the channel', () => {
    expect(parsePageMessage(raw({ type: 'ready', boot: BOOT }), CHANNEL)).toEqual({ type: 'ready', boot: BOOT });
    expect(parsePageMessage(raw({ type: 'markerPress', id: 'req-1' }), CHANNEL)).toEqual({ type: 'markerPress', id: 'req-1' });
    expect(parsePageMessage(raw({ type: 'mapPress', coordinate: { latitude: 32.1, longitude: 34.8 } }), CHANNEL)).toEqual({
      type: 'mapPress',
      coordinate: { latitude: 32.1, longitude: 34.8 },
    });
    expect(parsePageMessage(raw({ type: 'pinDragEnd', coordinate: { latitude: -1, longitude: 179.5 } }), CHANNEL)).toEqual({
      type: 'pinDragEnd',
      coordinate: { latitude: -1, longitude: 179.5 },
    });
    expect(
      parsePageMessage(
        raw({
          type: 'regionChange',
          bounds: [
            [32, 34.7],
            [32.2, 34.9],
          ],
        }),
        CHANNEL,
      ),
    ).toEqual({
      type: 'regionChange',
      bounds: [
        [32, 34.7],
        [32.2, 34.9],
      ],
    });
    expect(parsePageMessage(raw({ type: 'error', message: 'boom', fatal: true }), CHANNEL)).toEqual({ type: 'error', message: 'boom', fatal: true });
    expect(parsePageMessage(raw({ type: 'error', message: 'x'.repeat(900) }), CHANNEL)).toEqual({
      type: 'error',
      message: 'x'.repeat(500),
      fatal: false,
    });
  });

  it('accepts credit links and tile requests of the right shape only', () => {
    expect(parsePageMessage(raw({ type: 'openLink', href: 'https://www.openstreetmap.org/copyright' }), CHANNEL)).toEqual({
      type: 'openLink',
      href: 'https://www.openstreetmap.org/copyright',
    });
    for (const href of ['http://example.com', 'tel:123', 'intent://x#Intent;end', 'javascript:alert(1)', 'https://a b', `https://x/${'a'.repeat(2100)}`]) {
      expect(parsePageMessage(raw({ type: 'openLink', href }), CHANNEL)).toBeNull();
    }

    expect(parsePageMessage(raw({ type: 'tileRequest', id: '12', z: 12, x: 2446, y: 1662 }), CHANNEL)).toEqual({
      type: 'tileRequest',
      id: '12',
      z: 12,
      x: 2446,
      y: 1662,
    });
    expect(parsePageMessage(raw({ type: 'tileCancel', id: '12' }), CHANNEL)).toEqual({ type: 'tileCancel', id: '12' });
    for (const tile of [
      { z: 2, x: 4, y: 0 }, // outside the world at zoom 2
      { z: 2, x: -1, y: 0 },
      { z: 1.5, x: 0, y: 0 },
      { z: 30, x: 0, y: 0 },
      { z: 2, x: '1', y: 0 },
    ]) {
      expect(parsePageMessage(raw({ type: 'tileRequest', id: '1', ...tile }), CHANNEL)).toBeNull();
    }
    expect(parsePageMessage(raw({ type: 'tileRequest', id: '../x', z: 1, x: 0, y: 0 }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'tileCancel', id: '' }), CHANNEL)).toBeNull();
  });

  it('needs a boot id on ready', () => {
    expect(parsePageMessage(raw({ type: 'ready' }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'ready', boot: 'short' }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'ready', boot: '<script>123456' }), CHANNEL)).toBeNull();
  });

  it('keeps only the known fields', () => {
    expect(parsePageMessage(raw({ type: 'markerPress', id: 'a', extra: '<script>' }), CHANNEL)).toEqual({ type: 'markerPress', id: 'a' });
  });

  it('rejects foreign channels and non-string payloads', () => {
    expect(parsePageMessage(raw({ type: 'ready', boot: BOOT }, 'zzzzzzzzzzzzzzzzzzzz'), CHANNEL)).toBeNull();
    expect(parsePageMessage(JSON.stringify({ type: 'ready', boot: BOOT }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'ready', boot: BOOT }, null), CHANNEL)).toBeNull();
    expect(parsePageMessage({ type: 'ready', boot: BOOT, channel: CHANNEL }, CHANNEL)).toBeNull();
    // The expected channel itself must be a real channel id.
    expect(parsePageMessage(raw({ type: 'ready', boot: BOOT }, ''), '')).toBeNull();
  });

  it('rejects malformed, unknown and oversized messages', () => {
    expect(parsePageMessage('not json', CHANNEL)).toBeNull();
    expect(parsePageMessage('', CHANNEL)).toBeNull();
    expect(parsePageMessage('[1,2]', CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'navigate', url: 'https://example.com' }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'markerPress' }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'markerPress', id: '' }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'markerPress', id: 'x'.repeat(300) }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'mapPress', coordinate: { latitude: 32 } }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'mapPress', coordinate: { latitude: 95, longitude: 34 } }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'mapPress', coordinate: { latitude: '32', longitude: 34 } }), CHANNEL)).toBeNull();
    expect(parsePageMessage(raw({ type: 'regionChange', bounds: [[32, 34]] }), CHANNEL)).toBeNull();
    expect(
      parsePageMessage(
        raw({
          type: 'regionChange',
          bounds: [
            [33, 34],
            [32, 35],
          ],
        }),
        CHANNEL,
      ),
    ).toBeNull();
    expect(parsePageMessage(raw({ type: 'error' }), CHANNEL)).toBeNull();
    const huge = raw({ type: 'markerPress', id: 'a', padding: 'x'.repeat(MAX_PAGE_MESSAGE_LENGTH) });
    expect(parsePageMessage(huge, CHANNEL)).toBeNull();
  });

  it('rejects non-finite numbers', () => {
    // JSON cannot carry NaN/Infinity, but a page could send huge exponents that parse to Infinity.
    expect(parsePageMessage(`{"channel":"${CHANNEL}","type":"mapPress","coordinate":{"latitude":1e999,"longitude":34}}`, CHANNEL)).toBeNull();
    expect(
      parsePageMessage(`{"channel":"${CHANNEL}","type":"regionChange","bounds":[[32,-1e999],[33,35]]}`, CHANNEL),
    ).toBeNull();
    expect(parsePageMessage(raw({ type: 'mapPress', coordinate: { latitude: null, longitude: 34 } }), CHANNEL)).toBeNull();
  });
});

describe('host messages', () => {
  it('creates distinct, valid channel ids', () => {
    const ids = new Set(Array.from({ length: 50 }, createChannelId));
    expect(ids.size).toBe(50);
    ids.forEach((id) => expect(isChannelId(id)).toBe(true));
  });

  it('serializes with the channel and escapes HTML and JS line terminators', () => {
    const json = serializeHostMessage(CHANNEL, {
      type: 'state',
      state: { accessibilityLabel: '</script><script>alert(1)</script> & \u2028\u2029' } as never,
    });
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(json)).toEqual({
      type: 'state',
      channel: CHANNEL,
      state: { accessibilityLabel: '</script><script>alert(1)</script> & \u2028\u2029' },
    });
    expect(toSafeJson('a<b')).toBe('"a\\u003cb"');
  });
});
