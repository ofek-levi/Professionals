/**
 * Posting the request form against the backend test double: a draft saved with a new photo whose
 * publish fails is posted again without sending the photo again, and a failure is blamed on the
 * photos only when the API names them (or a proxy refuses the body while they are being sent).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { requestToFormValues, type RequestFormPhoto, type RequestFormValues } from '@/lib/validation';
import { apiClient } from '@/services/api';
import type { TransportRequest, TransportResponse } from '@/services/api/transport';
import { sessionStore } from '@/services/auth/session-store';
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';
import type { CreateServiceRequestPayload } from '@/types/api';
import type { CustomerRequestView } from '@/types/domain';

import { useSubmitRequest, type SubmitOutcome } from '../use-submit-request';

const NOA = MAIN_CUSTOMER_IDS.noa;
let env: TestEnvironment;
/** Answers instead of the double for the requests it matches (once each). */
let overrides: { matches: (request: TransportRequest) => boolean; response: TransportResponse }[] = [];

beforeAll(() => {
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(async (request) => {
    const index = overrides.findIndex((override) => override.matches(request));
    if (index === -1) return env.transport(request);
    const [override] = overrides.splice(index, 1);
    return override.response;
  });
});

beforeEach(async () => {
  overrides = [];
  env.log.clear();
  await sessionStore.signIn(env.signIn(NOA));
});

afterEach(async () => {
  await sessionStore.signOut();
});

function wrapper({ children }: { children: ReactNode }) {
  // Infinite gcTime: no garbage-collection timers keep Jest alive after the tests.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const payload: CreateServiceRequestPayload = {
  categoryId: 'plumbing',
  description: 'The kitchen sink is leaking under the cabinet.',
  location: { coordinates: { latitude: 32.0565, longitude: 34.7702 }, addressLine: 'Vital St 5', city: 'Tel Aviv-Yafo', neighborhood: null, details: null },
  urgency: 'normal',
  preferredSchedule: null,
  notes: null,
  publish: false,
};

const newPhoto = (name: string): RequestFormPhoto => ({ uri: `file:///photos/${name}`, mimeType: 'image/jpeg', fileName: name, fileSize: 2048, publicId: null });

const failWith = (method: TransportRequest['method'], path: RegExp, status: number, data: unknown) => {
  overrides.push({ matches: (request) => request.method === method && path.test(request.path), response: { status, data } });
};

type Parts = { getParts(): { fieldName: string; string?: string }[] };

async function submitWith(draft: CustomerRequestView | null, values: RequestFormValues) {
  const { result } = await renderHook(() => useSubmitRequest(draft), { wrapper });
  const uploading: boolean[] = [];
  const saved: RequestFormPhoto[][] = [];
  const submit = async (formValues: RequestFormValues): Promise<SubmitOutcome> =>
    act(() => result.current(formValues, { onUploading: (value) => uploading.push(value), onPhotosSaved: (photos) => saved.push(photos) }));
  return { submit, uploading, saved };
}

describe('useSubmitRequest', () => {
  it('posts a draft again after a failed publish without sending its new photo again', async () => {
    const draft = await env.as(NOA).requests.createRequest(payload, []);
    const form = await submitWith(draft, { ...requestToFormValues(draft), photos: [newPhoto('leak.jpg')] });

    failWith('POST', /\/publish$/, 503, { code: 'SERVER_ERROR', message: 'Down' });
    const failed = await form.submit({ ...requestToFormValues(draft), photos: [newPhoto('leak.jpg')] });
    // The photo was saved with the draft: a failed publish is not about it.
    expect(failed).toMatchObject({ ok: false, photoFailure: false });
    expect(form.uploading).toEqual([true, false, false]);
    const [stored] = form.saved;
    expect(stored).toEqual([expect.objectContaining({ publicId: expect.stringMatching(/^test\/requests\//) })]);

    const posted = await form.submit({ ...requestToFormValues(draft), photos: stored });
    expect(posted).toMatchObject({ ok: true, request: { id: draft.id, status: 'open', photos: [expect.objectContaining({ publicId: stored[0].publicId })] } });
    const [first, second] = env.log.to(`/requests/${draft.id}`, 'PATCH').map((entry) => (entry.body as FormData & Parts).getParts());
    expect(first.map((part) => part.fieldName)).toEqual(['data', 'photos']);
    expect(second.map((part) => part.fieldName)).toEqual(['data']);
    expect(JSON.parse(second[0].string ?? '')).toMatchObject({ keepPhotos: [stored[0].publicId] });
  });

  it('blames the photos only for refusals that name them, or a proxy’s 413 while they are sent', async () => {
    const values = (): RequestFormValues => ({
      categoryId: 'plumbing',
      description: payload.description,
      location: payload.location,
      urgency: 'normal',
      preferredDate: null,
      preferredTimeWindow: 'any',
      notes: '',
      photos: [newPhoto('leak.jpg')],
    });
    const form = await submitWith(null, values());

    // The request limit (no field): not about the photos, the form shows the general message.
    failWith('POST', /^\/requests$/, 429, { code: 'RATE_LIMITED', message: 'Too many requests' });
    expect(await form.submit(values())).toMatchObject({ ok: false, error: { status: 429 }, photoFailure: false });
    failWith('POST', /^\/requests$/, 429, { code: 'RATE_LIMITED', message: 'Too many photos', fieldErrors: { photos: ['validation:upload.rateLimited'] } });
    expect(await form.submit(values())).toMatchObject({ ok: false, photoFailure: true });
    failWith('POST', /^\/requests$/, 413, '<html>413 Request Entity Too Large</html>');
    expect(await form.submit(values())).toMatchObject({ ok: false, photoFailure: true });
    await expect(form.submit(values())).resolves.toMatchObject({ ok: true, request: { status: 'open', photos: [expect.anything()] } });
  });
});
