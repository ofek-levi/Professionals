/**
 * The Cloudinary adapter against a local stub of its API (`uploadPrefix`, as in development with
 * `CLOUDINARY_UPLOAD_PREFIX`): which calls the real SDK makes.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CloudinaryStorage } from '../storage/cloudinary-storage.js';

interface StubCall {
  method: string | undefined;
  path: string | undefined;
  params: Map<string, string>;
}

/** The text fields of the SDK's multipart body. */
function formFields(body: string): Map<string, string> {
  return new Map([...body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)].map((match) => [match[1] ?? '', match[2] ?? '']));
}

describe('CloudinaryStorage.destroy', () => {
  const calls: StubCall[] = [];
  let server: http.Server;
  let storage: CloudinaryStorage;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
      req.on('end', () => {
        const params = formFields(body);
        calls.push({ method: req.method, path: req.url, params });
        const publicId = params.get('public_id') ?? '';
        const status = publicId.endsWith('/broken') ? 500 : 200;
        const reply = status === 500 ? { error: { message: 'Internal error' } } : { result: publicId.endsWith('/gone') ? 'not found' : 'ok' };
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(reply));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    storage = new CloudinaryStorage({ cloudName: 'demo', apiKey: 'key', apiSecret: 'secret', uploadPrefix: `http://127.0.0.1:${port}` }, 'professionals/test');
  });
  beforeEach(() => {
    calls.length = 0;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('deletes each image through the Upload API and purges it from the CDN', async () => {
    await storage.destroy(['professionals/test/requests/a', 'professionals/test/requests/gone']);
    expect(calls.map((call) => [call.method, call.path])).toEqual([
      ['POST', '/v1_1/demo/image/destroy'],
      ['POST', '/v1_1/demo/image/destroy'],
    ]);
    expect(calls.map((call) => call.params.get('public_id')).sort()).toEqual(['professionals/test/requests/a', 'professionals/test/requests/gone']);
    for (const call of calls) {
      expect(call.params.get('invalidate')).toBe('true');
      expect(call.params.get('signature')).toEqual(expect.any(String));
    }
  });

  it('rejects with the ids it could not delete (the others are deleted)', async () => {
    await expect(storage.destroy(['professionals/test/requests/b', 'professionals/test/requests/broken'])).rejects.toThrow(
      'Cloudinary could not delete professionals/test/requests/broken',
    );
    expect(calls).toHaveLength(2);
  });
});
