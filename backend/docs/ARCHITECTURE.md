# Architecture

How the API is put together and why. Endpoint details are in [API.md](API.md), operations
(environments, deploy, cron, scaling) in [OPERATIONS.md](OPERATIONS.md), coding rules in
[CONVENTIONS.md](CONVENTIONS.md).

## 1. Shape of the system

```
 Expo app ──HTTPS /v1 (REST, JSON)──┐         ┌── MongoDB (replica set: data, transactions, TTL)
          ──WSS /v1/realtime────────┤  API ×N ├── Redis   (cache, rate limits, cron locks, denylist,
                                    │ (Node)  │            push tickets, pub/sub fan-out)
 Email links ──GET/POST /v1/auth/*──┘         └── Providers: Cloudinary, Resend / Gmail SMTP,
                                                   Expo push, Google certs, Nominatim, Pwned Passwords
```

- One process type: an Express 5 HTTP server with a `ws` WebSocket server on the same port, plus a
  cron scheduler. Instances are stateless and interchangeable; any of them can serve any request.
- The REST contract is the one the app already speaks (`frontend/src/types`, `services/api/endpoints`),
  checked at compile time by `test/contract/frontend-contract.check.ts`; the few deliberate changes are
  listed in [API.md → Contract changes](API.md#contract-changes-vs-the-apps-types).
- The app's backend test double (`frontend/src/test-utils/mock-backend/server`, Jest only) is the behavioural reference: lifecycle,
  matching, privacy views and authorization rules were ported from it to MongoDB.

## 2. Layers

| Layer | Folder | Responsibility |
|---|---|---|
| Bootstrap | `server.ts` | env → MongoDB (indexes) + Redis → HTTP + WebSocket → cron; signals and graceful shutdown |
| App | `app.ts`, `routes.ts` | middleware chain, `/health` `/ready`, the public legal pages `/legal/*`, every module router under `/v1`, 404 and errors |
| Middleware | `middleware/` | request id, pino-http logging (redacted), auth + roles, Redis rate limits, `$`-key guard, error mapping |
| Modules | `modules/<domain>/` | routes → thin controller (zod parse) → services (rules, transactions) → views (DTOs, privacy) |
| Infra | `infra/` | adapters behind interfaces: mongo, redis + keys + cache, mail, push, storage, geo, google, realtime, cron, password breach |
| Lib | `lib/` | pure helpers: errors, validation, keyset pagination, access tokens, crypto, geo math, clock, logger |
| Shared | `shared/` | constants copied from the app (catalog, statuses, urgency, notification types, error codes, limits) and the contract DTO types; a drift test compares them with the app's files |

Dependencies point downwards only: modules use `infra`/`lib`/`shared`, never the reverse. Providers
reach services through one `deps` object (`deps.ts`: env, logger, clock, redis, keys, cache, mailer,
push, storage, geocoder, google, passwordBreach, realtime, background), so tests swap each provider for
an in-memory fake (`test/app.ts`) while MongoDB and Redis stay real.

## 3. Request path

```
requestId → httpLogger → helmet → cors → compression → /health,/ready (in-memory per-IP limit)
  → /legal/:document (HTML pages, per-IP limit) → express.json(100 kb) → rejectOperatorKeys → /v1: global rate limit (per user, else per IP)
  → route: [per-IP rateLimit] [requireAuth] [requireRole] [per-user rateLimit] → controller → service → view → JSON
  → notFound → errorHandler ({ code, message, fieldErrors? })
```

- **Validation**: zod schemas on params, query and body (`lib/validate.ts`) produce the app's
  `validation:*` keys under dotted field paths, so the app shows its own translated messages.
- **Authorization**: roles on the route (`requireRole`), ownership in the service (403 for someone
  else's resource, 404 for unknown ids), as in the mock's `auth.ts`.
- **Privacy** lives in the views: professionals see a request's approximate pin (a stored
  `publicPoint`) and no notes until hired; a professional's contact is shown only to customers who
  hired them (a job that was not cancelled); public vs own professional profile (the personal name
  only in the own one). Every professional-facing geo query runs on the approximate points, so no
  filter or distance reveals an exact address. The offset of an approximate point (250–450 m) comes
  from an HMAC of the record id keyed by `LOCATION_PRIVACY_SECRET` (`lib/geo.ts`): the id is public,
  the key is not, so the offset cannot be undone.

## 4. Data

MongoDB collections (one model file each, indexes declared next to the schema with the query they
serve): `users`, `professionals` (1:1 with users, same `_id`), `sessions` (one per signed-in app
install, with its Expo push token), `emailTokens`, `requests`, `offers`, `jobs`, `reviews`, `conversations`, `messages`, `notifications`.
Categories are a code constant served from memory (`GET /catalog/categories`, ETag), and so are the
legal documents (`modules/legal/content`, operator details in `config/legal.ts`: `GET /v1/legal/:document`
and the pages `/legal/*`).

- **Images** have no collection of their own: they are uploaded with the thing that owns them
  (multipart `POST /requests` / `PATCH /requests/:id`, `PUT /me/avatar`; `middleware/multipart.ts`)
  and stored only there, as `{ url, publicId }` (`requests.photos`, `users.avatar`; a Google avatar
  has no `publicId`). Before a body is read, a user's image posts are rate limited and admitted
  (`middleware/image-admission.ts`: 2 at once per user, a memory budget per process); refusals about
  the images name the file field (`infra/storage/image-errors.ts`). `infra/storage/store-images.ts`
  checks every file's bytes before storing any, charges them to the user's daily bytes
  (`image-quota.ts`) and removes what it stored when the owner is not saved (unless the save's commit
  may have happened: then the owner is read again first). An image the owner stops showing (removed
  from a draft, draft deleted, request cancelled, avatar replaced) is deleted from Cloudinary after the
  commit. Deletion is best effort, with no cleanup job: rare orphans (a failed delete, a crash between
  upload and save, an upload that completed after we gave up) are logged with their `publicId`s or found
  by comparing the Cloudinary folder with the database (OPERATIONS.md §7).

- **Minimal fields**: no field that no endpoint or rule reads. Denormalized values exist only on hot
  paths, each with a comment: request offer counters (explorer filter/sort), professional stats and
  rank score (search order, profiles), conversation last activity and per-participant unread
  counters (inbox, badge), service-area public center and request public pin (privacy-safe geo
  queries).
- **Consistency**: multi-document changes run in a transaction (`withTransaction`): register, accept
  offer (accept one, reject the others, update the request, create job + conversation), cancel,
  job transitions, review + rating aggregate, account deletion. Concurrency uses conditional updates on the current
  state plus unique indexes (`jobs.request`, `reviews.job`, active offer per professional and request,
  `messages` client id), so the loser of a race gets 409.
- **Side effects after commit**: realtime events, push, emails and matching fan-out are registered
  with `tx.afterCommit` and run only once the transaction committed; slow ones go to
  `deps.background` (awaited on shutdown), never delaying the response.
- **Lists** are keyset-paginated (`lib/pagination.ts`): the cursor carries the last item's sort key
  and the first page's `totalCount`, so pages are stable under inserts and never use `skip`.
- **Expiry without cron**: sessions (and with them their push tokens), email tokens and notifications
  (90 days) are removed by TTL indexes.
- **State machines** (`jobs/job-rules.ts`, `requests/request-rules.ts`, mirrored by the app): a job's
  status mirrors onto its request. `in_progress → cancelled` exists for account deletion only; the
  customer's cancel refuses it (`assertCustomerCanCancel`) and no professional action cancels a job.
- **Account deletion leaves tombstones** (`users/account-deletion.service.ts`, `account-erasure.ts`):
  other people's offers, jobs, chats and reviews point at the deleted user, and every view resolves
  those references (a missing document would be a 500), so the `users` document (and a
  professional's `professionals` document, same `_id`) stays with `deletedAt` set and everything
  personal removed; the email becomes a unique placeholder, so the address can sign up again. Views
  show the placeholder name "Deleted user" plus an `accountDeleted` flag the app translates. One
  transaction marks the account first (a conditional write, so a second submit gets 401), closes
  everything in progress through the same code as the user actions (`cancelRequestInTx`,
  `withdrawOfferInTx`, `cancelJobForDeletedProfessional`), anonymises what the other parties keep and
  revokes the sessions; images and the confirmation email follow after the commit. `deletedAt` is
  checked where a still-valid access token could act (`NOT_DELETED` in `users/user.model.ts`: `/me`,
  profile edits, refresh, sign-in lookups, creating requests, offers and reviews) and by
  `createNotifications`, which never stores anything for a deleted account; searches leave deleted
  professionals out (no categories; `deletedAt` where no category filters).

## 5. Auth

- Access token: HS256 JWT, 30 minutes, claims `sub`, `role`, `sid`, `typ`, `iss`/`aud` (per
  `APP_ENV`). Verified without a database read; one Redis `EXISTS` refuses tokens of revoked sessions
  (logout, token theft, password reset, first Google link), so revocation is immediate.
- Refresh token: opaque, 90 days sliding, `<sessionId>.<secret>.<HMAC tag>`, stored only as a SHA-256
  hash. Rotated on every refresh; any earlier genuine token of a live session revokes it (theft),
  a forged one revokes nothing, concurrent refreshes and retries after a lost response get the same
  successor while it is unused, for up to an access token's lifetime (`auth/refresh-token.ts`,
  `session.service.ts`).
- Passwords: argon2id, the app's rules, plus a breached-password check (k-anonymity, fails open).
  Google: id tokens verified against the web, iOS and (optional) Android client ids; the linking
  rules of BACKEND_INTEGRATION.md §3, including pre-account-hijacking handling.
- Email links open small server-rendered pages (en/he, RTL): verification needs a click (POST) so
  mail scanners cannot verify; reset links are single-use, 1 hour, and revoke every session.

## 6. Realtime and notifications

- `ws` at `/v1/realtime`, token in the `bearer.<token>` subprotocol (next to `professionals.v1`, the one
  the server selects; older apps: `?token=`): checked before the handshake (4001 otherwise), socket closed
  with 4001 when the token expires or the session is revoked, heartbeat ping/pong, per-user socket
  and upgrade limits. Frames are the app's `RealtimeEvent` union.
- Any instance publishes to Redis channel `${APP_ENV}:realtime`; every instance delivers to its own
  sockets of the addressed users. Revoked session ids travel on `${APP_ENV}:session-revoked`.
- `createNotifications` is the single entry point for every producer: it honours the recipient's
  category toggles, stores the inbox item (in the caller's transaction), then publishes
  `notification.created`, fans out Expo push (chunked, `pushEnabled`, to the push tokens of the
  recipient's live sessions: a token lives on the session that registered it, so signing out,
  revocation and expiry end the pushes with the session) and, for "Email updates",
  throttled emails to verified addresses. Push tickets wait in Redis for the receipts cron, which
  removes `DeviceNotRegistered` tokens from their sessions.

## 7. Redis

Every key and channel starts with `${APP_ENV}:` (`infra/keys.ts`, the only way to name keys), so
environments can share one Redis. Uses: cache (`cache:` geocoder answers, public profiles), rate limits
(`rl:`), cron tick claims and run locks (`lock:`), revoked sessions (`revoked-sid:`), push tickets,
geocoder pacing (`geo-gate:`), explorer event windows, pub/sub channels. Redis failures degrade
gracefully where safe (rate limits and the denylist let requests pass; cache misses go to the source).

## 8. Scheduled work

node-cron in every instance; each tick is claimed once across instances and each job runs under a
Redis lock (`SET NX PX`, released by its owner). Jobs: `offer-expiry` (5 min), `appointment-reminders`
(15 min, once per job via `reminderSentAt`), `push-receipts` (15 min). They
are idempotent, batch their work and can be disabled per process (`CRON_ENABLED`, `CRON_DISABLED_JOBS`).

## 9. Production hardening

helmet, CORS allow-list per environment, 100 kb JSON bodies, request ids, pino with redaction
(authorization, cookies, passwords, tokens, `?token=`), zod on every input, `strictQuery` and a
`$`-key guard (instead of mongoose `sanitizeFilter`, which would neutralise the server's own `$in`
filters), configurable `trust proxy` (validated in deployed environments), `/health` and `/ready`,
graceful shutdown within `SHUTDOWN_TIMEOUT_MS` (close HTTP and sockets, stop cron, finish in-flight
work, close MongoDB/Redis), unhandled rejection logging, env validation that refuses weak secrets
and missing provider credentials in staging/production, multi-stage non-root Docker image with a
`HEALTHCHECK`.

## 10. Tests

vitest + supertest against the real local MongoDB replica set and Redis: each test file gets its own
database and Redis key prefix (removed afterwards); providers are fakes injected through `deps`, time
is a `FakeClock`. Beyond behaviour, `test/query-plans.test.ts` and `test/write-paths.test.ts` assert
index use with MongoDB's profiler, `src/shared/__tests__/drift.test.ts` compares constants with the
app, and `npm run typecheck` includes the contract check against the app's types.
