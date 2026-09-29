import type {
  AuthSession,
  CurrentUserResponse,
  DemoLoginRequest,
  GoogleAuthRequest,
  GoogleAuthResponse,
  LoginRequest,
  PasswordResetRequest,
  RegisterDeviceRequest,
  RegisterRequest,
  SuccessResponse,
} from '@/types/api';
import type { DemoAccount } from '@/types/domain';
import type { ApiClient, RequestOptions } from '../client';

/**
 * The public sign-in endpoints: the caller is signed out, and a 401 is an expected answer (wrong
 * password, unverifiable Google token) that must not trigger the client's global sign-out. Any
 * other endpoint – including future authenticated `/auth/*` ones (refresh, change password…) –
 * keeps it.
 */
const PUBLIC_AUTH: RequestOptions = { skipUnauthorizedHandler: true };

export function createAuthApi(client: ApiClient) {
  return {
    /** `GET /auth/demo-accounts` – demo accounts of the mock backend (one-tap sign-in). */
    getDemoAccounts: () => client.get<DemoAccount[]>('/auth/demo-accounts', PUBLIC_AUTH),
    /** `POST /auth/demo-login` */
    demoLogin: (payload: DemoLoginRequest) => client.post<AuthSession>('/auth/demo-login', payload, PUBLIC_AUTH),
    /** `POST /auth/login` – 401 `INVALID_CREDENTIALS` for an unknown email or a wrong password. */
    login: (payload: LoginRequest) => client.post<AuthSession>('/auth/login', payload, PUBLIC_AUTH),
    /** `POST /auth/register` – 409 `EMAIL_ALREADY_REGISTERED`, 422 `VALIDATION_ERROR`. */
    register: (payload: RegisterRequest) => client.post<AuthSession>('/auth/register', payload, PUBLIC_AUTH),
    /** `POST /auth/google` – 401 `INVALID_GOOGLE_TOKEN` when the id token can't be verified. */
    signInWithGoogle: (payload: GoogleAuthRequest) => client.post<GoogleAuthResponse>('/auth/google', payload, PUBLIC_AUTH),
    /** `POST /auth/password-reset` – always succeeds for a valid email address. */
    requestPasswordReset: (payload: PasswordResetRequest) => client.post<SuccessResponse>('/auth/password-reset', payload, PUBLIC_AUTH),
    /** `POST /auth/logout` – the session is ending anyway: an expired token is no reason to sign out twice. */
    logout: () => client.post<SuccessResponse>('/auth/logout', undefined, PUBLIC_AUTH),
    /** `GET /me` */
    getCurrentUser: () => client.get<CurrentUserResponse>('/me'),
    /** `POST /me/devices` – register a push token (simulated for now). */
    registerDevice: (payload: RegisterDeviceRequest) => client.post<SuccessResponse>('/me/devices', payload),
  };
}
