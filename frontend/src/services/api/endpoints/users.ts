import { MULTIPART_FIELDS } from '@/types/api';
import type {
  AccountDeletionImpact,
  CurrentUserResponse,
  DeleteAccountRequest,
  LocalImage,
  RegisterDeviceRequest,
  SuccessResponse,
  UpdateMeRequest,
} from '@/types/api';
import type { ApiClient } from '../client';
import { buildImageForm, imageTimeoutMs } from '../image-form';

export function createUsersApi(client: ApiClient) {
  return {
    /** `GET /me` */
    getCurrentUser: () => client.get<CurrentUserResponse>('/me'),
    /** `PATCH /me` – the account's language (push notifications and emails). */
    updateMe: (payload: UpdateMeRequest) => client.patch<CurrentUserResponse>('/me', payload),
    /** `PUT /me/avatar` (multipart `avatar`) – sets or replaces the profile photo; errors as `createRequest`'s photos. */
    setAvatar: async (image: LocalImage) =>
      client.put<CurrentUserResponse>('/me/avatar', await buildImageForm({ field: MULTIPART_FIELDS.avatar, images: [image] }), { timeoutMs: imageTimeoutMs(1) }),
    /** `DELETE /me/avatar` – removes the profile photo (idempotent). */
    removeAvatar: () => client.delete<CurrentUserResponse>('/me/avatar'),
    /** `POST /me/devices` – registers this device's Expo push token for the session. */
    registerDevice: (payload: RegisterDeviceRequest) => client.post<SuccessResponse>('/me/devices', payload),
    /** `DELETE /me/devices/:token` – stops push to this device (idempotent). */
    unregisterDevice: (pushToken: string) => client.delete<SuccessResponse>(`/me/devices/${encodeURIComponent(pushToken)}`),
    /** `GET /me/deletion-impact` – what deleting the account would cancel, and how to confirm it. */
    getDeletionImpact: (signal?: AbortSignal) => client.get<AccountDeletionImpact>('/me/deletion-impact', { signal }),
    /** `POST /me/deletion` – deletes the account at once; refusals are 400 (never 401), see `DeleteAccountRequest`. */
    deleteAccount: (payload: DeleteAccountRequest) => client.post<SuccessResponse>('/me/deletion', payload),
  };
}
