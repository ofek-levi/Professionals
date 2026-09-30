/**
 * Mutations that send images with their owner, against the real endpoint modules and the backend
 * test double: a request posted with its photos (one multipart body, idempotent retry) and the
 * avatar (`PUT` / `DELETE /me/avatar`) updating `/me` and the own profile.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useRemoveAvatar, useSetAvatar } from '@/hooks/mutations/use-avatar-mutations';
import { useCreateRequest } from '@/hooks/mutations/use-request-mutations';
import { queryKeys } from '@/hooks/queries/query-keys';
import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { useCustomerProfile } from '@/hooks/queries/use-customer-queries';
import { useOwnProfessionalProfile } from '@/hooks/queries/use-professional-queries';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import { MAIN_CUSTOMER_IDS, PRO_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';
import type { CreateServiceRequestPayload, LocalImage, RequestDetailsResponse } from '@/types/api';

const NOA = MAIN_CUSTOMER_IDS.noa;
let env: TestEnvironment;

beforeAll(() => {
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
});

afterEach(async () => {
  await sessionStore.signOut();
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

const photo = (name: string, mimeType = 'image/jpeg'): LocalImage => ({ uri: `file:///photos/${name}`, mimeType, fileName: name });

const payload: CreateServiceRequestPayload = {
  categoryId: 'plumbing',
  description: 'The kitchen sink is leaking under the cabinet.',
  location: { coordinates: { latitude: 32.0565, longitude: 34.7702 }, addressLine: 'Vital St 5', city: 'Tel Aviv-Yafo', neighborhood: null, details: null },
  urgency: 'normal',
  preferredSchedule: null,
  notes: null,
  publish: true,
  clientRequestId: 'creq_hooks_1',
};

describe('useCreateRequest', () => {
  it('posts the fields and the photos in one multipart request; a retry answers the same request', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    const { client, wrapper } = createWrapper();
    const { result } = await renderHook(() => useCreateRequest(), { wrapper });
    const posts = () => env.log.to('/requests', 'POST');
    const before = posts().length;

    const created = await act(() => result.current.mutateAsync({ payload, photos: [photo('leak.jpg'), photo('pipe.png', 'image/png')] }));
    expect(created.photos).toHaveLength(2);
    const parts = (posts()[before].body as FormData & { getParts(): { fieldName: string; string?: string }[] }).getParts();
    expect(parts.map((part) => part.fieldName)).toEqual(['data', 'photos', 'photos']);
    expect(JSON.parse(parts[0].string ?? '')).toEqual(payload);
    // The detail cache is seeded with the server's answer.
    expect(client.getQueryData<RequestDetailsResponse>(queryKeys.requests.detail(NOA, created.id))).toMatchObject({ request: { photos: created.photos } });

    // The response was lost: the same form is posted again and gets the first request, photos included.
    const retry = await act(() => result.current.mutateAsync({ payload, photos: [photo('leak.jpg'), photo('pipe.png', 'image/png')] }));
    expect(retry).toMatchObject({ id: created.id, photos: created.photos });
  });
});

describe('avatar mutations', () => {
  it('set, replace and remove update /me and the customer profile at once', async () => {
    await sessionStore.signIn(env.signIn(NOA));
    const { wrapper } = createWrapper();
    const { result } = await renderHook(
      () => ({ me: useCurrentUser(), profile: useCustomerProfile(), set: useSetAvatar(), remove: useRemoveAvatar() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.profile.isSuccess && result.current.me.isSuccess).toBe(true));

    const first = await act(() => result.current.set.mutateAsync(photo('me.jpg')));
    expect(result.current.me.data?.user.avatarUrl).toBe(first.user.avatarUrl);
    expect(result.current.profile.data?.user.avatarUrl).toBe(first.user.avatarUrl);

    const second = await act(() => result.current.set.mutateAsync(photo('me.png', 'image/png')));
    expect(second.user.avatarUrl).not.toBe(first.user.avatarUrl);
    expect(result.current.profile.data?.user.avatarUrl).toBe(second.user.avatarUrl);

    await act(() => result.current.remove.mutateAsync());
    expect(result.current.me.data?.user.avatarUrl).toBeNull();
    expect(result.current.profile.data?.user.avatarUrl).toBeNull();
    expect(env.log.to('/me/avatar').map((entry) => entry.method)).toEqual(['PUT', 'PUT', 'DELETE']);
  });

  it('updates a professional’s own profile', async () => {
    await sessionStore.signIn(env.signIn(PRO_IDS.avi));
    const { wrapper } = createWrapper();
    const { result } = await renderHook(() => ({ own: useOwnProfessionalProfile(), set: useSetAvatar() }), { wrapper });
    await waitFor(() => expect(result.current.own.isSuccess).toBe(true));
    const me = await act(() => result.current.set.mutateAsync(photo('avi.jpg')));
    expect(result.current.own.data?.avatarUrl).toBe(me.user.avatarUrl);
  });
});
