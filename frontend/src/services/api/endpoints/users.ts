import type { CurrentUserResponse, RegisterDeviceRequest, SuccessResponse, UpdateMeRequest } from '@/types/api';
import type { ApiClient } from '../client';

export function createUsersApi(client: ApiClient) {
  return {
    /** `GET /me` */
    getCurrentUser: () => client.get<CurrentUserResponse>('/me'),
    /** `PATCH /me` – the account's language (push notifications and emails). */
    updateMe: (payload: UpdateMeRequest) => client.patch<CurrentUserResponse>('/me', payload),
    /** `POST /me/devices` – registers this device's Expo push token for the session. */
    registerDevice: (payload: RegisterDeviceRequest) => client.post<SuccessResponse>('/me/devices', payload),
    /** `DELETE /me/devices/:token` – stops push to this device (idempotent). */
    unregisterDevice: (pushToken: string) => client.delete<SuccessResponse>(`/me/devices/${encodeURIComponent(pushToken)}`),
  };
}
