import type {
  AppLanguage,
  CategoryId,
  CustomerProfile,
  OwnProfessionalProfile,
  ServiceLocation,
  User,
  UserRole,
} from '../domain';

export interface DemoLoginRequest {
  userId: string;
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

/** `POST /auth/login` – email + password sign-in. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Professional-only part of `POST /auth/register`. */
export interface ProfessionalSignUpDetails {
  /** Optional; the professional's full name is shown when `null`. */
  businessName: string | null;
  categoryIds: CategoryId[];
  /** Base address; the service area is centered here. */
  baseLocation: Omit<ServiceLocation, 'isApproximate'>;
  serviceRadiusKm: number;
}

/**
 * `POST /auth/register` – creates the account, its role profile and signs in.
 * Exactly one of `password` and `googleIdToken` is set.
 */
export interface RegisterRequest {
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** `null` when signing up with Google. */
  password: string | null;
  /** Google `id_token` when signing up with Google (the backend verifies it). */
  googleIdToken: string | null;
  acceptedTerms: true;
  preferredLanguage: AppLanguage;
  /** Required iff `role === 'professional'`. */
  professional: ProfessionalSignUpDetails | null;
}

/** `POST /auth/google` – sign in (or start signing up) with a Google `id_token`. */
export interface GoogleAuthRequest {
  idToken: string;
}

/** Identity data taken from a verified Google id token. */
export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/**
 * - `signed_in`: an account with this Google identity (or its email) exists.
 * - `registration_required`: new identity – continue the sign-up flow with `profile` prefilled and
 *   send the same id token as `RegisterRequest.googleIdToken`.
 */
export type GoogleAuthResponse =
  | { status: 'signed_in'; session: AuthSession }
  | { status: 'registration_required'; profile: GoogleProfile };

/** `POST /auth/password-reset` – always succeeds (never reveals whether the email exists). */
export interface PasswordResetRequest {
  email: string;
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
