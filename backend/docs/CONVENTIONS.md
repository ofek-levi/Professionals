# Backend conventions

How code is written in `backend/`. Every module follows these rules; the **catalog** module
(`src/modules/catalog`) and **health** module are the finished reference, and the template in
[§14](#14-module-template) shows a module with auth, validation, pagination, views and tests.

Stack: Node 22, TypeScript 6 (strict, ESM with `.js` import suffixes), Express 5, Mongoose 9
(MongoDB driver 7), ioredis 6, zod 4, pino, vitest 5 + supertest.

---

## 1. Module layout

```
src/modules/<module>/
  <entity>.model.ts        mongoose schema + TS interface (<Entity>Doc) + indexes (one comment per index: which query uses it)
  <module>.schemas.ts      zod schemas of bodies/queries/params
  <module>.service.ts      business rules (split into <use-case>.service.ts when it grows past ~200 lines)
  <module>.controller.ts   thin: validate → service → view
  <module>.routes.ts       create<Module>Router(deps): Router  (already exists as a stub — fill it)
  <module>.views.ts        pure DTO mappers + batch loaders
  <module>.jobs.ts         cron jobs (offers, jobs, notifications)
  __tests__/*.test.ts      vitest + supertest against real Mongo/Redis
```

Files stay short: aim ≤ 200 lines, hard cap ~300. One responsibility per file. Comments explain
*why* (a rule, a trade-off), briefly; no comments restating the code.

`src/routes.ts`, `src/cron-jobs.ts`, `src/models.ts` already import every module's router, jobs
and models. **Do not edit them**; fill your own files.

### Route ownership

| Module | Routes (all under `/v1`) |
|---|---|
| auth | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`, `/auth/password-reset`, `GET`+`POST /auth/verify-email`, `GET`+`POST /auth/reset-password` |
| users | `GET`/`PATCH /me`, `PUT`/`DELETE /me/avatar`, `POST /me/devices`, `DELETE /me/devices/:token` |
| catalog | `GET /catalog/categories` (done) |
| geo | `GET /geo/search`, `GET /geo/reverse` |
| customers | `GET`/`PATCH /customer/profile` |
| professionals | `GET`/`PATCH /professional/profile`, `GET /professionals`, `GET /professionals/:id`, `GET /professionals/:id/reviews` |
| requests | `POST /requests`, `GET`/`PATCH`/`DELETE /requests/:id`, `POST /requests/:id/publish`, `POST /requests/:id/cancel`, `GET /customer/requests`, `GET /professional/requests/nearby` |
| offers | `GET`/`POST /requests/:id/offers`, `GET`/`PATCH /offers/:id`, `POST /offers/:id/withdraw`, `POST /offers/:id/accept`, `GET /professional/offers` |
| jobs | `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/confirm`, `/start`, `/complete` |
| reviews | `POST /jobs/:id/review` |
| conversations | `GET /conversations`, `GET /conversations/unread-count`, `GET /conversations/:id`, `GET`/`POST /conversations/:id/messages`, `POST /conversations/:id/read` |
| notifications | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read-all`, `POST /notifications/:id/read` |
| dashboard | `GET /customer/dashboard`, `GET /professional/dashboard` |

Cron job names (fixed; `CRON_DISABLED_JOBS` uses them): `offer-expiry` (offers, every 5 min),
`appointment-reminders` (jobs, every 15 min), `push-receipts` (notifications, done). Images need
no cleanup job (§11).

## 2. Routers

Every router declares **full paths** and is mounted at `/v1` next to all the others, so:

- **Never `router.use(...)`** in a module router — it would run for every other module's
  requests too. Put middleware on each route.
- Order per route: per-IP rate limits → `requireAuth(deps)` → `requireRole('customer'|'professional')` →
  per-user rate limits → multipart → `asyncHandler(controller)`.
- **Every route has a rate limit of its own** with a unique bucket name (`src/__tests__/route-rate-limits.test.ts`
  fails otherwise): signed-in routes use `userRouteLimits(deps)` (`read`, `search`, `write`,
  `readMarker`), public ones `rateLimit(deps, '<name>', RATE_LIMITS.…)` (§13).

```ts
export function createOffersRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const limit = userRouteLimits(deps);
  router.get('/offers/:offerId', auth, limit.read('offers-get'), asyncHandler(offersController.getOffer(deps)));
  router.post('/offers/:offerId/accept', auth, requireRole('customer'), limit.write('offers-accept'), asyncHandler(offersController.accept(deps)));
  return router;
}
```

Public routes (sign-in/up, catalog, geo, email links) simply omit `requireAuth`.

## 3. Controllers

Thin: parse input → call one service → map to the DTO. They are factories taking `deps` and return
the response body; `asyncHandler` sends it as JSON (default 200, `{ status: 201 }` for creations).
Return `undefined` only after writing the response yourself (304, HTML pages, 204).

```ts
export const getOffer = (deps: AppDeps) => async (req: Request) => {
  const { params } = validateRequest(req, { params: offerParams });
  const offer = await findOfferForViewer(deps, authOf(req), params.offerId);
  return toOfferDetails(offer);
};
```

- The caller: `authOf(req)` or `authOf(req, 'professional')` → `{ userId: ObjectId, role, sessionId }`.
- **A professional's profile id equals their user id** (`professionals._id === users._id`), so
  `auth.userId` is also the professional id and "the professional's user" needs no lookup.
- Success bodies follow the app contract exactly (e.g. `{ success: true }` where the app's types
  say `SuccessResponse`).
- Language of the caller (for texts): `req.acceptsLanguages('he', 'en')` or the user's stored
  `language`.

## 4. Validation (zod 4)

- Schemas live in `<module>.schemas.ts`; port the rules from `frontend/src/lib/validation/*` and the
  mock backend. Every message is an i18n key built with `vm('request.descriptionTooShort')`
  (`src/shared/validation-messages.ts`, checked against the app by the drift test). Schemas without
  a message fall back to `validation:required` (missing) / `validation:invalid`.
- `validateRequest(req, { params, query, body })` returns typed values and throws **400
  `VALIDATION_ERROR`** with `fieldErrors` keyed by dotted path (`location.addressLine`,
  `preferredSchedule.date`, `limit`); errors of all parts are reported together. A category outside the catalog
  (message `vm('category.unsupported')`) turns it into **422 `UNSUPPORTED_CATEGORY`**.
  `parseInput(schema, value)` validates anything else the same way.
- Query strings: `queryEnumList`, `queryEnum`, `queryBoolean`, `queryNumber`, `queryString`
  (`src/lib/query-schemas.ts`) — arrays arrive comma separated (`?statuses=open,draft`).
- Ids in paths/bodies: `parseObjectId(value, 'Offer')` → a malformed id is a **404** (it cannot
  exist). In zod: `z.string()` then `parseObjectId` in the service, or a refine with
  `isObjectIdString` for body ids (→ 400 with the field path).
- Objects are stripped of unknown keys (zod default); `$`-prefixed keys never reach you
  (`rejectOperatorKeys`). Never pass request objects into Mongo filters — only parsed primitives.

## 5. Errors

Throw `ApiError` (`src/lib/errors.ts`) for anything the client caused or should know:

| Helper | Status / code |
|---|---|
| `ApiError.validation(fieldErrors, msg?, code?)` | 400 `VALIDATION_ERROR` (422 for `UNSUPPORTED_CATEGORY`, `OUTSIDE_SERVICE_AREA`) |
| `ApiError.unauthorized()` / `invalidCredentials()` / `invalidGoogleToken()` | 401 |
| `ApiError.forbidden(msg)` | 403 `FORBIDDEN` |
| `ApiError.notFound('Offer')` | 404 `NOT_FOUND` |
| `ApiError.conflict(msg, code?, fieldErrors?)` | 409 `CONFLICT` / `EMAIL_ALREADY_REGISTERED` / `DUPLICATE_OFFER` / `OFFER_EXPIRED` / `REQUEST_NOT_ACCEPTING_OFFERS` |
| `ApiError.invalidTransition(entity, from, to)` | 409 `INVALID_STATE_TRANSITION` |
| `ApiError.rateLimited()` | 429 `RATE_LIMITED` |
| `ApiError.unavailable(msg)` | 503 `SERVER_ERROR` (provider not configured / down) |

Use the same codes/statuses as the mock backend for the same situation. Anything else thrown is a
logged 500 `SERVER_ERROR` without details. A duplicate-key error (E11000) that escapes a service
becomes a generic 409 — map the ones you expect (e.g. `DUPLICATE_OFFER`) explicitly.

## 6. Services

- Contain the rules; never see `req`/`res`. Signature: `(deps, actor, input, tx?)` where `deps` is
  `AppDeps` or a `Pick<AppDeps, ...>` of what is used.
- **Time comes from `deps.clock.now()`** — never `new Date()`/`Date.now()` in services (tests drive
  time with `FakeClock`). Mongoose `createdAt/updatedAt` already follow the same clock.
- Authorization exactly like `frontend/src/test-utils/mock-backend/server/auth.ts` + the handlers (ownership checks
  return 403, missing → 404; a professional asking for a draft request gets 404, as the mock).
- Multi-document changes run in a transaction:

```ts
return withTransaction(deps.logger, async (tx) => {
  const offer = await OfferModel.findOneAndUpdate({ _id, status: 'pending' }, { $set: {...} }, { session: tx.session, returnDocument: 'after' }).lean();
  if (!offer) throw ApiError.conflict('An offer has already been accepted for this request');
  ... every read/write passes { session: tx.session } (or .session(tx.session)) ...
  await createNotification(deps, professionalUserId, input, tx);          // stored in the tx, pushed after commit
  await publishEvent(deps.realtime, [customerId, proId], event, tx);      // published after commit
  return result;
});
```

  Use conditional updates (`{ _id, status: 'pending' }`) and unique indexes for concurrency; the
  driver retries transient transaction errors (effects are collected per attempt).
- Mongoose 9: use `returnDocument: 'after'` (the `new` option is deprecated); `strictQuery` is on;
  `sanitizeFilter` is off on purpose (see `infra/mongo.ts`).

## 7. Data access and performance

- Reads: `.lean()` + a projection of the fields the view needs. Typed: `Model.find(...).lean<T[]>()`
  or the `*Doc` interfaces.
- Every query is served by an index declared next to the schema with a comment naming the
  query. Adding a query → add/extend an index in the owning model file (models were created by
  the foundation; module agents own and may refine their model, keeping it minimal: no field that
  no endpoint or rule reads, derived fields only for hot paths, with a comment why).
- No N+1: collect ids of a page, load each related collection once (`loadByIds(Model, ids,
  projection)` → `Map<hexId, doc>`, `src/lib/batch.ts`), then map in memory. Counts per item →
  one `$group` aggregation with `$in`.
- Dashboards/counters: `countDocuments` on indexed filters or one aggregation; never load all rows.
- Collections and ownership: users (users), sessions/emailTokens (auth; a session holds its install's push token), professionals,
  requests, offers, jobs, reviews, conversations/messages, notifications. Images are fields of their
  owner (`requests.photos`, `users.avatar`: `{ url, publicId }`), not a collection.

## 8. Pagination (every list)

`?cursor=&limit=` → `{ items, nextCursor, totalCount }`, keyset cursors (`src/lib/pagination.ts`):

```ts
const listQuery = z.object({ ...paginationQueryShape, statuses: queryEnumList(OFFER_STATUSES) });
const SORT: SortSpec = [{ path: 'updatedAt', direction: -1 }, { path: '_id', direction: -1 }];

const page = await findPage<OfferDoc>(OfferModel, {
  filter: { professional: auth.userId, ...(query.statuses ? { status: { $in: query.statuses } } : {}) },
  sort: SORT,
  page: { cursor: query.cursor, limit: query.limit },
  projection: OFFER_LIST_PROJECTION,
});
return { ...page, items: await toOfferWithRequestList(page.items) };
```

- Default 20, max 100 (the app's `APP_CONFIG.maxPageSize`; its explorer map asks for 100). Invalid
  limit/cursor → 400 with `fieldErrors.limit` / `fieldErrors.cursor`.
- Sort keys must be non-null and end with `_id`; the index must be `{ <equality filters>, <sort keys> }`.
- Aggregations (e.g. `$geoNear` then sort by distance): compute the sort field, then
  `...pageStages(SORT, page)` and `toPage(docs, page, SORT, total)`.
- Lists the app currently receives as plain arrays (`GET /conversations`, `GET /jobs`,
  `GET /requests/:id/offers`) are paginated too: document the contract change in `docs/API.md`.

## 9. Views (DTO mappers)

- `<module>.views.ts`: pure `toXDto(doc, related...)` functions returning the types in
  `src/shared/contract` (ported from `frontend/src/types`), plus async batch loaders
  `loadXs(ids): Promise<Map<string, X>>` that do the `$in` queries. ISO strings for dates, hex
  strings for ids, `null` (never `undefined`) for absent values.
- Privacy exactly like `frontend/src/test-utils/mock-backend/server/views.ts`: professionals get
  `approximateLocation(location, requestId)` (`src/lib/geo.ts`) and no notes until hired;
  contacts only for customers who hired the professional; public vs own profile.
- Shared, ready-made views (use them, don't duplicate):
  - `toUserDto(user, professionalDisplayName?)`, `USER_VIEW_PROJECTION` — `users/user.views.ts`
  - `loadUserDisplays(userIds)` → `{ role, displayName, shortName, avatarUrl }` — `users/user-display.views.ts`
  - `loadCustomerSummaries(ids)`, `toCustomerSummary`, `completedJobCounts` — `customers/customer-summary.views.ts`
  - `loadCustomerStats(id)`, `toCustomerProfileDto(user, stats)` — `customers/customer-profile.views.ts`
  - `loadProfessionalSummaries(ids)`, `toProfessionalSummary`, `toOwnProfessionalProfile`,
    `toPublicProfessionalProfile(pro, user, { isOwner, hiredByViewer })`, `professionalCity` — `professionals/professional.views.ts`
  - `toNotificationDto` — `notifications/notifications.views.ts`
  - `toServiceLocation(doc)`, `toLocationDoc(input)` — `infra/schema-parts.ts`
  - `customerShortName`, `fullName`, `messagePreview`, `normalizeMessageText` — `lib/text.ts`

## 10. Cross-module services

| API | Where | Notes |
|---|---|---|
| `createNotification(deps, userId, input, tx?)` / `createNotifications(deps, [{ userId, input }], tx?)` | `notifications/create-notification.service.ts` | Honours the category toggle (nothing stored when off), collapses unread `new_message` per conversation, stores (in `tx`), then publishes `notification.created` and fans out push in the background (`pushEnabled`). `input` is the typed `NotificationInput` union (`notification.factory.ts`): pass the docs you have. |
| `publishEvent(deps.realtime, userIds, event, tx?)` / `deps.realtime.publish(userIds, event)` | `infra/realtime` | `RealtimeEvent` union (`shared/contract/realtime.ts`), after commit when `tx` is given. |
| `ensureConversationForJob({ jobId, requestId, customerUserId, professionalUserId, now }, session?)` → conversation id | `conversations/conversation-lifecycle.service.ts` | Idempotent; pre-generate the job id with `newObjectId()`. `closeConversation(id, session?)` closes it (job cancelled). |
| `withTransaction(deps.logger, async (tx) => ...)` | `infra/mongo.ts` | `tx.session`, `tx.afterCommit(fn)`. |
| `bayesianRating(avg, count)` | `professionals/professional-rank.ts` | Keep `stats.rankScore` in sync whenever the rating changes. |
| `isDuplicateKeyError(error)` | `lib/errors.ts` | A unique index rejected a concurrent write (map it to the domain's 409). |
| `geoNearStage({ near, key, distanceField, maxDistanceKm, query })` | `lib/geo-near.ts` | `$geoNear` in the app's haversine km, so radius checks match the app exactly. |
| `denySessions(deps, sessionIds)` / `isSessionDenied(deps, sessionId)` | `infra/session-denylist.ts` | Revoked sessions; `requireAuth` and the realtime server refuse their access tokens. Revoke sessions only through `auth/session.service.ts`. |

### Expected exports between modules (built in parallel — use these names)

| Owner | Export | Used by |
|---|---|---|
| requests | `requests.views.ts`: `toCustomerRequestViews(requests: RequestDoc[]): Promise<CustomerRequestView[]>`, `toProfessionalRequestViews(requests, professional: ProfessionalDoc): Promise<ProfessionalRequestView[]>` | dashboard, offers (accept response) |
| requests | `matching.service.ts`: `findMatchingProfessionals(request, session?)` → `{ professionalId, distanceKm }[]` | requests (publish notifications), dashboard |
| offers | `offer-counters.service.ts`: `syncRequestOfferCounters(requestId, tx, change?)` (recount `offerCount`/`pendingOfferCount`, flip `open ⇄ offers_received`; `change` sets the status/accepted offer/job on accept and cancel), `rejectPendingOffers(requestId, reason, now, tx)` → rejected offers | requests (cancel), offers, offer-expiry cron |
| offers | `offers.views.ts`: `toOffersWithRequest(offers, viewer: AuthContext)`, `toOffersWithProfessional(offers, request)` | dashboard |
| jobs | `jobs.views.ts`: `toJobSummaries(jobs: JobDoc[]): Promise<JobSummary[]>`, `toJobDto(job, request)` | dashboard, offers (accept response), reviews |
| jobs | `job-lifecycle.service.ts`: `cancelJobForRequest(deps, job, now, tx)` (cancel + close conversation + `job.updated`) | requests (cancel) |
| notifications | `listRecentNotifications(userId, limit)` | dashboard |

Professional aggregates are updated by the module that changes their source, each only its own
fields, in the same transaction: `stats.responseTimeMinutes` (offers, on submit),
`stats.completedJobsCount` (jobs, on completion), `stats.averageRating`/`reviewCount`/`rankScore`
(reviews, on creation). Customer stats are counted on read (`loadCustomerStats`).

## 11. Realtime, push, email, storage, geo, Google

Always through `deps` (never import a provider): `deps.realtime`, `deps.push`, `deps.mailer`
(`send({ to, subject, html, text })`), `deps.storage` (`upload({ buffer, mimeType, folder })`,
`destroy(publicIds)`), `deps.geocoder` (`search`, `reverse`; cached + rate gated),
`deps.google.verify(idToken)` → identity or `null` (throws 503 when not configured).
Slow fire-and-forget work: `deps.background.run(label, fn)` (tests call `deps.background.drain()`).

Images are uploaded with their owner, never on their own: the route takes `imageMultipart(deps, {
field, maxFiles, tooManyFiles, jsonField? })` (`middleware/multipart.ts`: per-user image rate limit,
admission of posts in flight, multipart parsing, JSON `data` → `req.body`), the controller passes
`uploadedImages(req)` to the service, which validates everything else first, then
`storeImages(deps, ownerId, files, { folder, field })` (`infra/storage/store-images.ts`: file types,
daily bytes, upload) and saves `{ url, publicId }` on the owner; on failure it calls
`discardImages(deps, publicIds)` (requests: `discardUnsavedPhotos`, which keeps what a possibly
committed save shows), and images the owner no longer shows are discarded after the commit
(`tx.afterCommit` → `deps.background`). Errors about the images use `imageErrors` (they carry the
file field in `fieldErrors`, which is how the app tells them from other errors of the post).

## 12. Cron jobs

`<module>.jobs.ts` exports `xJobs(deps): CronJob[]` (`{ name, schedule, lockTtlMs, run }`). Each run
is wrapped in a Redis lock, must be idempotent and batch its work (bounded queries, `$in`), use
`deps.clock`, and notify through `createNotifications`. Tests call the exported job function
directly after moving `deps.clock`.

## 13. Redis: keys, cache, rate limits

- Keys only via `deps.keys.key(...)` (prefix `${APP_ENV}:`); cache via `deps.cache` (`get/set/del/wrap`).
- Cache only what is safe: geocoder results (done), public professional profile (short TTL,
  delete on profile/rating change), never per-user private data unless invalidated precisely.
- Rate limits: every budget is in `RATE_LIMITS` (`middleware/rate-limit.ts`). Per IP
  `rateLimit(deps, '<unique-name>', RATE_LIMITS.loginPerIp)`, per account
  `{ ...RATE_LIMITS.registerPerEmailAndIp, key: emailAndIpKey }` / `key: userKey`, per signed-in
  route `userRouteLimits(deps).read('<unique-name>')`. The name is the Redis bucket: share one
  between routes only on purpose (listed in `route-rate-limits.test.ts`). A global per-user (else
  per-IP) limit also covers `/v1`. Tests enable them with
  `createTestApp({ env: { RATE_LIMIT_ENABLED: 'true' } })`.

## 14. Module template

```ts
// widgets.schemas.ts
export const widgetParams = z.object({ widgetId: z.string() });
export const listWidgetsQuery = z.object({ ...paginationQueryShape, statuses: queryEnumList(WIDGET_STATUSES) });
export const createWidgetBody = z.object({
  name: z.string({ error: vm('required') }).trim().min(2, vm('invalid')).max(80, vm('invalid')),
  categoryId: z.enum(CATEGORY_IDS, { error: vm('category.unsupported') }),
});
export type CreateWidgetInput = z.output<typeof createWidgetBody>;

// widgets.service.ts
export async function createWidget(deps: Pick<AppDeps, 'clock' | 'realtime'>, auth: AuthContext, input: CreateWidgetInput) {
  const widget = await WidgetModel.create({ owner: auth.userId, ...input });
  await publishEvent(deps.realtime, [auth.userId], { type: 'profile.updated', professionalId: auth.userId.toHexString() });
  return widget.toObject<WidgetDoc>();
}
export async function listWidgets(auth: AuthContext, query: z.output<typeof listWidgetsQuery>) {
  return findPage<WidgetDoc>(WidgetModel, { filter: { owner: auth.userId }, sort: NEWEST_FIRST, page: query });
}

// widgets.controller.ts
export const create = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: createWidgetBody });
  return toWidgetDto(await createWidget(deps, authOf(req, 'professional'), body));
};
export const list = () => async (req: Request) => {
  const { query } = validateRequest(req, { query: listWidgetsQuery });
  const page = await listWidgets(authOf(req), query);
  return { ...page, items: page.items.map(toWidgetDto) };
};

// widgets.routes.ts
export function createWidgetsRouter(deps: AppDeps): Router {
  const router = Router();
  router.get('/widgets', requireAuth(deps), asyncHandler(list()));
  router.post('/widgets', requireAuth(deps), requireRole('professional'), asyncHandler(create(deps), { status: 201 }));
  return router;
}
```

```ts
// __tests__/widgets.test.ts
describe('POST /v1/widgets', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('creates a widget for the professional', async () => {
    const pro = await signInProfessional(deps);
    const res = await request(app).post('/v1/widgets').set(pro.headers).send({ name: 'Drill', categoryId: 'plumbing' }).expect(201);
    expect(res.body).toMatchObject({ name: 'Drill' });
    expect(deps.realtime.eventsFor(pro.user._id.toHexString())).toHaveLength(1);
  });

  it('validates the payload', async () => {
    const pro = await signInProfessional(deps);
    const res = await request(app).post('/v1/widgets').set(pro.headers).send({ name: 'x', categoryId: 'nope' }).expect(422);
    expect(res.body).toEqual({ code: 'UNSUPPORTED_CATEGORY', message: expect.any(String), fieldErrors: { name: ['validation:invalid'], categoryId: ['validation:category.unsupported'] } });
  });
});
```

## 15. Tests

- Location: `src/modules/<module>/__tests__/*.test.ts` (unit tests of libs next to the lib).
- Run against the real local MongoDB replica set and Redis. `test/setup.ts` gives **each test file
  its own database and Redis prefix** and removes them afterwards — never hard-code a database
  name, never `FLUSHDB`/`FLUSHALL`, never touch keys outside `deps.keys`.
- `createTestApp(options?)` → `{ app, deps }` with fakes: `deps.mailer.sent`, `deps.push.sent` /
  `.unregistered` / `.receipts`, `deps.storage.images`, `deps.google.issue({ email, sub })`,
  `deps.realtime.eventsFor(userId)`, `deps.geocoderProvider.calls`, `deps.clock.set/advance`.
  Options: `{ env: {...}, now: ISO, deps: {...} }`. `createTestDeps()` gives deps without an app.
- `beforeEach(clearDatabase)` for isolation between tests of a file.
- Data: `test/factories.ts` (`createCustomer`, `createProfessional`, `createRequest`, `createOffer`,
  `createJob`, `createSession`, `createPushSession`, `testLocation`, `TEL_AVIV`…); images and multipart
  bodies: `test/images.ts` (`JPEG`, `PNG`, …, `withForm(test, data, photos)`); callers:
  `test/auth.ts` (`signInCustomer(deps)`, `signInProfessional(deps, options)`, `accessTokenFor`,
  `bearer`). Realtime: `test/realtime.ts` (`startRealtimeServer`, `connectSocket`).
- Push is delivered in the background: `await deps.background.drain()` before asserting on it.
- Cover the happy path, authorization (401/403/404), validation format, state conflicts,
  pagination and the side effects (notifications, events, push) of every endpoint.

## 16. Style

- No `any`, no `@ts-ignore`, no non-null `!`; `import type` for types; `.js` suffix on relative imports.
- Names: `createXRouter`, `toXDto`, `loadXs`, `XDoc`, `XModel`, schemas `xBody`/`xQuery`/`xParams`.
- `npm run typecheck`, `npm run lint`, `npm test` must pass before a module is done.
- Contract differences with `frontend/src/types` go to `docs/API.md` (the app is updated later).
