# Professionals API

The REST + WebSocket API the app talks to. This page starts with the rules every endpoint shares
(authentication, errors, pagination, limits, realtime) and the list of contract changes against the
app's current types; then one section per module. Source of each rule: `src/` (see
[CONVENTIONS.md](CONVENTIONS.md)); operations and deployment: [OPERATIONS.md](OPERATIONS.md).

## Contents

- [General](#general): base URL, authentication, errors, pagination, rate limits, caching, images, realtime, health
- [Contract changes vs the app's types](#contract-changes-vs-the-apps-types) (summary)
- [Auth](#auth) · [Users](#users) · [Profiles](#profiles-customers-professionals-geo) ·
  [Messaging](#messaging-conversations-notifications-push-realtime) ·
  [Marketplace](#marketplace-requests-offers-jobs-reviews-dashboard) · [Legal](#legal)

## General

### Base URL and formats

- Every endpoint lives under **`/v1`** (the app's `EXPO_PUBLIC_API_BASE_URL` ends in `/v1`), e.g.
  `https://api.example.com/v1/requests`. Health checks (`/health`, `/ready`) and the public pages of
  the legal documents (`/legal/*`) are outside it.
- Requests and responses are JSON (`Content-Type: application/json`, bodies up to 100 KB). Exceptions:
  the routes that take images (`POST /requests`, `PATCH /requests/:id`, `PUT /me/avatar`: multipart,
  see [Images](#images)), the email link pages (`/auth/verify-email`, `/auth/reset-password`: HTML) and
  the legal pages (`/legal/*`: HTML).
- Ids are 24-character hex strings (MongoDB ObjectIds). Timestamps are ISO-8601 UTC strings; calendar
  dates (`preferredSchedule.date`, explorer date filters) are `YYYY-MM-DD` in the market's zone
  (`Asia/Jerusalem`). Money is `{ amount, currency: 'ILS' }`.
- `Accept-Language: en|he` localizes geocoding results; push and email texts use the account's
  language (`PATCH /me`). Error `message`s are English for developers; the app shows its own texts,
  keyed by `code` and the `validation:*` keys in `fieldErrors`.
- Every response carries `X-Request-Id` (the client's own value when it sends a sane one, 8–64
  characters of `[A-Za-z0-9._-]`): quote it when reporting a problem, it is on the server's log line
  of that request.

### Authentication

- `Authorization: Bearer <access token>` on every endpoint except `/auth/*`, `/catalog/categories`,
  `/geo/*` and `/legal/*`. Access tokens are HS256 JWTs valid **30 minutes**; refresh tokens are
  opaque, valid **90 days** (sliding) and rotate on every `POST /auth/refresh`. Details: [Auth](#auth).
- A missing, malformed or expired token, or one whose session was signed out/revoked, answers
  **401 `UNAUTHORIZED`**. Revocation is immediate: logout, refresh-token reuse, a password reset or
  a first Google link of a password account put the session ids on a Redis denylist for the
  remaining lifetime of their access tokens.
- The wrong role answers **403 `FORBIDDEN`** (e.g. a professional calling `/customer/dashboard`), as
  does another user's resource (someone else's request, offer, job, conversation or notification).
  An unknown or malformed id answers **404 `NOT_FOUND`**.

### Errors

Every non-2xx answer has the app's `ApiErrorBody` shape:

```json
{ "code": "VALIDATION_ERROR", "message": "The request payload is invalid",
  "fieldErrors": { "location.addressLine": ["validation:location.addressRequired"] } }
```

| Status | Codes | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query/params rejected by the zod schema, malformed JSON (`fieldErrors.root`), an invalid cursor or limit, operator keys (`$…`) in the input. `fieldErrors` keys are the dotted paths the app's forms use; values are `validation:<key>` i18n keys of the app. |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `INVALID_GOOGLE_TOKEN` | No/invalid/expired/revoked token; wrong email or password (same answer for an unknown email and a Google-only account); an unverifiable Google id token. |
| 403 | `FORBIDDEN` | Wrong role or not your resource. |
| 404 | `NOT_FOUND` | Unknown route, unknown or malformed id; a professional opening a draft request. |
| 409 | `CONFLICT`, `EMAIL_ALREADY_REGISTERED`, `INVALID_STATE_TRANSITION`, `DUPLICATE_OFFER`, `OFFER_EXPIRED`, `REQUEST_NOT_ACCEPTING_OFFERS` | The current state forbids the action (lifecycle rules of the app's mock backend), including the losers of concurrent writes (two accepts, two reviews, two offers). |
| 413 | `VALIDATION_ERROR` | JSON body over 100 KB. |
| 422 | `UNSUPPORTED_CATEGORY`, `OUTSIDE_SERVICE_AREA` | Domain rules the mock reports with these codes (with `fieldErrors`). |
| 429 | `RATE_LIMITED` | See [Rate limits](#rate-limits); `Retry-After` says when to retry. |
| 500 | `SERVER_ERROR` | Unexpected failure; no internals leak, the details are in the server log under the request id. |
| 503 | `SERVER_ERROR` | A provider is not configured (development without Cloudinary/Google) or unreachable (geocoder, Google certificates). Retry later. |

The app's client also produces `NETWORK_ERROR`, `TIMEOUT` and `UNKNOWN` locally; the server never
sends them.

### Pagination

Every list is keyset-paginated: `?cursor=&limit=` → `{ items, nextCursor, totalCount }`.

- `limit`: default **20**, max **100** (the app's `APP_CONFIG.pageSize` / `maxPageSize`; its explorer
  map asks 100). Out of range or not an integer → 400 `fieldErrors.limit`.
- `cursor`: opaque; pass the previous page's `nextCursor` unchanged. `null` means the last page. A
  tampered cursor → 400 `fieldErrors.cursor`. Cursors encode the sort key of the last item, so pages
  stay stable while new items arrive: an inserted item never shifts or repeats the next pages.
- Items whose sort key changes **move**. Lists ordered by a key that changes (`GET /professional/offers`
  and `GET /customer/requests` by `updatedAt`, `GET /conversations` by last activity, the explorer's
  `fewest_offers`) put a changed item at its new position; pages loaded after the change may then miss
  it (it moved before the cursor) or repeat it. Every such change is announced (`offer.updated`,
  `request.updated`, `message.created`), and the client must then reload the list **from the first
  page** (React Query's invalidation of an infinite query does exactly that) and de-duplicate items by
  id (`selectPaginatedList` does). Lists on immutable keys (messages, notifications, reviews, jobs by
  appointment/completion) are exact.
- `totalCount` counts every item matching the filters (not only the remaining ones). It is computed on
  the first page (no `cursor`) and echoed unchanged by the following pages of that walk (it travels in
  the cursor), so "load more" never recounts the whole list; the app reads it from the first page.
- Filters must stay the same between pages of one list; changing them starts over without a cursor.
- Lists that are arrays in the app's current types (`GET /conversations`, `GET /requests/:id/offers`,
  `GET /jobs`) are paginated too; see the contract changes below.

### Rate limits

Counted in Redis (shared by every instance; keys `${APP_ENV}:rl:*`). Over the limit → 429
`RATE_LIMITED` with `RateLimit`/`RateLimit-Policy`/`Retry-After` headers (the service-level budgets
marked * answer 429 without the `RateLimit` headers). If Redis is unreachable, requests pass (availability first).

Signed-in traffic is limited **per user**: many mobile subscribers share one carrier IP (CGNAT), so
per-IP limits are generous and meant for anonymous routes. Limits that name an account never let a
stranger lock its owner out (see the notes below the table).

Every route has a limit of its own on top of the global one: a bucket per route, so a busy screen
never uses up another route's budget. The limits are far above what a person does in the app.

| Scope | Limit |
|---|---|
| Every `/v1` request | 600 / min per user with a valid bearer token, otherwise per IP |
| `POST /auth/login` | 300 / 15 min per IP (all attempts); failed attempts*: 10 / 15 min per (email, IP), 100 / 15 min per IP, 50 / 15 min per email from all IPs (not applied to an IP that signed in to that account in the last 30 days) |
| `POST /auth/register` | 60 / h per IP, 5 / h per (email, IP) |
| `POST /auth/google` | 120 / 15 min per IP |
| `POST /auth/refresh` | 30 / 15 min per session, 3000 / 15 min per IP |
| `POST /auth/password-reset` | 30 / h per IP; reset emails*: 3 / h per address (past it: still 200, no email) |
| `POST /auth/reset-password` | 300 / 15 min per IP |
| `GET /geo/search`, `GET /geo/reverse` (together) | 60 / min per IP; cache misses* (provider calls): 15 / min per IP, or 30 / min per signed-in user |
| Routes that take images (`POST /requests`, `PATCH /requests/:id`, `PUT /me/avatar`, together) | 60 / h per user, counted before the body is read; 2 at once per user*; 200 MB of stored images / day per user* (see [Images](#images)) |
| `POST /requests` | 30 / h per customer |
| `POST /requests/:id/offers` | 60 / 10 min per professional |
| `POST /conversations/:id/messages` | 60 / min per user |
| Other signed-in reads (lists, details, counts, dashboards, profiles), each route | 120 / min per user |
| `GET /professionals`, `GET /professional/requests/nearby` (geospatial searches), each route | 60 / min per user |
| Other signed-in changes (profile edits, `/me/avatar`, `/me/devices`, draft edits, publish, cancel, offer and job steps, reviews, `POST /notifications/read-all`), each route | 30 / min per user |
| `POST /conversations/:id/read`, `POST /notifications/:id/read` (read markers), each route | 120 / min per user |
| `POST /auth/verify-email/resend` | 3 / h per user |
| `POST /me/deletion` | 30 / min and 5 / h per user; a wrong password also counts as a failed sign-in (the `POST /auth/login` budgets, from the same IP) |
| `POST /auth/logout` | 600 / 15 min per IP |
| `GET /catalog/categories` | 300 / min per user when signed in, otherwise per IP |
| `GET /v1/legal/:document` | 300 / min per user when signed in, otherwise per IP |
| `GET /legal/:document` (public pages) | 300 / min per IP; over it, an HTML page |
| `GET /auth/verify-email`, `POST /auth/verify-email`, `GET /auth/reset-password` (pages opened from the emails), each route | 300 / 15 min per IP; over it, an HTML page (also for `POST /auth/reset-password` form posts) |
| `GET /health`, `GET /ready`, each route | 300 / min per IP, counted in each instance's memory (not Redis) |
| `GET /v1/realtime` (WebSocket upgrades) | 60 / min per user |

- **Only failed sign-ins count**, so the owner's correct password never uses a budget up. The strict
  budget is per (email, IP); the account-wide one skips IPs the owner signed in from. A password
  reset (which proves the mailbox) clears the account-wide budget and the (email, IP) one of the IP
  the reset was completed from, so an owner blocked on their own phone who resets the password there
  signs in right away. Google sign-in and existing sessions are never affected.
  A blocked sign-in (also with the right password) answers 429 with `Retry-After` = the seconds left
  in the blocking 15-minute window; the app says when to try again and offers "Forgot password?".
- **Reset emails**: a new reset link does not invalidate the earlier ones (each stays valid for its hour
  until one is used), so someone requesting resets for another person's address can neither block nor
  break the owner's reset.
- The per-session refresh key only counts genuine tokens: a forged token naming a session never uses
  that session's budget.

Deployed environments must set `TRUST_PROXY` to their proxies (hop count or subnets, see
OPERATIONS.md); `true` is refused, since it would let any client choose the IP the limits see.

### Caching

- `GET /catalog/categories`: `ETag` + `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`;
  `If-None-Match` → 304.
  The catalog is a code constant (versioned), never a database read.
- `GET /geo/*`: `Cache-Control: private, max-age=3600` (the caller's device may keep an answer; a
  shared cache such as a CDN must not store the addresses people type), `Vary: Accept-Language`; results are cached
  in Redis: reverse lookups 30 days (points rounded to ~11 m), address searches 7 days (one entry per
  query, whatever `limit`), empty answers 1 day. Only cache misses reach the provider (≤ 1/s for all
  instances); anonymous callers may use at most half of that rate, so sign-ups can never starve
  signed-in users.
- Public professional profiles are cached 60 s in Redis and dropped on every profile or stats change.
- `GET /v1/legal/:document` and the pages `/legal/*`: `Cache-Control: public, max-age=300`,
  `Vary: Accept-Language` (the texts only change with a deploy).
- Everything else is private and not cached (`Cache-Control` is not set; clients should not cache).

### Images

An image is sent **with the thing that owns it** and stored only there, as `{ url, publicId }`
(`publicId` deletes it from storage).

| Route | Body (`multipart/form-data`) | Stored on |
|---|---|---|
| `POST /requests`, `PATCH /requests/:id` | text field `data` = the JSON payload; files `photos` (0–6) | `requests.photos` |
| `PUT /me/avatar` | one file `avatar` | `users.avatar` |

- JPEG, PNG, WebP or HEIC/HEIF, at most **8 MB per file**; the type is read from the file's bytes, not
  from the declared type or name. Stored on Cloudinary under `professionals/<APP_ENV>/requests|avatars`,
  longest edge ≤ 2048 px.
- Every file is checked, and the JSON payload validated, before anything is stored; if storing or
  saving fails afterwards, what was stored is deleted again (unless the save may have been committed
  after all: then only what the owner does not show is deleted). An image the owner no longer shows (a
  photo removed from a draft, a deleted draft, a cancelled request, a replaced or removed avatar) is
  deleted from storage, and from the CDN cache, after the change is committed (best effort: a failure
  is logged with its public ids).
- The whole body may take up to 10 min to arrive (the app allows 90 s per photo).
- Errors, in the app's field format. **Every refusal about the images names the file field**
  (`photos` or `avatar`) in `fieldErrors`, whatever its status; errors without it are about the rest
  of the post (a form field, the `POST /requests` rate limit, …) and the app handles them as usual:

| Status | Body | When |
|---|---|---|
| 400 | `fieldErrors.photos` / `.avatar = ['validation:upload.invalid']` | not an image (any file of the request), missing avatar, a second avatar |
| 400 | `fieldErrors.photos = ['validation:request.tooManyPhotos']` | more than 6 photos on the request |
| 400 | `fieldErrors.<name> = ['validation:upload.invalid']` | a file in another field |
| 400 | `fieldErrors.data = ['validation:required' \| 'validation:invalid']` | not multipart, `data` missing, not a JSON object |
| 413 | `fieldErrors.photos` / `.avatar = ['validation:upload.invalid']` | a file over 8 MB, or a declared body larger than a post can be (answered before reading it) |
| 429 | `RATE_LIMITED`, `fieldErrors.photos` / `.avatar = ['validation:upload.rateLimited']`, `Retry-After` | 60 image posts / h per user, or 2 already running for this user (both before the body is read), or the post's files would pass 200 MB stored today (checked once the post is valid; a refused post is not counted) |
| 503 | `SERVER_ERROR`, `fieldErrors.photos` / `.avatar = ['validation:upload.unavailable']` | storage not configured (development without Cloudinary: answered at the first file, before its bytes are read) or the provider failed; with `Retry-After` when the server is busy with other uploads (its memory budget for image posts in flight) |

### Realtime (WebSocket)

`ws(s)://<host>/v1/realtime`, on the same server and port as the API. The app offers two WebSocket
subprotocols, `professionals.v1` and `bearer.<access token>`; the server selects `professionals.v1`
(the token is never echoed back). `?token=<access token>` is still accepted for app versions released
before this change, but it puts the token in the URL (access logs: OPERATIONS.md §4).

- The token is checked on connect: missing, invalid, expired or revoked → close code **4001**. An open
  socket is closed with **4001** when its token expires (the app refreshes and reconnects) and when its
  session is signed out or revoked (on every instance). Code **1001** means the server is shutting
  down (reconnect).
- Frames are server → client JSON, exactly the app's `RealtimeEvent` union: `notification.created`,
  `message.created`, `conversation.read`, `request.updated`, `offer.updated`, `job.updated`,
  `profile.updated`. They are sent after the transaction that caused them commits. Client frames are
  ignored (max 4 KB).
- Ping every 30 s; a socket that misses a pong is dropped. Delivery is best effort: after a
  reconnect the app refetches what it shows.
- Several instances fan out through Redis pub/sub (`${APP_ENV}:realtime`). Details:
  [Messaging → Realtime](#realtime-get-v1realtimetokenaccess-token-websocket).

### Health

- `GET /health` → 200 `{ status: 'ok' }` while the process runs (liveness).
- `GET /ready` → 200 `{ status: 'ready', checks: { mongo: 'ok', redis: 'ok' } }`, or 503
  `{ status: 'unavailable', checks }` when MongoDB or Redis does not answer (readiness: take the instance out of the load balancer).
- Both: 300 / min per IP, counted in the instance's memory, so a Redis outage never fails a probe.

## Contract changes vs the app's types

The server implements every call in `frontend/src/services/api/endpoints/*` except the demo ones
(`GET /auth/demo-accounts`, `POST /auth/demo-login`). `npm run typecheck` includes a compile-time
check (`test/contract/frontend-contract.check.ts`, also run by `.github/workflows/ci.yml`) that every
response DTO (including `POST /auth/refresh`, `/customer/profile` and the push `data`, `PushData`) is
assignable to the app's type, every app payload is accepted by the server's schema, and every query
parameter the app sends (`WireQueries`, by wire name) is read by the server's query schema. These are the differences the app's
next phase has to adopt (details in each module's section):

| Area | Change | App change needed |
|---|---|---|
| Auth | `AuthSession` adds `accessTokenExpiresAt` + `refreshToken`; new `POST /auth/refresh` (rotating refresh token); `POST /auth/logout` takes `{ refreshToken? }`. | Store the refresh token in secure storage, single-flight refresh on 401 / before expiry, send it on logout. |
| Auth | `POST /auth/register` answers 201; `VALIDATION_ERROR` is 400 (mock: 422). No demo endpoints. | None (the client handles both statuses). |
| Users | New `PATCH /me { preferredLanguage }` and `DELETE /me/devices/:token`; `POST /me/devices` accepts only Expo push tokens. | Call `PATCH /me` when the language changes; register real Expo tokens only (not the simulated provider, not web). |
| Images | Photos travel with `POST /requests` / `PATCH /requests/:id` (multipart `data` + `photos`), the avatar has `PUT`/`DELETE /me/avatar`; the profile PATCHes have no `avatarUrl`. `RequestPhoto` is `{ publicId, url }`. See [Images](#images). | Done in the app. |
| Profiles | `GET /geo/reverse` answers 404 where there is no address. | None (already the app's error path). |
| Lists | `GET /conversations`, `GET /requests/:id/offers`, `GET /jobs` return `Paginated<…>` instead of arrays. | Use infinite queries (cache helpers map `pages[].items`); `.items` of one page is enough only for offers (`limit=100`). The Work tab takes "earned this month" from the professional dashboard (marketplace change 2). |
| Inbox | New `GET /conversations/unread-count` → `{ count }`. | The messages badge uses it instead of summing the paginated list. |
| Push | Push `data` is `{ notificationId, notificationType, target }`. | The Expo provider copies it into `PushMessage`. |
| Realtime | Close code 4001 = the token expired or the session was revoked. | On 4001 refresh the access token before reconnecting (today's client retries every 3 s with the same token); stop on a failed refresh. |
| Limits | New 429 limits (see [Rate limits](#rate-limits)); `maxDistanceKm` only takes the app's presets. | Show the generic error. |
| Time | Calendar rules use `Asia/Jerusalem` instead of the device zone. | None for Israeli users. |
| Users | New `GET /me/deletion-impact` and `POST /me/deletion` (account deletion, [Users](#users)); `accountDeleted` on `CustomerSummary`, `ProfessionalSummary` and `ConversationParticipant`, `customerAccountDeleted` on `Review` (the server's placeholder name is "Deleted user"). | The types are in `frontend/src/types` (the flags optional); screens: Settings → Delete account, "Deleted user" labels, no profile link. |
| Privacy | `CustomerSummary` has no `city`; the public `ProfessionalProfile` has no `fullName` (only `OwnProfessionalProfile`); a public profile carries `contact` only for a customer with a job with the professional that was not cancelled. `POST /requests/:id/cancel` takes a `CustomerCancellationReason`; a request's `cancellationReason` may also be `account_deleted`. New notification type `job_cancelled`. | Done in the app's types, notification presenter and translations. |

## Auth

Public endpoints (no `Authorization` needed) under `/v1/auth`. Source: `src/modules/auth`.

### Tokens and sessions

- **Access token**: JWT (HS256), valid **30 minutes**, sent as `Authorization: Bearer <token>` (and as
  the `bearer.<token>` subprotocol for `/v1/realtime`; older apps: `?token=`). Claims: `sub` (user id), `role`, `sid` (session id), `typ: "access"`,
  `iss`, `aud`. It is verified without a database hit; one Redis lookup refuses tokens of sessions that
  were signed out or revoked, so revocation takes effect immediately (the denylist entry outlives the
  longest remaining access token: 31 minutes).
  `iss`/`aud` default to `professionals-api:<APP_ENV>` / `professionals-app:<APP_ENV>`, so a token of one
  environment is refused by another even if they shared a secret by mistake.
- **Refresh token**: opaque to the app (91 characters: `<session id>.<256-bit secret>.<server
  signature>`; store and send it as is), valid **90 days, sliding**: every refresh returns a new one
  and extends the session to now + 90 days. The server stores only SHA-256 hashes (`sessions`
  collection, one document per signed-in app install with its push token, TTL-deleted when expired).
- **Reuse detection**: every token names its session and is signed by the server, so presenting
  **any** earlier token of a live session — however many rotations ago — means two parties hold it:
  the whole session is revoked (with its push token) and the answer is 401. A thief who
  refreshes a stolen token (even several times) is cut off as soon as the owner's app presents its
  own token. A forged token naming someone's session is simply refused (401) and revokes nothing.
- **Concurrent refresh / lost response**: presenting the token the last refresh replaced, while the
  token that refresh issued has **not been used yet** and at most 30 minutes (an access token's
  lifetime) after that refresh, answers 200 again with the **same** new refresh token (and a fresh
  access token). Two tabs refreshing at once, or a retry after a response that never arrived (a
  network that dropped mid-response, the app suspended or killed during the refresh, then offline for
  a while), therefore end up with one token, never two diverging ones, and no false theft alarm. Once
  the new token has been used, or after 30 minutes, the old one is a replay (above). Clients should
  still refresh one at a time and store the new token before using it.
- One session per sign-in (per device). Signing out deletes it, and with it the install's push token;
  a password reset, or the first Google link of a password account, deletes all sessions of the account.

### Contract changes vs the app's types (`frontend/src/types/api/auth.ts`)

| # | Change | App impact |
|---|---|---|
| 1 | `AuthSession` = `{ accessToken, accessTokenExpiresAt, refreshToken, user }` (login, register, Google `signed_in`). | Store the refresh token (secure storage); refresh before `accessTokenExpiresAt` or on 401. |
| 2 | New `POST /auth/refresh`. | Add a single-flight refresh in `ApiClient`. |
| 3 | `POST /auth/logout` takes `{ refreshToken? }`. Without it, the bearer token's session is revoked (what the current app sends). | Send the refresh token. |
| 4 | `POST /auth/register` answers **201** (the mock 200). `VALIDATION_ERROR` is **400** (the mock 422); both are handled by the app's client. | None. |
| 5 | `GET /auth/demo-accounts`, `POST /auth/demo-login` do not exist. | Demo UI already hides itself in `http` mode. |
| 6 | New server pages `GET`/`POST /auth/verify-email`, `GET`/`POST /auth/reset-password` (opened from emails, not by the app). | None. |
| 7 | Refresh tokens are 91 characters (`<session>.<secret>.<signature>`), still opaque. | None (store and send as received). |
| 8 | `GET /me` adds `emailVerified`; new `POST /auth/verify-email/resend` (signed in). | Settings shows "Verify your email" with a resend button under "Email updates" while it is `false`. |

### `POST /auth/register` → 201 `AuthSession`

Body: `RegisterRequest` (validated with the same rules as the app's `registerRequestSchema`, parity-tested):
`role`, `firstName`, `lastName` (2–40, letters/space/-/'), `email` (trimmed, lower-cased), `phone`
(Israeli or E.164), exactly one of `password` (8–64, a letter and a digit, not a common password) and
`googleIdToken`, `acceptedTerms: true`, `preferredLanguage` (`en`|`he`), and `professional`
(`{ businessName|null, categoryIds 1–10, baseLocation, serviceRadiusKm 3–80 }`) iff `role = professional`.
After the app's rules pass, the server also rejects a password found in a known data breach
(Pwned Passwords k-anonymity API: only 5 characters of the password's SHA-1 leave the server) with
`fieldErrors.password = ["validation:auth.passwordTooCommon"]`; the check fails open when the service
is unreachable and can be switched off with `PASSWORD_BREACH_CHECK=false`.

In one transaction: the user (argon2id password hash, `language = preferredLanguage`, default
notification preferences), for professionals the profile (display name = business name or full name,
service area centered on the base location with the given radius and the city as label, default
availability, contact = sign-up phone + email, `business.languages = [preferredLanguage]`, zero stats,
not verified), and the first session. The accepted terms are recorded on the user
(`termsAcceptance { version, acceptedAt }`, `version` = `LEGAL_CONFIG.effectiveDate` of
`src/config/legal.ts`), for password and Google sign-ups alike. Password sign-ups then get a
verification email (en/he by `preferredLanguage`); Google sign-ups are verified (Google's
`email_verified`) and take the Google avatar.

| Error | When |
|---|---|
| 400 `VALIDATION_ERROR` + `fieldErrors` (`email`, `password`, `professional.categoryIds`, `professional.baseLocation.city`, …, messages `validation:*`) | invalid payload; all problems at once |
| 422 `UNSUPPORTED_CATEGORY` (`fieldErrors["professional.categoryIds.<i>"]`) | category outside the catalog |
| 409 `EMAIL_ALREADY_REGISTERED` + `fieldErrors.email = ["validation:auth.emailTaken"]` | address (any case) or Google account already registered, also for a concurrent duplicate sign-up |
| 401 `INVALID_GOOGLE_TOKEN` | Google token invalid/expired, or its email differs from `email` |
| 503 `SERVER_ERROR` | Google sign-up while Google is not configured (development only) |
| 429 `RATE_LIMITED` | 60/h per IP, 5/h per (email, IP) |

### `POST /auth/login` → 200 `AuthSession`

Body `{ email, password }`. 401 `INVALID_CREDENTIALS` (same body and same argon2 work) for an unknown
email, a wrong password and a Google-only account. Hashes made with older argon2 parameters are
upgraded on success. 400 for an empty email/password. 429 `RATE_LIMITED` before the password is checked
when a failed-attempt budget is used up (see [Rate limits](#rate-limits): per (email, IP), per IP, and
per email except from IPs that signed in to the account before); a correct password never counts.

### `POST /auth/google` → 200 `GoogleAuthResponse`

Body `{ idToken }` (Google id token; signature, `aud` ∈ web/iOS/Android client ids, issuer, expiry and
`email_verified` are checked). Linking rules (BACKEND_INTEGRATION.md §3):
1. an account linked to this Google `sub` → `{ status: 'signed_in', session }` (matched by `sub` only);
2. an account with the email but linked to another `sub` → 401 `INVALID_GOOGLE_TOKEN`;
3. an email + password account → linked and `signed_in`. Google proves who owns the address, not who
   holds the account's sessions (someone may have registered the address first: pre-account hijacking),
   so **every earlier session of the account is revoked** (with its push token) on this first link. If the
   email was **not verified**, the password is removed too and the email marked verified; a verified
   account keeps its password (verifying takes a deliberate click, see the pages below);
4. unknown → `{ status: 'registration_required', profile: { email, firstName, lastName, avatarUrl } }`.

Errors: 400 without `idToken`, 401 `INVALID_GOOGLE_TOKEN`, 503 when Google is not configured
(development without client ids), 429 over 120/15 min per IP.

### `POST /auth/refresh` → 200 `{ accessToken, accessTokenExpiresAt, refreshToken }`

Body `{ refreshToken }`. 401 `UNAUTHORIZED` for an unknown, expired, revoked, forged or replayed token
(see reuse detection; the replay of the just-replaced token, while its successor is unused and within
30 min, answers 200 with the same new token); 400 without a token; 429 over 30/15 min per session or 3000/15 min per IP.

### `POST /auth/logout` → 200 `{ success: true }`

Body `{ refreshToken? }`; also reads an optional valid bearer token. Revokes that session (any refresh
token the server issued for it works) and with it the push token it registered, so a signed-out phone
stops receiving the account's notifications. Always succeeds (idempotent, no auth).

### `POST /auth/password-reset` → 200 `{ success: true }`

Body `{ email }`. Always the same answer, immediately: the lookup and the email happen in the
background, so neither the answer nor its timing tells whether the address has an account. When it
has, a single-use link valid **60 minutes** is emailed (en/he by the account's language). A newer link
does **not** invalidate the earlier ones (a stranger requesting resets for the address must not break
the link its owner is about to open); a successful reset ends them all. At most 3 emails per address
and hour: past that the answer is still 200 and nothing is sent (the links already sent stay valid).
Google-only accounts can set a password this way. 400 for an invalid email; 429 over 30/h per IP.

### `POST /auth/verify-email/resend` → 200 `{ success: true }` (signed in)

Sends a new verification link to the caller's address (the sign-up link expires after 48 h), in the
account's language; nothing is sent when the address is already verified (same answer; the app
refetches `/me`). 401 without a valid access token; 429 over 3/h per user.

### Email link pages (server-rendered HTML, en/he, RTL for Hebrew, `Cache-Control: no-store`)

- `GET /auth/verify-email?token=` — a confirmation page in the account's language (the address and a
  "Confirm email address" button; "didn't create an account? don't confirm"). **Opening the link
  verifies nothing**: mail gateways prefetch links, and a verified address makes Google linking keep the
  account's password. 400 page (browser language) for an unknown, expired (48 h) or used link.
- `POST /auth/verify-email` (the button, form-encoded `{ token }`) — marks the email verified (first time
  only) and uses the link up: 200 success page, or 400 invalid-link page.
- `GET /auth/reset-password?token=` — the new-password form (never uses the link up, so email
  scanners prefetching links cannot burn it); 400 page for an invalid link.
- `POST /auth/reset-password`:
  - form-encoded `{ token, password, confirmPassword }` (the page's form) → HTML: 400 with the form and
    translated field errors (same rules and wording as the app), 400 invalid-link page, or 200 success;
  - JSON `{ token, password }` → 200 `{ success: true }`, 400 `VALIDATION_ERROR` with
    `fieldErrors.password` or `fieldErrors.token = ["validation:invalid"]` (invalid/expired/used link).
  - Both reject a breached password like sign-up does (the link stays usable).
  - Success: new argon2id hash, email marked verified (the link proves the mailbox), link consumed,
    **every session of the account revoked** (with its push token), every other reset link ended, and the
    account's failed sign-ins forgotten. 300/15 min per IP.

No lists here, so no pagination.

## Users

Authenticated (`Authorization: Bearer`). Source: `src/modules/users`. Once an account is deleted its
access tokens are refused at once (session denylist); `GET`/`PATCH /me`, `/me/avatar`, `POST /me/devices`
and the deletion routes also answer 401 by themselves, which covers a Redis outage.

### `GET /me` → 200 `CurrentUserResponse`

`{ user, emailVerified, customerProfile, professionalProfile }` exactly as the app's type
(`emailVerified`: the sign-in address was confirmed by its verification link, a password reset link or
Google; "Email updates" only go
to confirmed addresses, so the app asks to verify under that toggle): customers get
`customerProfile` (default location, `savedLocations: []`, notification preferences, stats counted from
requests/jobs), professionals the complete own `professionalProfile` (`user.displayName` = profile
display name). 401 when the token is missing/invalid/expired or the account no longer exists; 404 if a
professional's profile is missing.

### `PATCH /me` → 200 `CurrentUserResponse` (addition, not in the app yet)

Body `{ preferredLanguage: 'en' | 'he' }`. The language of push notifications and emails; the app should
call it when the user switches language (it is otherwise the sign-up language). 400 for another value.
Notification preferences stay on `PATCH /customer/profile` / `PATCH /professional/profile`.

### `PUT /me/avatar` → 200 `CurrentUserResponse`

Multipart with one image in the field `avatar` ([Images](#images)); stored as the account's
`{ url, publicId }` under `…/avatars`. The previous avatar is deleted from storage when it was ours
(a Google profile picture has no `publicId` and is only unlinked). Answers like `GET /me` (the new
`user.avatarUrl`; for professionals also `professionalProfile.avatarUrl`). A professional's cached public
profile is dropped and `profile.updated` goes to their apps. Concurrent changes: the last one wins and
each deletes the image it replaced.

```http
PUT /v1/me/avatar
Content-Type: multipart/form-data; boundary=…

--…
Content-Disposition: form-data; name="avatar"; filename="me.jpg"
Content-Type: image/jpeg

<bytes>
```
→ `200 { "user": { "id": "…", "avatarUrl": "https://res.cloudinary.com/…/avatars/abc.jpg", … }, "emailVerified": true, "customerProfile": { … }, "professionalProfile": null }`

Errors: 400/413/429/503 as in [Images](#images); 401 (also when the account no longer exists).

### `DELETE /me/avatar` → 200 `CurrentUserResponse`

Removes the avatar (deleted from storage when it was ours); idempotent.

### `POST /me/devices` → 200 `{ success: true }`

Body `{ pushToken, platform: 'ios' | 'android' | 'web' }` (`RegisterDeviceRequest`). Stores the token
on the caller's session (the one of the access token: one signed-in app install, one token; a new token
from the same install replaces the previous one). A token registered by another session, e.g. another
account on the same phone, moves to the caller; concurrent registrations are safe. The platform is
validated but not stored. The token goes away with the session: signing out, a revocation or expiry (90
days without a refresh) all stop the pushes. 400 `fieldErrors.pushToken = ["validation:invalid"]` when
it is not an Expo push token (`ExponentPushToken[…]`): the app's simulated provider (`simulated:*`) must
not register in `http` mode, and web (no Expo push) should not register at all. 401 when the caller's
session has ended (like every authenticated endpoint).

### `DELETE /me/devices/:token` → 200 `{ success: true }` (addition)

URL-encoded token. Removes the token from the caller's session that holds it (any of the account's
sessions; they stay signed in); idempotent, never touches another account's session. The request log
masks the token in the path (`/v1/me/devices/[REDACTED]`).

### `GET /me/deletion-impact` → 200 `AccountDeletionImpact` (addition)

What deleting the account now would change, read by the same queries the deletion runs
(`account-deletion.impact.ts`), and how to confirm it:

```json
{
  "role": "customer",
  "reauthentication": { "password": true, "google": false },
  "requestsToCancel": { "count": 2, "items": [{ "id": "…", "requestId": "…", "categoryId": "plumbing", "status": "scheduled", "date": "2026-10-01T09:00:00.000Z", "counterpartName": "Avi Fix" }] },
  "offersToDecline": 3,
  "draftsToDelete": 1,
  "jobsToCancel": { "count": 1, "items": [{ "id": "…", "requestId": "…", "categoryId": "plumbing", "status": "scheduled", "date": "2026-10-03T07:00:00.000Z", "counterpartName": "Avi Fix" }] }
}
```

- Customer: `requestsToCancel` (`open`, `offers_received`, and those with an active job:
  `professional_selected`, `scheduled`, `in_progress`; newest first), `offersToDecline` (their pending
  offers), `draftsToDelete`, `jobsToCancel` (`awaiting_confirmation`, `scheduled`, `in_progress`; soonest
  first).
- Professional: `{ role: 'professional', reauthentication, offersToWithdraw, jobsToCancel }`:
  every pending offer (also one past its expiry time the cron has not expired yet), newest first.
- `items`: the first 20 of each list (`count` covers all). `date`: a request's publication (creation
  for none), an offer's proposed start, a job's scheduled start. `counterpartName`: the hired
  professional's display name or the customer's short name ("Noa L."); `null` for a request nobody
  was hired for.
- `reauthentication`: `password` = the account has a password; `google` = it is linked to Google.

Errors: 401 (also for a deleted account).

### `POST /me/deletion` → 200 `{ success: true }` (addition)

Deletes the caller's account at once; it cannot be undone. Body `{ password?: string, googleIdToken?: string }`
(`DeleteAccountRequest`): accounts with a password send `password` (or a Google `idToken` of the
Google account linked to them); Google-only accounts send a fresh `googleIdToken` whose `sub` is the
linked Google account. Refusals are **400, never 401** (the app refreshes the access token on a 401):

| Situation | Answer |
|---|---|
| No proof sent | 400 `fieldErrors.password = ["validation:auth.passwordRequired"]` (password accounts) or `fieldErrors.googleIdToken = ["validation:required"]` (Google-only) |
| Wrong password | 400 `fieldErrors.password = ["validation:auth.passwordIncorrect"]`; counts as a failed sign-in of the account from this IP, so the [sign-in throttle](#rate-limits) answers 429 (`Retry-After`) once it is used up |
| A Google token of another account, expired or forged | 400 `fieldErrors.googleIdToken = ["validation:invalid"]` |
| Google unreachable | 503 |
| The account is already deleted (a second submit, another device) | 401 |
| More than 5 attempts in an hour | 429 |

One MongoDB transaction does everything (all or nothing); the other parties are notified with an
empty name, so their texts say "A customer" / "A professional":
- **Customer**: every active request cancelled (`cancellationReason: account_deleted`) as
  `POST /requests/:id/cancel` does: pending offers `rejected` (`request_cancelled`), an active job —
  `in_progress` too — `cancelled` and its chat closed, `request_cancelled` to those professionals;
  then every request no professional made an offer on (drafts too, whatever its status) is deleted
  with its photos: it is in nobody else's history (a professional who opens it later gets 404).
- **Professional**: every pending offer `withdrawn` (`withdrawn_by_professional`), `offer_withdrawn` to
  the customer; every active job (`in_progress` too) and its request `cancelled`
  (`account_deleted`; the request's photos deleted), `job_cancelled` to the customer.
- **Both**: every chat of the user closed (also those of completed jobs); the user's notifications,
  email links and sessions (push tokens) deleted, open sockets closed; the avatar deleted from storage.
- **Meanwhile, from another device**: a request, offer, review or acceptance being created writes the
  account first, as the deletion does, so the two never both commit unseen: either it answers 401 (the
  account is gone, photos already uploaded are deleted again), or it commits first and the deletion
  handles it like the rest (cancels the request, withdraws the offer, removes the review's comment).

What stays, without the person (the Privacy Policy says exactly this):
- The account becomes a tombstone: `_id`, `role`, `language`, `createdAt`, `deletedAt`; the email is
  replaced by a unique unroutable placeholder, so the real address and the Google account can sign up
  again as a new account; names, phone, password, Google link, verification, avatar, default address
  and terms acceptance are removed, every notification setting is off. Signing in with the old
  credentials answers like an unknown account.
- Other users see the person as **"Deleted user"** with `accountDeleted: true`
  (`customerAccountDeleted` on reviews) and no avatar, in jobs, offers, requests, chats and reviews.
- A customer's requests that received offers keep their description, category, dates, status, city
  and neighbourhood and the approximate pin (the same one professionals saw before, `isApproximate: true` for everyone,
  the hired professional too); the exact point, street address, access details, notes, cancellation comment,
  photos (deleted from storage) and idempotency key are removed. Completed jobs (category, dates,
  agreed price) stay in the professional's history. Their reviews keep the rating (the professional's
  stats do not change) and lose the comment.
- A professional's profile keeps its stats but no categories, headline, bio, contact, business
  details, base address, starting price or exact service-area center; it leaves every search and
  match, `GET /professionals/:id` and its reviews list answer 404, and completed jobs of theirs can no
  longer be reviewed (`canReview: false`, `POST /jobs/:id/review` → 409). Their offers keep price and
  dates and lose the message.
- Chat messages the person sent stay visible to the other participant.
- These records stay while another party to them has an account. When the deleted account's other
  party is deleted already, the deletion also deletes what only the two shared: their jobs with the
  reviews of those jobs, their chats with every message, the offers between them, and the deleted
  customer's requests left without an offer (`account-purge.ts`). A request that still has an offer of
  a professional with an account stays for them (its accepted offer and job may be gone).
- Copies of the person's name or message previews inside other users' notifications expire with the
  90-day notification TTL; login-throttle keys (hashed email) within 30 days; logs and backups as in
  OPERATIONS.md.

After the commit a confirmation email goes to the address the account had, in its language; best
effort. It says who asked ("As you asked in the app"; the operator's deletions say "As you asked by
email", or, for an account closed under the Terms, only that it was deleted), what was closed (only
when something was: the customer's requests, the offers declined and the jobs cancelled; the
professional's offers withdrawn and jobs cancelled), what was deleted, what stays, and the operator's
contact address from `src/config/legal.ts`. The operator runs the same deletion with
`src/delete-account.ts` (OPERATIONS.md §9), without the email when re-applying it after a backup
restore.

## Profiles (customers, professionals, geo)

Module owners: `src/modules/customers`, `src/modules/professionals`, `src/modules/geo` (the avatar is
`PUT /me/avatar`, [Users](#users)).
Types below are the app's (`frontend/src/types`); field errors carry `validation:*` keys as everywhere.

### `GET /customer/profile` — customer
`200 { user: User, profile: CustomerProfile }`. `profile.stats` is counted live (published requests,
completed jobs). `savedLocations` is always `[]` (the app never reads or writes saved addresses).
Errors: 401, 403 (professional).

### `PATCH /customer/profile` — customer
Body `UpdateCustomerProfilePayload`, every field optional: `firstName`, `lastName` (1–60, trimmed),
`phone` (Israeli or E.164), `defaultLocation` (`ServiceLocation` without `isApproximate`, or `null`
to clear), `notificationPreferences` (all six booleans). Response as `GET`. Errors: 400
`VALIDATION_ERROR` (e.g. `defaultLocation.addressLine`, `notificationPreferences.messages`), 401, 403.

### `GET /professional/profile` — professional
`200 OwnProfessionalProfile` (exact base location, contact, notification settings).

### `PATCH /professional/profile` — professional
Body `UpdateProfessionalProfilePayload` (every field optional), the rules of the app's
`updateProfessionalProfileSchema`: `fullName` (2+ words, ≤ 60), `displayName` (≤ 60), `headline`
(≤ 80, may be empty), `bio` (empty or 30–1000: sign-up asks for neither, the public profile hides
them while empty), `categoryIds` (1–10 catalog ids, de-duplicated), `yearsOfExperience`
(integer 0–60), `serviceArea` (`center`, `radiusKm` 3–80, `label`), `baseLocation` (or `null`),
`availability` (times `HH:mm` on enabled days, end after start, at least one working day),
`contact` (`phone`, `email` lower-cased, `website` stored with `https://`), `business`
(`businessName` ≤ 80, `licenseNumber` letters/digits ≤ 30, `isInsured`, `languages` 1–20 ISO codes,
lower-cased, de-duplicated), `startingPrice` (`{amount, currency}` with the offer price rules, or
`null`), `notificationPreferences`.
`200 OwnProfessionalProfile`. Side effects: `fullName` → account first/last name (first word / the
rest), `contact.phone` → account phone (the sign-in email never changes), realtime
`profile.updated` to the professional, the cached public profile is dropped.
Errors: 400 `VALIDATION_ERROR`, 422 `UNSUPPORTED_CATEGORY` (`categoryIds.<i>`), 401, 403.

### `GET /professionals/:professionalId` — any signed-in user
`200 ProfessionalProfile` as the viewer may see it (same rules as the app's `views.ts`):
- everyone but the owner: approximate `serviceArea.center` (deterministic 250–450 m offset, the same
  for every viewer, derived from `LOCATION_PRIVACY_SECRET` so it cannot be undone from the id; stored
  when the area is saved) and approximate `baseLocation` at that same point (no street, no details,
  `isApproximate: true`);
- `contact` is `null` unless the viewer is a customer who hired the professional: a job with them in
  `awaiting_confirmation`, `scheduled`, `in_progress` or `completed` (not after a cancellation);
- `fullName` and `notificationPreferences` are never included (also not for the owner; both are in
  `GET /professional/profile`); `business.licenseNumber` is.
The viewer-independent view is cached in Redis for 60 s and dropped on profile edits.
Errors: 404 (unknown or malformed id, a customer's id, or a deleted account), 401.

### `GET /professionals/:professionalId/reviews?cursor=&limit=` — any signed-in user
`200 Paginated<Review> & { breakdown: RatingBreakdown }`, newest first (keyset on `createdAt, _id`).
`breakdown` covers all reviews (average rounded to 0.1, `null` without reviews) and comes from
per-star counters kept on the professional (no review is re-read); `totalCount === breakdown.reviewCount`
on every page. `customerDisplayName` is the short name ("Noa L."),
reviewer name and avatar are always current (a deleted reviewer: "Deleted user", `customerAccountDeleted: true`).
Errors: 404 (also a deleted professional), 400 (`limit`, `cursor`), 401.

### `GET /professionals?categoryId=&lat=&lng=&cursor=&limit=` — any signed-in user
`200 Paginated<ProfessionalSummary>`, best ranked first: Bayesian rating (`stats.rankScore`), then
review count, then id. With `lat` + `lng` only professionals whose own service radius covers the
point are listed, and nearer ones come first among equals (a single coordinate is ignored, as in the
app). "Covers" and "nearer" are measured from the **approximate** service-area center the public
profile shows (250–450 m from the real one), at 0.1 km: a search answering "covered or not" around the
real center would let anyone probe the circle's edge and recover the professional's address, and
cursors carry the sort values, so nothing finer than the public profile goes into them. Deleted
professionals are never listed. Errors: 400 (`categoryId` outside the catalog → `validation:invalid`, `lat` →
`validation:location.coordinatesInvalid`, `limit`, `cursor`), 401. (The app has the endpoint in its
API client but no screen calls it yet.)

### `GET /geo/search?q=&limit=` — public
`200 PlaceSuggestion[]` (not paginated: autocomplete). `limit` 1–50 (default 8, capped at 20).
Queries shorter than 2 characters answer `[]` without calling the provider. Language: Hebrew
letters in `q` → Hebrew results, Latin letters → English, else `Accept-Language`.
Provider: Nominatim (country filter `GEOCODER_COUNTRY_CODES`), answers cached in Redis (reverse lookups
30 days, address searches 7 days (one entry per query, whatever `limit`), empty answers 1 day;
autocomplete stores a key per distinct prefix typed, so these keep it bounded), provider calls ≤ 1/s
across instances (`GEOCODER_MIN_INTERVAL_MS`). Only cache misses cost a provider call, so they have
their own budget: 15/min per IP, or 30/min per signed-in user (send the bearer token when there is
one); anonymous misses may use at most half of the provider's rate. Headers: `Cache-Control: private,
max-age=3600`, `Vary: Accept-Language`. Errors: 400 (`limit`), 429 `RATE_LIMITED` (60/min per IP,
shared with `/geo/reverse`; the miss budget; or the provider slot busy > 4 s), 503 `SERVER_ERROR`
(provider down).

### `GET /geo/reverse?lat=&lng=` — public
`200 PlaceSuggestion` for the nearest address; `coordinates` echo the requested point (the pin the
user placed), like the app's reference backend. Errors: 400 with
`{ lat: ['validation:location.coordinatesInvalid'], lng: [same] }` for a missing/invalid pair,
**404 `NOT_FOUND` when there is no address at that point** (the app shows its "type the address"
hint), 429, 503.

## Messaging (conversations, notifications, push, realtime)

Module owners: `src/modules/conversations`, `src/modules/notifications` (+ `src/infra/push`,
`src/infra/realtime`). Every route needs `Authorization: Bearer` and works for both roles; callers only
ever see their own conversations and notifications. Lists are keyset-paginated (`?cursor=&limit=`,
default 20, max 100; bad values → 400 `fieldErrors.cursor` / `fieldErrors.limit`).

### Contract changes vs the app's types (`frontend/src/types`, `services/api/endpoints`)

| # | Change | App impact |
|---|---|---|
| 1 | `GET /conversations` is paginated: `?cursor=&limit=` → `Paginated<Conversation>` (the app expects `Conversation[]`). | `getConversations` becomes an infinite query; the cache helpers that map the list (`realtime-events.ts`, `use-message-mutations.ts`) map `pages[].items`. The inbox badge takes its messages count from contract change 5, not from the loaded pages. |
| 2 | Push `data` is `{ notificationId, notificationType, target }` (adds `notificationType`, a field the app's `PushMessage` already declares). | The Expo push provider copies `data` into `PushMessage`, so a tap marks the notification read and routes like the inbox. |
| 3 | `VALIDATION_ERROR` is 400 (the mock answers 422); both are handled by the app's client. | None. |
| 4 | New limit: 60 messages per minute per user → 429 `RATE_LIMITED`. | Keep the failed message in the composer (already the case for any error). |
| 5 | New `GET /conversations/unread-count` → `{ count }` (unread messages over all conversations). | `useInboxCounts` takes `messages` from it (refetched on `message.created` / `conversation.read`) instead of summing the list. |
| 6 | "Email updates" (`emailEnabled`) now sends notification emails, to verified addresses only, throttled (see [Email updates](#email-updates-notificationpreferencesemailenabled)). | None (the toggle does what it says). |
| 7 | `GET /notifications` and `GET /notifications/unread-count` take `?excludeTypes=` (addition). | The Updates list and its count send `excludeTypes=new_message`, so the server filters chat notifications instead of the app dropping them from loaded pages. |

### `GET /conversations?cursor=&limit=` → `Paginated<Conversation>`
Most recent activity first (last message, else creation; ties by id), `totalCount` = all of the
caller's conversations. Per item: `participants` (customer, professional) with `displayName` (the
professional profile's display name / the customer's full name; both parties of a hired job) and
`avatarUrl`; `lastMessage` (a full `Message` incl. `readAt`, `null` before the first message);
`unreadCount` = the caller's unread messages from the other participant; `isOpen` (`false` once the job
is cancelled); `updatedAt` = last message or closing time (reading does not change it). One indexed
query + one batch load of names/avatars per page. Errors: 400, 401.

### `GET /conversations/unread-count` → `{ count }` (addition)
The caller's unread messages over **all** their conversations (the sum of `unreadCount`): the inbox
badge, which the app can no longer sum from the paginated list. Reads only the conversations with
unread messages for the caller (index `participant_unread`). Refetch it on `message.created` and
`conversation.read`, like `GET /notifications/unread-count`. Errors: 401.

### `GET /conversations/:conversationId` → `Conversation`
Same shape as a list item. 404 unknown or malformed id, 403 not a participant, 401.

### `GET /conversations/:conversationId/messages?cursor=&limit=` → `Paginated<Message>`
Newest first (the chat's inverted list); a cursor stays valid while new messages arrive (keyset).
`readAt` = when the recipient read the message (`null` until then), `clientMessageId` = the sender's id.
Errors: 400, 401, 403, 404.

### `POST /conversations/:conversationId/messages` → 201 `Message`
Body `SendMessagePayload { text, clientMessageId }`, validated like the app's `sendMessageSchema`: `text`
is normalized (CRLF → LF, trailing spaces per line, 3+ blank lines → one, trimmed) and must then be
1–2000 characters (`validation:message.empty` / `validation:message.tooLong`); `clientMessageId` 1–100
characters (`validation:invalid`).
- **Idempotent** per (conversation, sender, `clientMessageId`): a retry answers 201 with the stored
  message and has no side effects, also when identical retries race (unique index) and after the
  conversation closed. The same id from the other participant is a different message.
- **Closed conversation** (job cancelled) → 409 `CONFLICT` "This conversation is closed".
- **Effects** (one transaction; events and push after the commit, in this order): replying first reads
  the counterpart's messages (exactly like `POST …/read`, incl. its `conversation.read` event when
  something was unread); the recipient's `unreadCount` + 1 and `lastMessage` updated; a `new_message`
  notification for the recipient (`params { categoryId, professionalName | customerName,
  messagePreview }`, `target { kind: 'conversation', conversationId }`; only the newest unread one per
  conversation is kept; none when the recipient's `messages` preference is off) with
  `notification.created` and push; `message.created` to both participants (the sender's other devices
  included).
- Errors: 400, 401, 403, 404, 409, 429.

### `POST /conversations/:conversationId/read` → `{ success: true }`
Marks every unread message of the other participant read (`readAt` = now), resets the caller's
`unreadCount` and `lastMessage.readAt`, and marks the caller's notifications that target this
conversation read. When at least one message changed, `conversation.read { conversationId, readerId,
readAt }` goes to both participants (the sender's double check, the reader's other devices). Idempotent:
nothing unread → nothing changes, no event. The caller's own messages are never affected.
Errors: 401, 403, 404.

### `GET /notifications?unreadOnly=&excludeTypes=&cursor=&limit=` → `Paginated<AppNotification>`
Newest first. `unreadOnly` = `true|false|1|0` (default `false`; anything else → 400
`fieldErrors.unreadOnly`). `excludeTypes` = comma-separated notification types to leave out (the app's
Updates list sends `new_message`: chats have their own list, and filtering on the server keeps every
page full); an unknown type → 400 `fieldErrors['excludeTypes.<i>']`. `totalCount` counts the filtered
set. Notifications are deleted 90 days after creation (TTL index). Errors: 400, 401.

### `GET /notifications/unread-count?excludeTypes=` → `{ count }`
Unread notifications of the caller (indexed count), without the `excludeTypes` (as above; the app's
Updates badge sends `new_message`). Errors: 400, 401.

### `POST /notifications/:notificationId/read` → `AppNotification`
Sets `readAt` and returns the notification; an already read one is returned unchanged (idempotent).
404 unknown or malformed id, 403 another user's notification, 401. No realtime event (as in the mock).

### `POST /notifications/read-all` → `{ success: true }`
Marks all of the caller's unread notifications read. 401.

### How notifications are produced (every module)
`createNotification(s)` (`notifications/create-notification.service.ts`) stores nothing when the
recipient's category toggle for the type is off (`jobUpdates`, `messages`, `newRequests`, `reminders`),
stores inside the caller's transaction, then publishes `notification.created` to the recipient and, in
the background (never delaying the response), sends push when `pushEnabled` and an email when
`emailEnabled` (below).

### Email updates (`notificationPreferences.emailEnabled`)
- Each notification the user receives is also emailed (same title and text as the push, en/he by the
  user's language, RTL for Hebrew), with a line on how to turn these emails off in Settings →
  Notifications. The category toggles apply first, as for push.
- Only to **verified** addresses: otherwise anyone could register someone else's address and have our
  notifications sent there.
- Throttled so a busy chat or area does not flood the inbox: at most one `new_message` email per
  conversation every 30 minutes, and at most 10 notification emails per user and hour; the rest stay
  in the app (inbox, push).

### Push (Expo)
- Every live session of the recipient with a push token (`POST /me/devices`) gets the notification;
  ended sessions are gone together with their tokens. Localized in the
  user's language (en/he, the app's `notifications:types.*` texts; Latin names bidi-isolated in Hebrew),
  `sound: default`, `priority: high`, `data: { notificationId, notificationType, target }`.
- Sent in chunks of 100 (Expo's limit; the SDK retries 429s). A failed chunk does not stop the others;
  the failure is logged and those tokens are kept.
- Tokens that are not Expo push tokens, or that Expo answers `DeviceNotRegistered`, are removed from
  their session at once (the session stays signed in).
  Other tickets wait in Redis (`${APP_ENV}:push-tickets`, sorted set by send time; the key expires 24 h
  after the last push, so it cannot outlive its receipts even where no instance runs the cron). The
  `push-receipts` cron (every 15 min, Redis-locked) fetches receipts of tickets ≥ 15 min old in batches
  of 1000 (up to 50 000 per run), removes `DeviceNotRegistered` tokens, logs the other receipt errors
  by type, drops answered tickets and purges tickets older than a day.

### Realtime: `GET /v1/realtime` (WebSocket)
- Same HTTP server as the API. The access token comes from the `Sec-WebSocket-Protocol` header
  (`professionals.v1, bearer.<access token>`; the server answers `professionals.v1`), or from `?token=`
  (older apps). It is verified on connect: missing/invalid/expired, or of
  a revoked session → close **4001**; open sockets of a session are closed with **4001** when it is
  revoked; an open socket is closed with **4001** when its token expires (the app reconnects with a
  refreshed token). The token is never logged.
- Server → client JSON frames only, exactly the app's `RealtimeEvent` union; client frames are ignored
  (max 4 KB). Ping every 30 s; a socket that misses a pong is terminated.
- Messaging emits `message.created` (both participants), `conversation.read` (both participants) and
  `notification.created` (the recipient); the other modules emit `request.updated`, `offer.updated`,
  `job.updated`, `profile.updated`. Events are published after the transaction commits.
- Multi-instance: events go through Redis pub/sub (`${APP_ENV}:realtime`); each instance delivers to its
  local sockets of the addressed users. Delivery is best effort: the app refetches on reconnect/focus.

### Inbox badge
The app sums `Conversation.unreadCount` over the conversation list; with pagination only the loaded
pages would count. Use `GET /conversations/unread-count` for the messages part of the badge instead,
and `GET /notifications/unread-count?excludeTypes=new_message` for the updates part (a chat message
also creates a `new_message` notification, which would otherwise count twice).

## Marketplace (requests, offers, jobs, reviews, dashboard)

Module owners: `src/modules/requests` (+ matching, explorer), `src/modules/offers`,
`src/modules/jobs`, `src/modules/reviews`, `src/modules/dashboard`. Every route needs
`Authorization: Bearer`; the role column says who may call it (the other role gets 403 `FORBIDDEN`).
Rules, errors, notifications and realtime events are those of the app's mock backend
(`frontend/src/test-utils/mock-backend/server/services/lifecycle-service.ts`, `views.ts`); malformed ids answer 404.
Lists are keyset-paginated (`?cursor=&limit=`, default 20, max 100; bad values → 400
`fieldErrors.cursor` / `fieldErrors.limit`).
A deleted account is refused with 401 by the routes that create something (`POST /requests`,
`POST /requests/:id/offers`, `POST /jobs/:id/review`), also while Redis (the session denylist) is down;
everything it had in progress was closed by the deletion ([`POST /me/deletion`](#post-medeletion--200--success-true--addition)).

### Contract changes vs the app's types (`frontend/src/types`, `services/api/endpoints`)

| # | Change | App impact |
|---|---|---|
| 1 | `GET /requests/:id/offers` is paginated: `?sort=&statuses=&cursor=&limit=` → `Paginated<OfferWithProfessional>` (the app expects `OfferWithProfessional[]`). The whole ranked list is computed per request (the "recommended" score is relative to the other offers), the cursor resumes after the last offer returned. | `getOffersForRequest` reads `.items` (ask `limit=100`: a request rarely gets more offers). |
| 2 | `GET /jobs?scope=` is paginated → `Paginated<JobSummary>` (the app expects `JobSummary[]`). | `useJobs` becomes an **infinite query** (load more on scroll): reading only `.items` of the first page would cut the Work tab's completed list at 20. The Work tab's "earned this month" must not be summed from the loaded pages either: take `ProfessionalDashboard.earningsThisMonth` (computed over every job completed this month, `Asia/Jerusalem`). `scope=completed` is ordered by completion time, newest first, so a client that wants its own per-currency sum can load pages until `completedAt` falls before the month start. |
| 3 | `GET /jobs?scope=all` is ordered by appointment, latest first (the mock: most recently updated). The app never requests `all`. | None. |
| 4 | `CustomerDashboard.jobsAwaitingReview` holds at most the 20 most recently completed unreviewed jobs (the mock: all). | None in practice (the app shows the first one and marks requests in lists). |
| 5 | `POST /requests` and `PATCH /requests/:id` are multipart (JSON `data` + files `photos`, [Images](#images)); `RequestPhoto` is `{ publicId, url }` (no width/height: the app never used them); a draft edit lists the photos it keeps (`keepPhotos`). | Done in the app. |
| 6 | New limits: 30 new requests per hour per customer, 60 new offers per 10 minutes per professional → 429 `RATE_LIMITED`. | Show the generic error. |
| 7 | `VALIDATION_ERROR` is 400 (the mock answers 422). The body is validated before ownership/state checks, so e.g. an invalid body on a published request answers 400 where the mock answered 409. | None (the client maps both). |
| 8 | Calendar rules run in `Asia/Jerusalem` (the market's time zone): "today" for preferred dates, the day an emergency/urgent preferred date starts, "this month" for earnings. The mock used the device zone. | None for Israeli users. |
| 9 | `stats.responseTimeMinutes` is the median over the professional's 100 most recently updated offers (the mock: all offers), so its cost stays bounded. | None. |
| 10 | `maxDistanceKm` of the explorer accepts only the app's presets (5, 10, 20, 40); other values → 400 `fieldErrors.maxDistanceKm`. Offer distances are measured between the professional's public (approximate) center and the request's approximate pin. | None (the app only sends the presets). |

### Requests

#### `POST /requests` — customer → 201 `CustomerRequestView`
`multipart/form-data` ([Images](#images)): the text field **`data`** holds the JSON payload
`CreateServiceRequestPayload`, the files **`photos`** (0–6, in display order) the photos.
Payload: `categoryId` (catalog id; unknown → 422 `UNSUPPORTED_CATEGORY`),
`description` (15–1000, trimmed), `location` (`coordinates`, `addressLine` ≤ 120, `city` ≤ 60,
`neighborhood`, `details` ≤ 200), `urgency`, `preferredSchedule` (`{ date: YYYY-MM-DD, timeWindow }`
or `null`, default `null`), `notes` (≤ 500, empty → `null`), `publish` (default `true`; `false` saves
a draft), `clientRequestId` (optional, see below). Field errors are keyed as in a JSON body
(`description`, `location.addressLine`, …); photo errors under `photos`.
Preferred date rules (`fieldErrors['preferredSchedule.date']`): real day
(`request.preferredDateInvalid`), not before today (`…InPast`), ≤ 60 days ahead (`…TooFar`), and
starting before the latest start an offer may propose — emergency ≤ 24 h, urgent ≤ 72 h
(`…BeyondUrgency`).
Order: the payload is validated; a repeated `clientRequestId` answers with the first request; the
date rules are checked; the photos are checked and stored; the request is created. Photos stored for
a request that ends up not created (a failure, or a concurrent post with the same `clientRequestId`
that won) are deleted again.

```http
POST /v1/requests
Content-Type: multipart/form-data; boundary=…

--…
Content-Disposition: form-data; name="data"

{"categoryId":"plumbing","description":"The kitchen sink is leaking under the cabinet.","location":{"coordinates":{"latitude":32.08,"longitude":34.78},"addressLine":"Dizengoff St 120","city":"Tel Aviv-Yafo","neighborhood":null,"details":null},"urgency":"normal","preferredSchedule":null,"notes":null,"publish":true,"clientRequestId":"k1x9…"}
--…
Content-Disposition: form-data; name="photos"; filename="sink.jpg"
Content-Type: image/jpeg

<bytes>
```
→ `201 { "id": "…", "status": "open", "photos": [{ "publicId": "professionals/production/requests/abc", "url": "https://res.cloudinary.com/…/abc.jpg" }], … }`
Published: every matching professional (category + own service radius, haversine from the
service-area center to the request's approximate pin) gets `new_matching_request` (`distanceKm`,
customer short name) and `request.updated`. This fan-out runs right after the response (in the
background), so the response never waits for it; a draft only emits `request.updated` to its owner.
When the fan-out is done, the request stores how many professionals it notified
(`CustomerRequestView.matchedProfessionalCount`, `null` until then and for drafts; `0` = no
professional covers this category there yet) and the owner gets `request.updated` to refetch it.
Idempotency: an optional `clientRequestId` (1–100 characters, one per form submission in the app)
makes a repeated post (a retry after a lost or late response, a double tap) return the request the
first one created (201, same body; nothing is created, uploaded or notified again: the photos of the
retry are read but not stored). The key is scoped to the customer; a new one creates a new request.

#### `GET /requests/:requestId` — any role → `RequestDetailsResponse`
- Owner customer: `{ viewerRole: 'customer', request: CustomerRequestView }` (`latestOfferAt` =
  newest pending offer, `lowestOfferPrice` = lowest pending/accepted price, `matchedProfessionalCount`
  = professionals notified at publication, see `POST /requests`). Another customer → 403.
- Professional: 404 for drafts; 403 unless the request matches their categories and service area or
  they sent an offer on it. `{ viewerRole: 'professional', request: ProfessionalRequestView }` with
  the privacy view until their offer is accepted: `location` approximate (the request's stored pin:
  deterministic 250–450 m offset derived from the request id and `LOCATION_PRIVACY_SECRET`, no
  street, no details, `isApproximate: true`), `notes: null`,
  `jobId: null`. Plus `distanceKm` (0.1 km, from the service-area center to the approximate pin),
  `customer` (`CustomerSummary`: short name, avatar, member since, completed jobs; nothing of the
  customer's own address), `myOffer` (their active offer, else their newest),
  `isMatch`.

#### `PATCH /requests/:requestId` — customer (drafts) → `CustomerRequestView`
Multipart like `POST /requests`: `data` = any field of the create payload except `publish` and
`clientRequestId`, plus **`keepPhotos`**: the `publicId`s of the draft's current photos to keep, in
the new order (omitted = keep them all); the new files `photos` are added after them (at most 6 in
all → 400 `photos: ['validation:request.tooManyPhotos']`; an id the draft does not have → 400
`keepPhotos: ['validation:request.photoNotFound']`). Photos left out are deleted from storage after the
commit. Because the payload lists every photo it keeps, a retried edit ends with the same photos (the
first attempt's new ones are replaced, not duplicated). Not a draft → 409 `CONFLICT`; not the owner →
403 — both answered before anything is uploaded. A new `urgency` or `preferredSchedule` re-checks the
date rules.

```http
PATCH /v1/requests/66f…
Content-Type: multipart/form-data; boundary=…
data = {"description":"…","keepPhotos":["professionals/production/requests/abc"]}
photos = <new.jpg>
```
→ `200 { …, "photos": [{ "publicId": "…/abc", "url": "…" }, { "publicId": "…/new", "url": "…" }] }`

#### `DELETE /requests/:requestId` — customer (drafts) → `{ success: true }`
Not a draft → 409 `CONFLICT`. Its photos are deleted from storage after the commit.
`request.updated` to the owner.

#### `POST /requests/:requestId/publish` — customer → `CustomerRequestView`
`draft → open`; date rules re-checked on today's date; notifications as for a published create.
Idempotent: an already `open` request is returned unchanged (a retry after a lost response); other
statuses → 409 `INVALID_STATE_TRANSITION`.

#### `POST /requests/:requestId/cancel` — customer → `CustomerRequestView`
Body `{ reason: CustomerCancellationReason, comment?: string | null }` (comment ≤ 300, empty →
`null`; `account_deleted` is not one of them: only account deletion stores it). Allowed from `draft`,
`open`, `offers_received`, `professional_selected`, `scheduled` (`in_progress`/`completed`/`cancelled`
→ 409 `INVALID_STATE_TRANSITION`: the state machines allow `in_progress → cancelled` for account
deletion only). One transaction: pending
offers → `rejected` (`request_cancelled`), an assigned job → `cancelled` and its chat closed, the
request → `cancelled` with recounted `offerCount`/`pendingOfferCount`. `request_cancelled` goes to
every professional with a rejected offer or the cancelled job; `offer.updated`/`job.updated` to the
parties; `request.updated` to the owner, every offering professional and — when it was accepting
offers — every matching professional (it leaves their explorer). An accepted offer stays `accepted`.
The request's photos are removed (`photos: []`) and deleted from storage after the commit.

#### `GET /customer/requests?section=&statuses=&cursor=&limit=` — customer → `Paginated<CustomerRequestView>`
Most recently updated first (keyset `updatedAt, _id`). `section` ∈ `CUSTOMER_REQUEST_SECTIONS`
(`awaiting_offers` = open without pending offers, `has_offers` = offers_received or open with pending
offers, `active` = professional_selected/scheduled/in_progress), `statuses` comma separated; both
combine with AND. Unknown values → 400 (`section`, `statuses.<i>`).

#### `GET /professional/requests/nearby?…` — professional → `Paginated<ProfessionalRequestView>`
The explorer: requests in `open`/`offers_received` within the professional's radius, in their
categories. Query (the app's `NearbyRequestsParams`): `categoryIds` (subset of their own; none of
their own → empty page), `maxDistanceKm` (one of the app's presets 5 / 10 / 20 / 40, capped by the
radius; any other value → 400: a free value would let a professional measure distances finely),
`urgencies`,
`preferredDateFrom`/`preferredDateTo` (`YYYY-MM-DD`, inclusive; requests without a preferred date are
then excluded), `offerPresence` (`no_offers` / `has_offers` on pending offers), `excludeWithMyOffer`
(hide requests with their pending offer; a request with an accepted offer never accepts offers
again), `sort` (`newest` default: publication time desc, then id asc; `nearest`: the shown 0.1 km
distance, then newest; `most_urgent`; `fewest_offers`: pending offers asc — a key that changes, see
Pagination), `cursor`, `limit` (the app's map asks 100). One `$geoNear` aggregation returns the page
(and `totalCount` on the first page); distances are measured to the request's approximate pin (the
one the privacy view shows, never the exact address) with the app's haversine Earth radius, so
"inside the radius" is exactly the app's `isWithinServiceArea`. Items use the privacy view above.
When a request enters or leaves the explorer, matching professionals get `request.updated`; for
those without an offer on it, events are merged per professional (the first of a 2 s window at once,
the rest as one event when the window closes), so a burst of publications costs each open explorer
one or two refetches, not one per request.

### Offers

#### `POST /requests/:requestId/offers` — professional → 201 `Offer`
Body `CreateOfferPayload`: `price` (20–200 000, ≤ 2 decimals), `currency` (only `ILS` is accepted:
others → 400 `offer.currencyUnsupported`), `proposedStartAt` (ISO instant), `estimatedDurationMinutes`
(integer 15–10 080 or `null`), `message` (≤ 500, empty → `null`); every key required.
Errors in the mock's order: draft or unknown request 404; not `open`/`offers_received` → 409
`REQUEST_NOT_ACCEPTING_OFFERS`; category not theirs → 422 `UNSUPPORTED_CATEGORY`
(`categoryId: category.notOffered`); outside their radius → 422 `OUTSIDE_SERVICE_AREA`
(`location: location.outsideServiceArea`); an active (pending/accepted) offer of theirs → 409
`DUPLICATE_OFFER` (also for concurrent double submits: unique index); time rules → 400 on
`proposedStartAt` (`offer.startTooSoon` < 30 min, `…StartTooFar` > 60 days, `…emergencyWindow`
> 24 h, `…urgentWindow` > 72 h). `expiresAt` = now + the urgency's validity (6 h / 24 h / 72 h /
7 days), never after the proposed start. The request is recounted (`open → offers_received`);
`offer_received` to the customer; `offer.updated` + `request.updated`. The professional's response
time is refreshed after the commit (a derived statistic, off the request).

#### `GET /requests/:requestId/offers?sort=&statuses=&cursor=&limit=` — customer (owner) → `Paginated<OfferWithProfessional>`
Ranked like the app's `sortOffers` (accepted first, then pending, then the rest; `sort` ∈
`recommended` (default) | `lowest_price` | `earliest_availability` | `highest_rating` |
`most_reviews`; ties by submission time). `distanceKm` between the professional's public (approximate)
service-area center and the request's approximate pin: neither side's hidden address can be measured
through it. The cursor resumes after the last offer returned; when that offer
left the filtered list meanwhile (withdrawn, expired, accepted or rejected under a `statuses` filter)
it resumes at the same position instead of failing. See contract change 1.

#### `GET /offers/:offerId` — the request's owner or the offering professional → `OfferDetails`
`OfferWithProfessional & { request: OfferRequestSummary }`; the request location is exact for the
owner and the hired professional, approximate otherwise. Others → 403.

#### `PATCH /offers/:offerId` — professional (own) → `Offer`
Body: any field of the create payload. Past `expiresAt` or `expired` → 409 `OFFER_EXPIRED`; not
pending → 409 `INVALID_STATE_TRANSITION`; request closed → 409 `REQUEST_NOT_ACCEPTING_OFFERS`;
time/currency rules as on create. `expiresAt` restarts from now. `offer_updated` to the customer.

#### `POST /offers/:offerId/withdraw` — professional (own) → `Offer`
`pending → withdrawn` (`withdrawn_by_professional`); `expired` → 409 `OFFER_EXPIRED`, other
statuses → 409 `INVALID_STATE_TRANSITION`. The request is recounted (`offers_received → open` when
none are pending). `offer_withdrawn` to the customer. The professional may offer again afterwards.

#### `POST /offers/:offerId/accept` — customer (owner) → `AcceptOfferResponse`
One MongoDB transaction: the offer → `accepted` (`accepted_by_customer`), every other pending offer →
`rejected` (`another_offer_accepted`), a job (`awaiting_confirmation`, price/start/duration copied
from the offer) and its conversation are created, the request → `professional_selected` with
`acceptedOfferId`/`jobId`. Blockers (the app's `getOfferAcceptBlocker`): the request already has an
accepted offer → 409 `CONFLICT`; expired → 409 `OFFER_EXPIRED`; not pending → 409
`INVALID_STATE_TRANSITION`; request closed → 409 `REQUEST_NOT_ACCEPTING_OFFERS`. Concurrent
acceptances: exactly one wins, the others get 409 (write conflict → driver retry → re-check; a
unique job-per-request index backs it up). `offer_accepted` to the hired professional,
`offer_not_selected` to the others, `offer.updated` per changed offer, `job.updated`, and
`request.updated` also to the matching professionals whose explorer it leaves.
Response: `{ offer: Offer, request: ServiceRequest, job: Job }`.

#### `GET /professional/offers?statuses=&cursor=&limit=` — professional → `Paginated<OfferWithRequest>`
Their offers, most recently updated first (keyset `updatedAt, _id`), optional `statuses` filter.
The embedded request location is approximate unless their offer on it was accepted.

### Jobs

`Job.location` is the request's exact address (only the two parties see jobs). A job's status
mirrors onto its request (`awaiting_confirmation → professional_selected`, then the same names).

#### `GET /jobs?scope=&cursor=&limit=` — both roles → `Paginated<JobSummary>`
The caller's jobs (as customer or professional). `scope`: `active` (awaiting_confirmation,
scheduled, in_progress; soonest appointment first), `upcoming` (awaiting_confirmation/scheduled
starting from 2 h ago; soonest first), `completed` (most recently completed first), `all` (default;
latest appointment first — contract change 3). `JobSummary` adds `description`, `professional`
(`ProfessionalSummary`) and `customer` (`CustomerSummary`).

#### `GET /jobs/:jobId` — the job's parties → `JobDetails`
Adds the full `request` (`ServiceRequest`), `review` (`Review | null`) and `canReview` (the customer,
completed, not reviewed yet, the professional's account not deleted). Others → 403.

#### `POST /jobs/:jobId/confirm` — professional (own) → `Job`
`awaiting_confirmation → scheduled` (`confirmedAt`); request → `scheduled`; `job_confirmed` to the
customer. Other states → 409 `INVALID_STATE_TRANSITION`; another professional's job → 403.

#### `POST /jobs/:jobId/start` — professional (own) → `Job`
`scheduled → in_progress` (`startedAt`); `job_started` to the customer.

#### `POST /jobs/:jobId/complete` — either party → `Job`
`scheduled | in_progress → completed` (`completedAt`, `completedBy` = caller's role); the
professional's `stats.completedJobsCount` is recounted; `job_completed` to the other party.
Every transition emits `job.updated` (both parties) and `request.updated`.

#### `POST /jobs/:jobId/review` — customer (own job) → 201 `Review`
Body `{ rating: 1–5, comment: string | null }` (comment ≤ 800, empty → `null`; missing rating →
`review.ratingRequired`, other values → `review.ratingInvalid`). Job not completed → 409 `CONFLICT`;
already reviewed (also a concurrent double submit) → 409 `CONFLICT`; the professional deleted their
account → 409 `CONFLICT`; another customer → 403.
One transaction stores the review, links it on the job and recomputes the professional's
`averageRating` (0.1 precision), `reviewCount` and search rank; the cached public profile is dropped,
`profile.updated` and `review_received` go to the professional, `job.updated` to both parties.
There is no endpoint to edit or delete a review; the operator removes one with `src/remove-review.ts`
(OPERATIONS.md §9): the review is deleted, the job's `reviewId` becomes `null` (its customer may
review it again) and the rating is recounted from the remaining reviews.

### Dashboards

#### `GET /customer/dashboard` — customer → `CustomerDashboard`
`openRequestsCount` (open + offers_received), `requestsWithOffersCount` (the "has offers" section),
`pendingOffersCount` (pending offers on those requests), `activeJobsCount`, `recentRequests` (5 most
recently updated), `upcomingJobs` (3 soonest active jobs), `jobsAwaitingReview` (completed without
review, most recent first, ≤ 20; jobs of deleted professionals left out).

#### `GET /professional/dashboard` — professional → `ProfessionalDashboard`
`nearbyOpenRequestsCount` (what the explorer shows without filters), `newRequests` (the 5 newest of
those without an active offer of theirs), `pendingOffersCount` + `pendingOffers` (5 newest),
`activeJobsCount` + `upcomingAppointments` (5 soonest), `recentNotifications` (5 newest),
`earningsThisMonth` (sum of agreed prices of jobs completed since the 1st of the month, Israel time,
`{ amount, currency: 'ILS' }`), `completedJobsCount`.

### Scheduled work
- `offer-expiry` (every 5 min): pending offers past `expiresAt` → `expired` (one transaction each,
  idempotent), the request is recounted (`offers_received → open` when none are left),
  `offer_expired` to the professional, `offer.updated` + `request.updated`.
- `appointment-reminders` (every 15 min): awaiting_confirmation/scheduled jobs starting within 2 h get
  one `appointment_reminder` per party; `reminderSentAt` is claimed in the same transaction (exactly
  once; it does not change the job's `updatedAt`).

### Notifications and events per action

| Action | Notification (recipient) | Realtime |
|---|---|---|
| Publish | `new_matching_request` (matching professionals) | `request.updated` (owner, matching professionals) |
| Submit offer | `offer_received` (customer) | `offer.updated`, `request.updated` |
| Edit / withdraw offer | `offer_updated` / `offer_withdrawn` (customer) | `offer.updated`, `request.updated` |
| Accept | `offer_accepted` (hired), `offer_not_selected` (others) | `offer.updated` ×n, `request.updated` (+ explorer), `job.updated` |
| Cancel request | `request_cancelled` (pending offers' + job's professionals) | `offer.updated`, `job.updated`, `request.updated` (+ explorer) |
| Confirm / start | `job_confirmed` / `job_started` (customer) | `job.updated`, `request.updated` |
| Complete | `job_completed` (the other party) | `job.updated`, `request.updated`, `profile.updated` |
| Review | `review_received` (professional) | `job.updated`, `profile.updated` |
| Offer expiry cron | `offer_expired` (professional) | `offer.updated`, `request.updated` |
| Reminder cron | `appointment_reminder` (both) | — |
| Account deletion (`POST /me/deletion`) | customer deleted: `request_cancelled` (the professionals, `customerName: ''`); professional deleted: `offer_withdrawn` (`professionalName: ''`) and `job_cancelled` (the customer of each active job; `params { categoryId, scheduledAt }`, no name) | as for cancel / withdraw |

`request.updated` always reaches the owner and every professional who ever sent an offer on the
request. Notifications honour the recipients' preference toggles and fan out to push.

## Legal

The Terms of Use, the Privacy Policy and the account-deletion page (the "how to delete your account"
page Google Play asks for), in English and Hebrew. Public: no `Authorization` needed. Source:
`src/modules/legal` (texts in `content/`, the operator's details in `src/config/legal.ts`). How to
publish a new version: [OPERATIONS.md §10](OPERATIONS.md#10-legal-documents).

### `GET /legal/:document?lang=en|he` → `LegalDocumentResponse`

`document` is `terms`, `privacy` or `account-deletion`; anything else → 404 `NOT_FOUND`. Without
`lang`, `Accept-Language` decides (Hebrew when it prefers `he`, otherwise English); another `lang`
value → 400 `fieldErrors.lang`.

```json
{ "document": "privacy", "version": "2026-09-30", "effectiveDate": "2026-09-30", "language": "en",
  "title": "Privacy Policy", "intro": ["…"],
  "sections": [{ "id": "who-we-are", "heading": "Who we are", "blocks": [
    { "type": "paragraph", "text": "The Professionals app is operated by:" },
    { "type": "list", "items": ["…"] },
    { "type": "definitions", "items": [{ "term": "Email", "text": "[privacy@example.com](mailto:privacy@example.com)" }] }] }] }
```

- `version` and `effectiveDate` are `LEGAL_CONFIG.effectiveDate`: the version sign-up records
  (`users.termsAcceptance.version`, password and Google sign-ups).
- Section `id`s are stable and the same in both languages; the pages use them as anchors
  (`/legal/privacy#your-rights`).
- Texts carry two kinds of inline markup, nothing else: `**bold**` and `[label](url)`, where `url` is
  `https://…`, `mailto:…` or one of the public pages below (`http://` in development). Titles,
  headings and definition terms are plain text.
- Placeholders are filled by the server: the operator's name, company number, address and contact
  email; the effective date as a long date in the document's language ("30 September 2026",
  "30 בספטמבר 2026"); the URLs of the public pages (built from `PUBLIC_API_URL`); the retention days
  of logs and backups. In development, empty operator fields show as visible placeholders ("[operator
  name — set in backend/src/config/legal.ts]", the address `operator-email-not-set@example.invalid`);
  staging and production do not start without them.
- `Cache-Control: public, max-age=300`, `Vary: Accept-Language`. 300 / min per user when signed in,
  otherwise per IP.

### Public pages: `GET /legal/terms`, `/legal/privacy`, `/legal/account-deletion` (outside `/v1`)

The same texts as server-rendered HTML, for the app store listings, the Google OAuth consent screen
and anyone without the app ([OPERATIONS.md §10](OPERATIONS.md#public-urls) lists where each URL goes).

- Language: `?lang=he|en`, else `Accept-Language` (an unknown `lang` is ignored). `<html lang dir>`;
  Hebrew pages are right-to-left.
- A page has a link to the other language, links to the three documents (in the page's language), the
  title, the effective date, the intro, a table of contents and the sections (`<section id="…">`).
  Links go only to `https:` pages, `mailto:` addresses and the documents' pages; every text is escaped.
- No scripts, images, cookies or outside resources: `Content-Security-Policy: default-src 'none';
  style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`.
  `Cache-Control: public, max-age=300`, `Vary: Accept-Language`.
- An unknown document → 404 (JSON error body). 300 / min per IP; over it, a 429 HTML page in the
  browser's language (`Cache-Control: no-store`).
