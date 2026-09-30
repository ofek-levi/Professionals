import type {
  AuthSession,
  GoogleAuthRequest,
  GoogleAuthResponse,
  LoginRequest,
  LogoutRequest,
  PasswordResetRequest,
  RefreshSessionRequest,
  RegisterRequest,
  SessionTokens,
  SuccessResponse,
} from '@/types/api';
import type { ApiClient, RequestOptions } from '../client';

/**
 * The public auth endpoints: sent without a bearer token, and a 401 is an expected answer (wrong
 * password, unverifiable Google token, dead refresh token), never a reason to refresh the session.
 */
const ANONYMOUS: RequestOptions = { anonymous: true };

export function createAuthApi(client: ApiClient) {
  return {
    /** `POST /auth/login` – 401 `INVALID_CREDENTIALS` for an unknown email or a wrong password. */
    login: (payload: LoginRequest) => client.post<AuthSession>('/auth/login', payload, ANONYMOUS),
    /** `POST /auth/register` → 201. 409 `EMAIL_ALREADY_REGISTERED`, 400 `VALIDATION_ERROR`. */
    register: (payload: RegisterRequest) => client.post<AuthSession>('/auth/register', payload, ANONYMOUS),
    /** `POST /auth/google` – 401 `INVALID_GOOGLE_TOKEN` when the id token can't be verified. */
    signInWithGoogle: (payload: GoogleAuthRequest) => client.post<GoogleAuthResponse>('/auth/google', payload, ANONYMOUS),
    /** `POST /auth/refresh` – rotates the refresh token; 401 when the session is over. */
    refresh: (payload: RefreshSessionRequest) => client.post<SessionTokens>('/auth/refresh', payload, ANONYMOUS),
    /** `POST /auth/password-reset` – always succeeds for a valid email address. */
    requestPasswordReset: (payload: PasswordResetRequest) => client.post<SuccessResponse>('/auth/password-reset', payload, ANONYMOUS),
    /**
     * `POST /auth/logout` – ends the session of that refresh token (and with it its push token).
     * Idempotent (signing out queues it until it succeeds: `services/auth/pending-logouts.ts`).
     */
    logout: (payload: LogoutRequest, signal?: AbortSignal) =>
      client.post<SuccessResponse>('/auth/logout', payload, { ...ANONYMOUS, signal }),
    /** `POST /auth/verify-email/resend` (signed in) – a new verification link, unless already verified. */
    resendVerificationEmail: () => client.post<SuccessResponse>('/auth/verify-email/resend'),
  };
}
