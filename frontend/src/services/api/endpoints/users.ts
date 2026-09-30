import { MULTIPART_FIELDS } from '@/types/api';
import type { CurrentUserResponse, LocalImage, RegisterDeviceRequest, SuccessResponse, UpdateMeRequest } from '@/types/api';
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
  };
}
