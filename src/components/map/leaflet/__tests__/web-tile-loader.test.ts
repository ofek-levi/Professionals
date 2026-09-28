import { createWebTileLoader } from '../web-tile-loader';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const TEMPLATE = 'https://{s}.tiles.example.com/{z}/{x}/{y}{r}.png';

const response = (bytes: Uint8Array, { type = 'image/png', ok = true } = {}) =>
  ({ ok, headers: { get: (name: string) => (name === 'content-type' ? type : null) }, arrayBuffer: async () => bytes.buffer }) as unknown as Response;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createWebTileLoader', () => {
  it('fetches the tile URL Leaflet would use and answers with a data URL', async () => {
    const fetchTile = jest.fn(async (_url: string, _init: RequestInit) => response(PNG, { type: 'image/png; charset=binary' }));
    const done = jest.fn();
    createWebTileLoader({ fetchTile, retina: true }).load(TEMPLATE, { z: 3, x: 2, y: 5 }, done);
    await flush();
    expect(fetchTile.mock.calls[0][0]).toBe('https://b.tiles.example.com/3/2/5@2x.png');
    expect(fetchTile.mock.calls[0][1]).toMatchObject({ mode: 'cors', credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
    expect(done).toHaveBeenCalledWith(`data:image/png;base64,${Buffer.from(PNG).toString('base64')}`);
  });

  it('answers null for failed, non-image or empty responses', async () => {
    const answers = [
      async () => response(PNG, { ok: false }),
      async () => response(new TextEncoder().encode('<html>blocked</html>'), { type: 'text/html' }),
      async () => response(new Uint8Array(0)),
      async () => {
        throw new TypeError('Failed to fetch'); // offline, or no CORS header
      },
    ];
    for (const answer of answers) {
      const done = jest.fn();
      createWebTileLoader({ fetchTile: answer, retina: false }).load(TEMPLATE, { z: 1, x: 0, y: 0 }, done);
      await flush();
      expect(done).toHaveBeenCalledWith(null);
    }
  });

  it('aborts a cancelled tile and never answers it', async () => {
    let signal: AbortSignal | null | undefined;
    const fetchTile = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init.signal;
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const done = jest.fn();
    const cancel = createWebTileLoader({ fetchTile, retina: false }).load(TEMPLATE, { z: 1, x: 0, y: 0 }, done);
    cancel();
    await flush();
    expect(signal?.aborted).toBe(true);
    expect(done).not.toHaveBeenCalled();
  });
});
