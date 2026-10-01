# Architecture & Conventions

Two-sided local services marketplace (customers ⇄ professionals) built with **Expo SDK 57**
(React Native 0.86, React 19.2, TypeScript 6, Expo Router 57, React Compiler enabled).
The app talks only to the **backend in [`../backend`](../../backend)** (Express, MongoDB, Redis): REST
over HTTP and realtime events over a WebSocket. The contract is
[`backend/docs/API.md`](../../backend/docs/API.md). There is no mock mode:
`src/test-utils/mock-backend` is a test double that only Jest uses.

---

## 1. Layering & data flow

```
Screen / component (src/app, src/features/*/screens, src/components)
   │  only via hooks
   ▼
React Query hooks (src/hooks/queries, src/hooks/mutations)       ← server state, cache, invalidation
   │  api.* functions
   ▼
Typed endpoint modules (src/services/api/endpoints)               ← REST paths + DTO types
   │  ApiClient.get/post/patch/delete                              ← bearer token, refresh on 401
   ▼
HTTP transport (fetch) ──────────────▶ backend  EXPO_PUBLIC_API_BASE_URL (…/v1)
Realtime client (WebSocket) ◀────────── backend  ws(s)://…/v1/realtime → cache (providers/realtime-events.ts)
Push (expo-notifications)   ◀────────── Expo push service (iOS/Android)
```

Hard rules

1. **App code never imports `src/test-utils`** (ESLint `no-restricted-imports`; only tests and
   test helpers may), and screens/components never call `api.*` directly: they use hooks from
   `src/hooks`.
2. **No business rules in screens.** Status transitions, allowed actions, sorting and validation
   live in `src/features/<feature>/*.ts` (pure functions) and `src/lib/validation`. The
   backend enforces the same rules (its copies of the constants, status models, limits and sign-up
   validation are drift- and parity-tested against `frontend/`), so client affordances and server
   answers agree.
3. **No hard-coded user facing strings.** Everything goes through i18next (`useTranslation`).
4. **No hard-coded colors/sizes/fonts.** Use theme tokens via `useTheme()` / `makeStyles()`.
5. Use stable ids (`CategoryId`, entity ids) for logic, never display names.
6. No `any`. Prefer discriminated unions and `satisfies`.

## 2. Folder structure

```
src/
  app/                      Expo Router routes – thin files that render screens from src/features
  config/env.ts             EXPO_PUBLIC_APP_ENV / API_BASE_URL / EAS_PROJECT_ID, validated at startup
  components/
    ui/                     design system primitives (AppText, Button, Card, Badge, TextField, …)
    categories/ requests/ offers/ professionals/ jobs/ location/ map/ forms/
  features/
    auth/                   session provider + lifecycle, role guards, entry / sign-in / sign-up screens
    customer/ professional/ requests/ offers/ jobs/ notifications/ messaging/ reviews/ profiles/ settings/ legal/
      *.ts                  pure business logic (state machines, selectors, sorting)
      screens/*.tsx         screen components rendered by src/app routes
      components/*.tsx      feature-private components
  services/
    api/                    client.ts, transport.ts, http-transport.ts, image-form.ts, endpoints/*,
                            config.ts, index.ts (the app's `api` and `sessionTokens`)
    auth/session-store.ts   the session (identity + tokens) and where it is stored
    auth/token-manager.ts   proactive / reactive access-token refresh (single flight)
    auth/google-*.ts        Google sign-in config and the real sign-in hook (expo-auth-session)
    realtime/               WebSocket realtime client (reconnect, 4001 → refresh)
    push/                   expo-notifications provider (native), inert provider (web), registration
    location/               device location permission & position (expo-location), isolated
  hooks/
    queries/                useXxx query hooks + query-keys.ts (ALL keys live there)
    mutations/              useXxx mutation hooks + invalidation.ts
  providers/                AppProviders, navigation theme + tab bar options, realtime wiring,
                            push notifications, bootstrap
  types/
    domain/                 entities (User, ServiceRequest, Offer, Job, Review, …)
    api/                    request/response DTOs, pagination, error codes
  constants/                category catalog, urgency levels, status models, notification types, app config
  lib/                      query-client.ts, routes.ts, validation/ (zod schemas)
  test-utils/               Jest only (never bundled): mock-backend/ (the backend test double),
                            native/ (SecureStore, expo-notifications, WebSocket stand-ins)
  i18n/                     i18next setup, RTL handling, locales/{en,he}/<namespace>.ts
  theme/                    design tokens + ThemeProvider + makeStyles
  utils/                    geo.ts (distance), format.ts (dates, money, distance), id.ts
```

## 3. Domain model

See `src/types/domain`. Key relationships:

- `ServiceRequest` (customer) —1:N→ `Offer` (professional) ; accepting one offer creates exactly one
  `Job` and one `Conversation`. `Review` belongs to a completed `Job`.
- `ProfessionalProfile.categoryIds` and `ServiceRequest.categoryId` both reference the **same**
  catalog (`src/constants/professional-categories.ts`).
- Requests are delivered only to professionals whose categories include the request category **and**
  whose service area (center + radiusKm) contains the request location.
- Professionals see an **approximate** request location (`isApproximate: true`, `addressLine: ''`)
  and no customer `notes` (access details such as building codes and parking) until their offer is
  accepted. Distances are still computed from the real location.

### Status models (src/constants/*-statuses.ts)

Request: `draft → open → offers_received → professional_selected → scheduled → in_progress → completed`,
plus `cancelled`. `offers_received → open` when the last pending offer is withdrawn/expires.

| from \ to              | allowed                                                     |
|------------------------|-------------------------------------------------------------|
| draft                  | open, cancelled                                             |
| open                   | offers_received, cancelled                                  |
| offers_received        | open, professional_selected, cancelled                      |
| professional_selected  | scheduled, cancelled                                        |
| scheduled              | in_progress, completed, cancelled                           |
| in_progress            | completed, cancelled (account deletion only)                |
| completed, cancelled   | — (terminal)                                                |

Offer: `pending → accepted | rejected | withdrawn | expired` (all terminal). Only one offer per
request can ever be `accepted`. A professional can have at most one *active* (pending/accepted)
offer per request; pending offers can be edited.

Job: `awaiting_confirmation → scheduled → in_progress → completed`, `awaiting_confirmation|scheduled → cancelled`.
Job status mirrors onto the request status (`JOB_STATUS_META[status].requestStatus`).
`in_progress → cancelled` (job and request) happens only when a party deletes their account; no user
action offers it (the customer's cancel stops at `scheduled`, `assertCustomerCanCancel`).

Who can do what:

| action                     | role         | precondition                                       |
|----------------------------|--------------|----------------------------------------------------|
| create/publish request     | customer     | valid payload                                      |
| cancel request             | customer     | status ∈ draft/open/offers_received/professional_selected/scheduled |
| submit/edit/withdraw offer | professional | request accepts offers; category + area match; no duplicate |
| accept offer               | customer     | offer pending & not expired; request has no accepted offer |
| confirm appointment        | professional | job awaiting_confirmation                          |
| start job                  | professional | job scheduled                                      |
| complete job               | both         | job scheduled or in_progress                       |
| review                     | customer     | job completed and not reviewed yet                 |

## 4. Talking to the backend

### Configuration (src/config/env.ts)

`EXPO_PUBLIC_APP_ENV` (`development` default, `staging`, `production`) and
`EXPO_PUBLIC_API_BASE_URL` (the API root ending in `/v1`; development defaults to
`http://localhost:4000/v1`) are inlined at build time and validated once at startup: a staging or
production build without an `https://` base URL throws `EnvConfigError` with a clear message
instead of talking to the wrong server. The realtime URL is derived from the base URL
(`ws(s)://…/v1/realtime`). Every variable is documented in `frontend/.env.example`.

### API client (src/services/api)

- `ApiClient` (client.ts) sends JSON through the HTTP transport (`fetch`, 15 s default time limit,
  `Accept-Language` from i18n) and throws every non-2xx answer as an `ApiError`
  (`{ status, code, message, fieldErrors?, retryAfterSeconds? }`, errors.ts).
- Authenticated requests carry `Authorization: Bearer <access token>` from the token manager. A 401
  triggers **one** refresh, shared by every request that failed with the same token, and a single
  retry with the new token; if the session cannot be refreshed the request fails with the 401.
- The public auth endpoints (login, register, Google, refresh, logout, password reset) are sent
  with `anonymous: true`: no bearer token, and their 401 is the answer itself (wrong password, dead
  refresh token), never a reason to refresh.
- Images travel with their owner, never on their own. `POST /requests` and `PATCH /requests/:id`
  (a draft) are one `multipart/form-data` body: the JSON payload as the text field `data`, then the
  photos as `photos`; a draft edit lists the stored photos it keeps (`keepPhotos`, by `publicId`) and
  sends only the new ones. The avatar is `PUT /me/avatar` (one `avatar` part) and `DELETE /me/avatar`,
  saved at once from the profile screens (`features/profiles/components/use-avatar-actions.ts`), not
  with the profile form. `image-form.ts` builds the bodies (a `{ uri, name, type }` part on
  iOS/Android, a `Blob` on the web, shrunk there when over 8 MB; refused before sending on
  iOS/Android when the picker reports more) with `APP_CONFIG.photoUploadTimeoutMs` (90 s) per image,
  below the API's 10 min body limit; the transport sends `FormData` untouched so `fetch` sets the
  boundary. The field names are `MULTIPART_FIELDS` (`types/api/images.ts`), checked against the
  backend's by its contract check. The request form posts through
  `features/requests/components/create/use-submit-request.ts`: its idempotency key covers the fields
  and the photos, so a retry after a timeout gets the request the first post created, without storing
  its photos again; a draft's saved photos replace the local ones, so posting again after a failed
  publish sends no file again.
- Errors the UI explains: `VALIDATION_ERROR` (400) maps `fieldErrors` onto the form fields whatever
  the status; `RATE_LIMITED` (429) says when to try again (`Retry-After`). The API names the photos
  (`fieldErrors.photos` / `.avatar`: `upload.invalid`, `upload.rateLimited`, `upload.unavailable`) in
  every refusal that is about them: a refused photo (400/413), the image limits (429) and a photo
  service that is down, busy or not configured (503: "try again later", plus "or remove the photos"
  where they are optional). Those, and a proxy's own 413 while photos are being sent, get the photo
  toast (`components/forms/use-upload-error-toast.ts`, `isPhotoUploadFailure`); any other 429 or 503
  of the same post (e.g. the request limit) gets the usual error toast.

### Session and tokens (src/services/auth)

- `session-store.ts` is the only module that knows where the session lives: `expo-secure-store` on
  iOS/Android (Keychain / Keystore, this device only), `localStorage` on the web (a documented
  trade-off of a bearer-token SPA; other tabs follow sign-out and refreshes through the `storage`
  event). React reads only the identity (`useSession()` → `{ status, userId, role }`), so a token
  refresh never re-renders or clears anything.
- `token-manager.ts` (`sessionTokens` in `services/api/index.ts`) keeps the access token valid for
  the API client and the WebSocket: **proactively** 60 s before `accessTokenExpiresAt` and
  **reactively** after a 401, one `POST /auth/refresh` at a time (everyone waits for the same one).
  The expiry is stored on the device's clock (`token-clock.ts`: arrival time + the JWT's
  `exp - iat`), so a device clock that is off by any amount neither refreshes before every request
  nor lets a token expire unnoticed.
  The rotated refresh token is stored before it is used; the server answers a replay of the
  just-replaced token with the same new pair while that pair is unused (up to 30 min), so concurrent
  refreshes converge and a refresh whose response was lost can be retried later. A
  rejected refresh token (401/400) ends the session locally and the entry screen says why ("You've
  been signed out", `features/auth/session-ended-notice.tsx` via `services/auth/session-ended.ts`);
  a network error keeps the session.
- Sign-in paths (email, register, Google) all go through `establishSession()`
  (`features/auth/session-provider.tsx`), which also syncs the account language
  (`PATCH /me { preferredLanguage }`, also sent when the language changes while signed in).
- Sign-out: the realtime socket is closed first (the server closes a revoked session's sockets with
  4001, which would otherwise be taken for an expired token and spend the revoked refresh token),
  then the local session is cleared at once (the entry screen shows without waiting for the
  network). `POST /auth/logout { refreshToken }` (the server revokes the session, and with it the
  install's push token) follows in the background through `services/auth/pending-logouts.ts`: the refresh
  token is queued in secure storage before the local sign-out and stays there until the server
  accepts it or refuses it for good (400/401/403/404); network errors, timeouts, 429 and 5xx keep it
  for the next try at launch, after a sign-in, on returning to the foreground and (web) when back
  online (`features/auth/pending-logout-retries.ts`). A session that ends without a logout (expired,
  revoked) gets no push either: the server keeps the push token on the session, so it ends with it.
- `features/auth/session-lifecycle.ts` reacts to every identity change (sign in/out, restored
  session, another tab, failed refresh) synchronously inside the store: it clears the query cache
  and disconnects/connects realtime, so no screen can see another user's data. The
  `Stack.Protected` guards then show the entry screen or the role's home.

### Realtime (src/services/realtime)

`websocket-realtime-client.ts` connects to `ws(s)://…/v1/realtime` while signed in, with the access
token as a WebSocket subprotocol (`professionals.v1`, `bearer.<token>`: `realtime-protocol.ts`), never
in the URL (proxies and browsers log URLs), and parses `RealtimeEvent` frames (`realtime-frames.ts`, `types.ts`):

- close **4001** (expired or revoked token): refresh through the token manager and reconnect with
  the new token; stop when the refresh fails (the session is over);
- any other close (1001 server restart, network loss): reconnect with capped exponential backoff
  (1 s … 30 s) plus jitter;
- back in the foreground: reconnect immediately; iOS/Android close the socket in the background
  (pushes cover that time);
- after a reconnect, `onReconnect` listeners refetch the user's queries (events may have been missed).

Events (pushed to the affected users): `notification.created`, `message.created`,
`conversation.read` (read receipt: `readerId` read the other participant's messages up to
`readAt`), `request.updated`, `offer.updated`, `job.updated`, `profile.updated`.
`src/providers/realtime-events.ts` applies them to the cache with the same invalidation helpers as
the mutations; infinite lists whose order changes reload from the first page. While the app is
open, `notification.created` also shows an in-app banner (`src/providers/realtime-provider.tsx`).

### Push notifications (src/services/push, src/providers/push-notifications.tsx)

- iOS/Android use `expo-notifications` (`expo-push-provider.ts`): an Android "default" channel,
  OS banners suppressed while the app is open (the in-app banner shows instead), Expo push tokens
  issued for the EAS project id (`EXPO_PUBLIC_EAS_PROJECT_ID` / `extra.eas.projectId` from
  `app.config.ts`; without it push is off with a development warning). Android also needs
  Firebase: `GOOGLE_SERVICES_FILE` → `android.googleServicesFile` (app.config.ts). The web build
  gets an inert provider and never bundles `expo-notifications`.
- `PushNotifications` registers the device (`POST /me/devices { pushToken, platform }`) while the
  account has push enabled, asking for permission 1.5 s after the signed-in home appears (never on
  the entry screens), and again when the OS rotates the token. Turning push off in Settings calls
  `DELETE /me/devices/:token`; signing out needs nothing more (the server's logout, queued until it
  succeeds, ends the session and the push token stored on it; an expired session takes it along too).
- A tapped notification (including the one that launched the app) is marked read and opens
  `notificationTargetToHref(data.target)`, like a tap in the inbox.

### Google sign-in (src/services/auth/google-*.ts)

Real Google only (`expo-auth-session`), with the client id of the running platform
(`EXPO_PUBLIC_GOOGLE_WEB|IOS|ANDROID_CLIENT_ID`). Without that id, or in Expo Go on iOS/Android,
the "Continue with Google" button is not rendered. The id token goes to `POST /auth/google`; a new
identity (`registration_required`) continues in the sign-up flow.

### REST contract

The backend's [`docs/API.md`](../../backend/docs/API.md) is the source of truth for every endpoint,
role, payload, error and limit; `src/types/api` mirrors it (the backend's `npm run typecheck`
compiles a contract check against these types). The conventions the client relies on:

- Paths are relative to the base URL (`/requests/:id`, `/me`, …); JSON in and out.
- Lists that can grow are keyset-paginated: `cursor` (opaque) + `limit` (default
  `APP_CONFIG.pageSize` = 20, at most 100) → `Paginated<T> { items, nextCursor, totalCount }`. The
  app uses infinite queries for them (`GET /conversations`, `/jobs`, notifications, messages,
  reviews, requests, offers) and one page of 100 where a screen needs everything (the offers of a
  request).
- Errors are `ApiErrorBody { code, message, fieldErrors? }`: 400 `VALIDATION_ERROR` (+ `fieldErrors`
  keyed by field path with `validation:*` message keys), 401 `UNAUTHORIZED` / `INVALID_CREDENTIALS`
  / `INVALID_GOOGLE_TOKEN`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 conflicts (`EMAIL_ALREADY_REGISTERED`,
  `INVALID_STATE_TRANSITION`, `DUPLICATE_OFFER`, `OFFER_EXPIRED`, `REQUEST_NOT_ACCEPTING_OFFERS`, …),
  422 `UNSUPPORTED_CATEGORY` / `OUTSIDE_SERVICE_AREA`, 429 `RATE_LIMITED` (`Retry-After`), and on the
  client side `NETWORK_ERROR` / `TIMEOUT`. `ErrorState` / `useErrorText` map `code` to
  `errors:codes.<CODE>`.

### Test double (src/test-utils/mock-backend)

Jest suites run the real hooks, endpoint modules, API client, token manager, WebSocket client and
screens against an in-process implementation of the backend contract
(`createTestEnvironment()` in `testing/test-server.ts`: in-memory database seeded from `data/`,
controllable clock, the shared state machines; request matching, approximate locations and offer
counters, which only the server computes, live in `server/`). It follows `backend/docs/API.md`: sessions with
30-minute access tokens and rotating refresh tokens (30 s replay window, reuse revokes the session
and its push token), `POST /auth/refresh|logout`, `PATCH /me`, Expo-only `POST /me/devices` and
`DELETE /me/devices/:token` (one push token per session, stored on it), `VALIDATION_ERROR` as 400, register 201, paginated lists,
`/conversations/unread-count`, multipart `POST /requests` / `PATCH /requests/:id` (`data` +
`photos`, `keepPhotos`), `PUT` / `DELETE /me/avatar`, `GET /legal/:document` (a short Terms of
Use and Privacy Policy in both languages, `data/legal-documents.ts`) and account deletion
(`GET /me/deletion-impact`, `POST /me/deletion`: the password or the linked Google account, 400
refusals, the cancellations with their notifications, the customer's requests without an offer
deleted, an anonymous tombstone shown as "Deleted user" with `accountDeleted`, the sign-in
credential freed; `services/account-deletion-service.ts`). `env.transport` (with a request log) replaces the app's HTTP transport
(`apiClient.setTransport`); `env.sockets.openSocket` is the realtime endpoint for the app's
WebSocket client (4001 for bad, expired or revoked tokens, `dropAll(1001)` for a restart). App code
cannot import it (ESLint), so it is never bundled. `jest.setup.ts` also installs in-memory
`expo-secure-store` and `expo-notifications`, React Native's `FormData` and a WebSocket that never
connects (`src/test-utils/native`).

## 5. React Query conventions

- Keys: only from `src/hooks/queries/query-keys.ts`, always scoped by the signed-in user id.
- One hook per endpoint the UI uses (`useRequest`, `useNearbyOpenRequests`, `useAcceptOffer`, …).
  Screens never build keys or call `queryClient` themselves. Endpoints no screen needs yet (e.g.
  `GET /professionals` search) keep their typed function in `src/services/api/endpoints`, but get
  no hook until a screen uses them.
- Mutations invalidate through helpers in `src/hooks/mutations/invalidation.ts` (e.g.
  `invalidateRequestGraph`). Realtime events reuse the same helpers.
- Optimistic updates: marking notifications read, sending chat messages, editing profile.
- Retries never duplicate: chat messages carry a `clientMessageId`, and posting the request form a
  `clientRequestId` (`features/requests/components/create/submission-key.ts`: the same key while the
  form is unchanged), so posting again after a timeout returns the request already created (with its
  photos) instead of a second one; publishing a draft is idempotent on the server too.
- Lists that can grow use `useInfiniteQuery` with cursor pagination. Badges read the dedicated
  counters (`/notifications/unread-count`, `/conversations/unread-count`), kept in step by realtime
  events and optimistic mark-read updates.
- Errors are `ApiError` (`src/services/api/errors.ts`); render with `<ErrorState error={…} onRetry />`
  which maps `error.code` to `errors:codes.<CODE>`.

## 6. UI conventions

- Theme: `const useStyles = makeStyles((t) => ({ … }))` / `const t = useTheme()`. Colors from
  `t.colors`, status/urgency colors from `t.colors.tones[tone]`, spacing `t.spacing`, radii `t.radii`,
  text styles via `<AppText variant="heading">`.
- Icons: `<Icon name="…" />` (MaterialCommunityIcons). Directional icons (chevrons/arrows) must pass
  `flipInRTL`. Import icon sets by subpath (`@expo/vector-icons/Ionicons`): the package barrel
  bundles every icon font into the native app.
- Text inputs: set `textAlign` with `resolveInputTextAlign()`, not a logical `left`/`right` (iOS and
  Android apply those to inputs as physical sides, even in RTL; only `<Text>` mirrors them).
- RTL: use `marginStart/End`, `paddingStart/End`, `start/end` – never `left/right` for layout.
  `flexDirection: 'row'` mirrors automatically. `AppText` aligns to the start edge.
- Touch targets ≥ 44pt, `accessibilityRole`/`accessibilityLabel` on interactive elements.
- Every data screen handles loading (skeleton), error (retry), empty and success states.
- Only irreversible/important actions ask for confirmation via `useConfirm()` (accept an offer,
  cancel a request, withdraw an offer, mark a job completed, delete a draft, sign out); results
  are surfaced with `useToast()`. One primary (full-width, usually sticky) action per screen.
- Navigation: the bottom tabs are the single entry point per feature – customer: Home · Requests ·
  Inbox · Profile; professional: Home · Explore · Work (`?tab=offers|jobs`) · Inbox
  (`?tab=updates|messages`) · Profile; the customer's Requests tab takes `?tab=active|past`. Build
  links with `routes` (`src/lib/routes.ts`); notifications and push payloads resolve through
  `notificationTargetToHref` straight to these destinations. Offers are seen and acted on from the
  request screen (`/requests/:id`), for both roles – there is no separate offer screen. Cancelling a
  booking also lives there only ("Cancel request"; the job screen has no cancel action). The Inbox
  shows chat messages under Messages only: the server leaves `new_message` notifications out of the
  Updates list and its unread count (`?excludeTypes=new_message`, so every page is full and the count
  is exact however many notifications there are), and the tab badge is always Updates + Messages
  (`src/features/notifications/inbox-counts.ts`).
- Design language and component rules: `src/components/README.md`.
- Safe areas: use `<Screen>` which handles insets, keyboard avoidance and pull-to-refresh.
- Stack screens opened with nothing to go back to (deep link, notification on a cold start, web
  refresh) get a header button to the signed-in role's home (`renderHeaderHomeButton`,
  `src/providers/header-home-button.tsx`, used by `src/app/_layout.tsx`).

### Route map (src/app)

Signed-out routes sit in `Stack.Protected guard={!signedIn}`, signed-in ones in
`Stack.Protected guard={signedIn}` (`src/app/_layout.tsx`); `/` redirects to `/sign-in` or the role's
home. `/legal/:document` is declared outside both guards, so it opens in either state and never
redirects. Build every link with `routes` (`src/lib/routes.ts`).

| Route | Who | Screen |
|---|---|---|
| `/sign-in` | signed out | entry: brand hero with the language switch, **Create account** and **Sign in** |
| `/auth/login` | signed out | email + password, "Continue with Google", links to reset and sign-up |
| `/auth/sign-up?role=customer\|professional` | signed out | step flow: role → account → services → service area (customers stop after the account); `role` skips the first step |
| `/auth/forgot-password` | signed out | request a reset link (same answer whether or not the account exists) |
| `/customer/(home\|requests\|inbox\|profile)` | customer | tabs (`requests?tab=active\|past`, `inbox?tab=updates\|messages`) |
| `/professional/(home\|explore\|work\|inbox\|profile)` | professional | tabs (`work?tab=offers\|jobs`) |
| `/requests/new`, `/requests/:id`, `/requests/:id/offer` | customer · both · professional | new request, request details (offers live here), send/edit offer |
| `/professionals/:id`, `/professionals/:id/reviews` | signed in | public profile, all reviews |
| `/jobs/:id`, `/jobs/:id/review` | both · customer | job tracking, leave a review |
| `/conversations/:id`, `/profile/edit`, `/settings` | signed in | chat, edit own profile, settings |
| `/settings/delete-account` | signed in | delete the account (what it cancels, password or Google, last confirmation) |
| `/legal/terms`, `/legal/privacy` | everyone | Terms of Use, Privacy Policy (linked from the entry and sign-in screens, the sign-up terms and Settings → Legal; web deep links) |

### Account screens (src/features/auth)

- Screens use the auth mutations only (`useLogin`, `useRegister`, `useGoogleAuth`,
  `useRequestPasswordReset`); a session response goes through `establishSession()`, so the
  `Stack.Protected` guards swap the auth screens for the role's home. The screen unmounts right
  away: the welcome toast (`use-welcome-toast.ts`) is shown from the `mutateAsync()` result.
- Sign-up is one react-hook-form instance over `signUpFormSchema`; "Continue" marks the step's
  fields as touched and `trigger()`s them (`SIGN_UP_STEP_FIELDS`), so errors show on "Continue" and
  then update while typing. Server `fieldErrors` are mapped with `registerFieldErrorsToForm`; an
  error on the current step is only scrolled into view, one on an earlier step jumps back to it
  (with a toast saying why). `usePreventRemove` turns the header back arrow (and gestures /
  hardware back) into "previous step", and `useBrowserBack` does the same for the browser's back
  button on web: one `popstate` listener installed at module load of the root layout (before the
  router's own, so it can stop it) restores the screen's history entry and calls the screen. The
  navigator's own `history.go()` (it pops a screen, e.g. a legal document closed with the header
  back arrow) is counted by a wrapper the interceptor installs, and its `popstate` reaches the
  router untouched – it may arrive after the screen underneath re-enabled its handler.
  A role in the link (`?role=`) skips the role step; the progress counts from the first step shown
  and shows no total until a role is chosen (`signUpProgress`).
- Every submit runs through `useSingleFlight`: a second tap while one is being validated or sent
  is ignored (the button's loading state only starts once the mutation is pending), and results
  that arrive after the screen unmounted are dropped.
- A new Google identity (`registration_required`) is kept in memory in
  `pending-google-sign-up.ts` (never in the URL) and cleared when the sign-up screen unmounts or a
  session starts. `GoogleSignInButton` is not rendered without a Google client id for the running
  platform, or in Expo Go on iOS/Android (`useGoogleSignInAvailable`).
- An email typed on one auth screen is handed to the next one in memory (`auth-email-hint.ts`,
  never in the URL): "Sign in with this email" (sign-up → sign in) and "Forgot password?"
  (sign in → reset) prefill it.
- The terms checkbox ("I'm 18 or older and I agree to…") links to the legal screen with
  `router.push`: the sign-up screen stays mounted underneath, so the form (and a pending Google
  identity) survives reading a document. `useBrowserBack` is off while the sign-up screen is not
  focused, so the browser's back button closes the document instead of stepping the form back.

### Deleting the account (src/features/settings)

Settings → Account → Delete account opens `/settings/delete-account`. It loads
`GET /me/deletion-impact` fresh (`useAccountDeletionImpact`) and shows per role what the deletion
cancels right away (requests and the offers on them, drafts, jobs; a professional's pending offers
and jobs, with the first items of each) and what stays – the records the account-deletion page lists
(jobs, a customer's requests that received offers and ratings without comments, a professional's
offers without the message and reviews about them, sent messages, as "Deleted user") – with the
Privacy Policy one tap away. The account holder
confirms with the password (`PasswordField`), or – an account without one – with a fresh Google
sign-in (`GoogleSignInButton` → `googleIdToken`), then once more in a destructive dialog.
`useDeleteAccount` → `deleteAccountAndSignOut()` (session provider): realtime is closed first (the
server closes the account's sockets with 4001, which would otherwise trigger a refresh and "You've
been signed out"), `POST /me/deletion`, then the session ends on this device only – no server
logout is queued, the deletion ended every session. The `Stack.Protected` guards show the entry
screen and a toast says the account was deleted. Refusals are 400, never 401: a wrong password
shows under the field, a Google account other than the linked one as an alert; 429 says when to try
again (`useErrorText`); offline and other errors are toasts, and realtime reconnects. A 401 means
the account is already gone (deleted on another device, or a first request whose answer was lost):
the session ends without the generic "You've been signed out" notice, and a toast says the account
no longer exists.

Other people's deleted accounts arrive with `accountDeleted` (`customerAccountDeleted` on reviews)
and the server's English placeholder name: `usePersonName()` (`src/i18n/hooks.ts`) shows "Deleted
user" in the app's language wherever a counterpart is named, their profile is not linked (it
answers 404), and a chat closed for that reason says so. A hired professional's contact details
(`ProfessionalContactCard`: phone → `tel:`, email → `mailto:`, website) show on the job and their
profile, and the hired-pro card on the request offers a call, when the API sends them – only to a
customer who hired them, while the job is not cancelled.

### Legal documents (src/features/legal)

The Terms of Use and the Privacy Policy live on the backend (one copy, versioned, also public web
pages at `<API origin>/legal/:document`); the app never bundles their text. `/legal/:document`
loads `GET /legal/:document?lang=<app language>` (`useLegalDocument`, public key per language, 5 min
fresh like the server's `Cache-Control`) and renders the title (header), the effective date, the
intro and the sections: headings (`accessibilityRole="header"`), paragraphs, bullet lists and
definitions. Texts carry inline markup only – `**bold**` and `[label](url)` – parsed by
`legal-markup.ts`; links to `https:` (`http:` only in development, for a local server) and
`mailto:` open in the in-app browser – the system's handler where there is none – or the mail app (a
new tab on the web), a link to the other document's public page opens that document in the app, and
the public pages opened outside the app get `?lang=<app language>`; anything else stays plain text. A paragraph whose first word is in the other script ("Professionals היא…")
gets a direction mark, so it still runs in the document's direction.

### Maps (src/components/map)

One component, `AppMap`, renders every map: Leaflet with OpenStreetMap raster tiles (no API key;
the only native module is `react-native-webview`, which Expo Go includes – development builds made
before it was added must be rebuilt; usage and examples in `src/components/README.md`).

```
AppMap (app-map.tsx)          props + theme → MapPageState (map-page-state.ts); focus region,
  │                           ref.animateToRegion, zoom buttons (RN IconButtons)
  └─ LeafletMap host          leaflet/leaflet-map.tsx: react-native-webview (iOS/Android)
       │                      leaflet/leaflet-map.web.tsx: sandboxed <iframe srcdoc> (web)
       ├─ useMapBridge        channel, ready handshake, command queue, state dedupe, validation,
       │                      credit links, web tile loading, reload after a crashed page (at
       │                      most twice in 30 s), 15 s timeout → error + retry
       └─ page document       map-document.ts: CSP + Leaflet CSS/JS + our CSS + glyph table +
                              map-page-script.ts (the in-page runtime, a plain ES5 string)
```

- **Bridge** (`leaflet/map-protocol.ts`): JSON messages tagged with a random per-mount channel id.
  Host → page: the full declarative `state` (markers, circles, pin, theme colors, tiles and
  attribution, RTL, insets, labels) – the page diffs it by id, so updates never reset the camera
  or the selection – plus camera commands (`setView`, `animateToRegion`, `zoomIn`/`zoomOut`) in
  Leaflet bounds (the host converts regions with `map-geometry.ts`), and on the web the tiles
  (`tile`). Page → host: `ready` (repeated with a per-load `boot` id until the host answers, so a
  message sent before the host listens is never fatal), `markerPress`, `mapPress`, `pinDragEnd`,
  `regionChange` (longitudes of the main world copy), `openLink` (native), `tileRequest` /
  `tileCancel` (web) and `error`, all validated by `parsePageMessage` (channel, shape, ranges,
  size) before any callback runs. Native hosts inject `window.__appMap.receive(<escaped JSON>)` and
  listen to `ReactNativeWebView.postMessage`; the web host uses `postMessage` both ways and accepts
  only its own iframe's messages.
- **Hosts:** the document is built once per mount and never reloaded for prop, theme or language
  changes. The WebView is locked down (https `baseUrl`, no file access or storage, no data
  detectors; `originWhitelist` `*` so that every navigation reaches `shouldStartMapLoad`, which
  loads nothing but the page – the page never navigates, a tapped credit link arrives as `openLink`
  and only the tile and Leaflet credits are opened in the browser). The iframe has no
  `allow-same-origin`, so it has no origin and would send no `Referer`: the web host fetches the
  tiles for it (`web-tile-loader.ts`, app origin as `Referer`, CORS) and passes them as data URLs;
  the page's CSP there is `img-src data:`. Inside scroll views, Android keeps drags through
  `nestedScrollEnabled`, iOS through the scroll lock that `Screen`/`Sheet` provide
  (`ui/scroll-lock.tsx`; the map tracks its own touch ids); inside those, the mouse wheel is left
  to the page (`wheelZoom`).
- **Generated assets** (`leaflet/generated/`, eslint-ignored, committed): Leaflet's JS/CSS and the
  SVG paths of the marker glyphs (every catalog icon + `MAP_EXTRA_ICONS`), written by
  `npm run generate:map-assets` from the `leaflet` and `@mdi/js` dev dependencies. App code never
  imports those packages.
- **Tiles:** `src/constants/map-tiles.ts` (`EXPO_PUBLIC_MAP_TILE_URL` /
  `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`, https only, only the placeholders Leaflet fills, plain-text
  credit that never replaces the OSM one on OSM tiles). The page applies the tile layer last and on
  its own, so a broken layer never costs markers, circles or the pin, and it stops asking for tiles
  a content security policy blocks. The public OSM servers are for light use – production should
  use a tile provider or its own tiles (README → Maps).
- **Tests:** `jest.setup.ts` mocks `react-native-webview` with a prop-exposing View;
  `__test-utils__/map-bridge.ts` plays the page's side. The page runtime itself is tested in jsdom
  with the real document and Leaflet, as seen by both hosts (`leaflet/__tests__/map-page.test.ts`);
  the web host and its tile loader in jsdom too (`leaflet-map.web.test.tsx`); the native navigation
  policy through react-native-webview's own request handler.

## 7. Localization

- i18next + react-i18next, typed keys (`src/i18n/i18next.d.ts`). English is the source of truth;
  Hebrew files are typed `LocaleNamespace<typeof en…>` so missing keys fail type-checking, and every
  `*_other` plural requires a Hebrew `*_two` (dual) form. Hermes (iOS/Android) has no
  `Intl.PluralRules`, so `src/i18n/index.ts` loads the `intl-pluralrules` polyfill first; without it
  the dual forms would never be picked on a phone (Jest and browsers have their own).
- Namespaces (one file per namespace per language): common, errors, validation, auth, settings,
  legal, location, customer, requests, offers, reviews, profile, professional, explore, jobs,
  notifications, messaging. Use `useTranslation(['<ns>', 'common'])` and `t('common:actions.save')`
  for shared keys.
- Zod schemas use translation keys as messages (e.g. `'validation:request.descriptionTooShort'`);
  form fields translate them.
- Category names come from the catalog as `LocalizedText` (`{ en, he }`), so a backend can add
  categories without an app release; use `useLocalizedText()` / `useCategoryName()`.
- RTL: Hebrew forces RTL (`I18nManager.forceRTL`) and reloads the app once (`reloadAppAsync`). The
  app is the only writer of `allowRTL`/`forceRTL`: expo-localization's `supportsRTL` option is off,
  since on iOS it resets `forceRTL` to the device language on every start. On web
  the direction switches live without a reload: `LayoutDirectionRoot` (`src/providers/layout-direction.tsx`)
  wraps the whole tree in a `View dir="rtl|ltr"`, which is what makes React Native Web resolve logical
  styles (`paddingStart`, `start`/`end`, `borderStart*`) for every screen, header, tab bar and portal
  (sheets, dialogs, toasts), and `<html dir lang>` is kept in sync for portal DOM nodes.
- User data inside sentences: wrap names in `isolateText()` (`src/utils/bidi.ts`). User-written
  blocks (descriptions, notes, offer messages, bios) are aligned by their own language: plain text
  with `<AppText userContent>`, custom layouts with `alignForText(text, theme.isRTL)`.
- Hebrew glossary (keep one term per concept; a title and its message must agree):
  - service request: **בקשה** in customer-facing text, **קריאה** in professional-facing text
    (shared `errors:` titles stay role-neutral, so professional screens use their own titles);
  - appointment: **ביקור** (not פגישה/הזמנה); review: **ביקורת** (not חוות דעת);
    withdrawn offer: **נמשכה** (withdraw = משיכה); a cancelled job/request: **בוטלה**;
  - address the user with plural imperatives (gender-neutral) and keep one person within a
    sentence; singular only where the written form is gender-neutral (שלך, בחרת). Never a gendered
    verb or adjective for a named person: use a slash form (אישר/ה), a noun phrase or the passive;
  - quotes are gershayim (״…״).
