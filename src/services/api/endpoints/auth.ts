import type { AuthSession, CurrentUserResponse, DemoLoginRequest, RegisterDeviceRequest, SuccessResponse } from '@/types/api';
import type { DemoAccount } from '@/types/domain';
import type { ApiClient } from '../client';

export function createAuthApi(client: ApiClient) {
  return {
    /** `GET /auth/demo-accounts` – demo-only replacement for a real sign-up/sign-in flow. */
    getDemoAccounts: () => client.get<DemoAccount[]>('/auth/demo-accounts'),
    /** `POST /auth/demo-login` */
    demoLogin: (payload: DemoLoginRequest) => client.post<AuthSession>('/auth/demo-login', payload),
    /** `POST /auth/logout` */
    logout: () => client.post<SuccessResponse>('/auth/logout'),
    /** `GET /me` */
    getCurrentUser: () => client.get<CurrentUserResponse>('/me'),
    /** `POST /me/devices` – register a push token (simulated for now). */
    registerDevice: (payload: RegisterDeviceRequest) => client.post<SuccessResponse>('/me/devices', payload),
  };
}
