# Backend integration guide

The app ships with an in-app mock backend (`src/mocks`) that implements the complete REST
contract described in [ARCHITECTURE.md](./ARCHITECTURE.md#rest-contract). This document lists what
a real backend has to provide and which client files change when it does.

## 1. Switching the transport

```bash
EXPO_PUBLIC_API_MODE=http EXPO_PUBLIC_API_BASE_URL=https://api.example.com/v1 npx expo start
```

- `src/services/api/config.ts` reads the mode; `src/services/api/index.ts` then builds the
  `ApiClient` with `createHttpTransport` (fetch, JSON, timeouts, error normalization) instead of the
  mock transport. **No screen, hook or component changes.**
- Every endpoint function in `src/services/api/endpoints/*` documents its method and path, and every
  request/response body is typed in `src/types/api` + `src/types/domain`. These types are the API
  contract. Generate them from an OpenAPI schema later if you like, as long as the shapes match.
- Error responses must use `ApiErrorBody` (`{ code, message, fieldErrors? }`) with the codes in
  `API_ERROR_CODES`. The UI localizes messages by `code` and shows `fieldErrors` next to form fields.
- Pagination is cursor-based: `?cursor=&limit=` → `{ items, nextCursor, totalCount }`.
- Arrays in query strings are comma-separated (`?urgencies=emergency,urgent`), see
  `serializeQuery` in `src/services/api/transport.ts`.

## 2. Server responsibilities (implemented today by the mock)

| Concern | Mock implementation | Real backend |
|---|---|---|
| Authentication | `account-service.ts`: `POST /auth/login`, `/auth/register`, `/auth/google`, `/auth/password-reset` with salted SHA-256 hashes in a `credentials` table; tokens are `demo-token:<userId>`. `POST /auth/demo-login` + `GET /auth/demo-accounts` are demo-only. | Same endpoints and payloads (§3). Hash passwords with argon2id/bcrypt, issue JWT access + refresh tokens, rate-limit sign-in, registration and reset, verify emails, send real reset emails. The client signs out on HTTP 401 except for the public sign-in requests (`skipUnauthorizedHandler` in `endpoints/auth.ts`). Add a refresh-token flow in `ApiClient` if tokens are short-lived. The demo accounts section hides itself in `http` mode. Token storage: see §3. |
| Authorization | `src/mocks/server/auth.ts` role + ownership checks | Same rules: customers only see their own requests; professionals only see matching or offered requests; only the request owner accepts offers. |
| Business rules | `lifecycle-service.ts` + the shared state machines in `src/features/*/…-status-machine.ts` | Must be **authoritative** on the server and transactional. In particular, accepting an offer must atomically accept one offer, reject the others, update the request and create the job + conversation, so a second acceptance fails with 409. |
| Validation | zod schemas in `src/lib/validation` | Re-validate everything server side. The client schemas mirror the server rules only for UX. |
| Matching | `request-matching.ts` (category ∩ service radius, haversine) | Geo index (PostGIS `ST_DWithin` or similar). Keep the privacy rule: return an approximate location to professionals until their offer is accepted. |
| Category catalog | `DEFAULT_CATEGORY_CATALOG` served by `GET /catalog/categories` | Serve from the database, with localized `name` / `description` / `keywords`. The client already renders localized text from the payload and caches it with React Query. |
| Notifications | `notification-service.ts` creates in-app notifications on each event | Persist notifications, fan out push messages (see §4) and honour `NotificationPreferences`. |
| Scheduled work | `scheduler.ts` runs on every request (offer expiry, appointment reminders) | Cron jobs or delayed queues. |
| Realtime | In-process event bus (`src/mocks/realtime.ts`) | WebSocket/SSE sending `RealtimeEvent` JSON frames. `src/services/realtime/websocket-realtime-client.ts` is a ready skeleton (auto-reconnect). |
| Messaging | `messaging-service.ts` | Persist messages. Keep `clientMessageId` idempotency so client retries never duplicate messages. |
| Uploads | `POST /uploads/images` stores the local URI | Pre-signed upload URLs (S3/GCS) or multipart upload. Return `{ id, url }` and reference `photoIds` when creating requests. |
| Geocoding | Gazetteer of ~40 Tel Aviv-area places (`geo-service.ts`) | Google Places / Mapbox / a local geocoder behind `GET /geo/search` and `GET /geo/reverse`. |
| Ratings | `review-service.ts` recomputes averages | Aggregate on write (or via materialized views). |
| Demo simulator | `simulator.ts` (auto offers, auto chat replies) | Not needed. `demoTools` hides itself when `EXPO_PUBLIC_API_MODE=http`. |

## 3. Accounts and Google sign-in

- `POST /auth/login { email, password }` → `AuthSession`. Emails are case-insensitive (the client
  sends them trimmed and lower-cased). Answer 401 `INVALID_CREDENTIALS` for an unknown email, a
  wrong password and a Google-only account alike.
- `POST /auth/register` (`RegisterRequest`) → `AuthSession`. Validate with the same rules as
  `registerRequestSchema` (`src/lib/validation/auth.ts`): names, email, phone, terms, a password
  (8–64 chars, a letter and a digit) **or** a Google id token, and `professional` details for
  professionals (1–10 catalog categories, base location, radius within
  `APP_CONFIG.min/maxServiceRadiusKm`). Create the user, the customer or professional profile
  (display name = business name or full name, service area centered on the base location, default
  availability and notification preferences, zero stats, `languages: [preferredLanguage]`, not
  verified) and the credential in one transaction. Duplicate email → 409 `EMAIL_ALREADY_REGISTERED`
  with `fieldErrors.email`. That answer tells whether an address has an account, so rate-limit
  `POST /auth/register` per IP and per email and add bot protection (e.g. a CAPTCHA after a few
  attempts), as for sign-in and reset.
- **Passwords:** besides the client rules (8–64 characters, a letter and a digit, not one of the most
  common passwords – `newPasswordIssue`), reject passwords found in breach corpora (e.g. Have I
  Been Pwned's k-anonymity range API) on registration and reset.
- **Email verification:** send a verification link after a password sign-up and mark the
  credential verified when it is opened (the mock has `StoredCredential.emailVerified` but never
  sends one: password sign-ups stay unverified; Google sign-ups and seeded accounts are verified).
- `POST /auth/google { idToken }` → `{ status: 'signed_in', session }` for a known Google account
  or email, otherwise `{ status: 'registration_required', profile }`; the app then finishes the
  sign-up and sends the same token as `RegisterRequest.googleIdToken` (its email must match).
  **Verify every id token** with Google's public keys (e.g. `google-auth-library`
  `verifyIdToken`): signature, `aud` = one of the app's web/iOS/Android client ids, `iss` =
  `accounts.google.com`, `exp`, `email_verified`. Invalid → 401 `INVALID_GOOGLE_TOKEN`. Never
  accept the demo `mock-google.` tokens. Linking rules (as in the mock's `signInWithGoogle`):
  - A credential linked to a Google account is matched by `sub` only. If the email matches but
    the credential is linked to a **different** `sub` (a recycled or re-created address), refuse
    with 401 `INVALID_GOOGLE_TOKEN` – never sign in by the email alone.
  - Link Google to an existing email + password account (first Google sign-in with that email)
    only as follows: if the account's email is **verified**, link it and keep the password; if it
    is **not**, the password may have been set by someone who registered the address before its
    owner ("pre-account hijacking"): link Google, mark the email verified, **drop the password and
    revoke every existing session and refresh token** of the account (the owner can set a new
    password with a reset link). The mock drops the password; its stateless demo tokens can't be
    revoked.
- `POST /auth/password-reset { email }` → always `{ success: true }` (no account enumeration);
  email a single-use, short-lived reset link when the account exists.
- Client flow: the app gets Google's `id_token` with expo-auth-session (web popup; native builds
  exchange the code with PKCE first), sends it to `POST /auth/google`, and for
  `registration_required` keeps the token in memory while the user finishes the sign-up steps, then
  sends it once more as `RegisterRequest.googleIdToken`. Id tokens are valid for about an hour,
  which covers the sign-up steps; answer 401 `INVALID_GOOGLE_TOKEN` for an expired one (the app
  shows the error and switches the form back to email, where "Continue with Google" is offered
  again).
- `GET /geo/search` and `GET /geo/reverse` must work without a session: a professional picks the
  base address during sign-up. Rate-limit them per IP.
- **Profile privacy:** `GET /professionals/:id` returns a public view (`toPublicProfessionalProfile`
  in `src/mocks/server/views.ts`): `baseLocation` and `serviceArea.center` are approximate (a
  professional's base is often their home), and `contact` (phone, email) is `null` except for
  customers who hired the professional (have a job with them). The own profile
  (`GET /professional/profile`) is complete.
- **Sign-in email vs. contact email:** a professional's `contact.email` is the address customers
  see; changing it in the profile never changes the account's sign-in email (`User.email`).
  Changing the sign-in email is a separate, authenticated flow: require the current password (or
  a recent sign-in), verify the new address with a link before switching, and notify the old one.
- **Token storage:** the demo keeps the bearer token in `sessionStore` (AsyncStorage, i.e.
  `localStorage` on web). With real accounts, store it in `expo-secure-store` (Keychain/Keystore) on
  iOS/Android, and on the web prefer an httpOnly, `Secure`, `SameSite` session cookie – or a
  short-lived access token kept in memory plus a refresh token in such a cookie. Swap the storage
  in `src/services/auth/session-store.ts`; nothing else in the app reads the token.
- Client setup of the Google OAuth client ids: README → *Google sign-in*.

## 4. Push notifications

- The client talks to `PushProvider` (`src/services/push/types.ts`). Today
  `simulated-push-provider.ts` shows in-app banners and registers a fake device token through
  `POST /me/devices`.
- To go live, follow the checklist in `src/services/push/expo-push-provider.ts`: install
  `expo-notifications`, implement the provider, return it from `src/services/push/index.ts`
  when in HTTP mode, and configure APNs/FCM credentials with EAS.
- The push payload `data` should include `{ notificationId, target }` (a `NotificationTarget`),
  so taps deep-link through the same `notificationTargetToHref` used by the notification center.

## 5. Payments and other out-of-scope items

Payments, invoicing, disputes, identity/licence verification of professionals, content moderation,
analytics and admin tooling are not implemented. The `ProfessionalProfile.isVerified` flag and the
`agreedPrice` on jobs are the natural integration points for verification and payments.
