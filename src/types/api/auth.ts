import type { CustomerProfile, OwnProfessionalProfile, User } from '../domain';

export interface DemoLoginRequest {
  userId: string;
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

/** `GET /me` – the authenticated user and their role-specific profile. */
export type CurrentUserResponse =
  | { user: User & { role: 'customer' }; customerProfile: CustomerProfile; professionalProfile: null }
  | { user: User & { role: 'professional' }; customerProfile: null; professionalProfile: OwnProfessionalProfile };

/** Registers a device for (future) push notifications. */
export interface RegisterDeviceRequest {
  pushToken: string;
  platform: 'ios' | 'android' | 'web';
}
