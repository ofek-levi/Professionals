# Architecture & Conventions

Two-sided local services marketplace (customers ⇄ professionals) built with **Expo SDK 57**
(React Native 0.86, React 19.2, TypeScript 6, Expo Router 57, React Compiler enabled).
There is **no real backend**: an in-app mock backend implements the REST contract so that a real
server can replace it by switching the API transport.

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
   │  ApiClient.get/post/patch/delete
   ▼
Transport (src/services/api/transport.ts)
   ├─ HTTP transport (fetch)            EXPO_PUBLIC_API_MODE=http
   └─ Mock transport → Mock server       EXPO_PUBLIC_API_MODE=mock (default)
                        (src/mocks)       in-memory DB + AsyncStorage persistence
```

Hard rules

1. **UI never imports from `src/mocks`**, and never calls `api.*` directly. Screens/components use
   hooks from `src/hooks`. (Exceptions: `src/services/api/index.ts` and `src/services/realtime/index.ts`
   are the only modules allowed to import `src/mocks`.)
2. **No business rules in screens.** Status transitions, allowed actions, matching, sorting and
   validation live in `src/features/<feature>/*.ts` (pure functions) and `src/lib/validation`.
   The mock server uses the exact same functions, so client affordances and server rules agree.
3. **No hard-coded user facing strings.** Everything goes through i18next (`useTranslation`).
4. **No hard-coded colors/sizes/fonts.** Use theme tokens via `useTheme()` / `makeStyles()`.
5. Use stable ids (`CategoryId`, entity ids) for logic, never display names.
6. No `any`. Prefer discriminated unions and `satisfies`.

## 2. Folder structure

```
src/
  app/                      Expo Router routes – thin files that render screens from src/features
  components/
    ui/                     design system primitives (AppText, Button, Card, Badge, TextField, …)
    categories/ requests/ offers/ professionals/ jobs/ location/ map/ forms/ notifications/
  features/
    auth/                   session provider, role guards, demo sign-in
    customer/ professional/ requests/ offers/ jobs/ notifications/ messaging/ reviews/ profiles/ settings/
      *.ts                  pure business logic (state machines, selectors, sorting, matching)
      screens/*.tsx         screen components rendered by src/app routes
      components/*.tsx      feature-private components
  services/
    api/                    client.ts, transport.ts, http-transport.ts, endpoints/*, config.ts, index.ts
    auth/session-store.ts   persisted access token + identity
    realtime/               RealtimeClient (mock event bus today, WebSocket later)
    location/               device location permission & position (expo-location), isolated
    push/                   push provider abstraction (simulated today)
  hooks/
    queries/                useXxx query hooks + query-keys.ts (ALL keys live there)
    mutations/              useXxx mutation hooks + invalidation.ts
  types/
    domain/                 entities (User, ServiceRequest, Offer, Job, Review, …)
    api/                    request/response DTOs, pagination, error codes
  constants/                category catalog, urgency levels, status models, notification types, app config
  lib/                      query-client.ts, routes.ts, validation/ (zod schemas)
  mocks/                    mock backend: data/ (seed), factories/, server/ (db, router, handlers, services)
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
  until their offer is accepted. Distances are still computed from the real location.

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
| in_progress            | completed                                                   |
| completed, cancelled   | — (terminal)                                                |

Offer: `pending → accepted | rejected | withdrawn | expired` (all terminal). Only one offer per
request can ever be `accepted`. A professional can have at most one *active* (pending/accepted)
offer per request; pending offers can be edited.

Job: `awaiting_confirmation → scheduled → in_progress → completed`, `awaiting_confirmation|scheduled → cancelled`.
Job status mirrors onto the request status (`JOB_STATUS_META[status].requestStatus`).

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

## 4. Mock backend (src/mocks)

- `createMockServer(options)` returns a `MockServer` (`src/mocks/server/types.ts`); `getMockServer()`
  is the app singleton. Requests go through `handle(TransportRequest)` which: awaits `ready()`,
  authenticates the bearer token, runs scheduled tasks (offer expiry, appointment reminders), routes
  to a handler, deep-clones the JSON response (simulates serialization) and maps thrown
  `MockHttpError`s to `{ status, data: ApiErrorBody }`.
- Access tokens are `demo-token:<userId>`.
- The in-memory DB is seeded from `src/mocks/data` (timestamps relative to "now"), persisted to
  AsyncStorage (debounced) and can be reset (`demoTools.resetDemoData()`).
- All mutations go through the **lifecycle service** (`src/mocks/server/services/lifecycle-service.ts`)
  which uses the shared state machines (`src/features/*/…-status-machine.ts`) and the
  **notification service** (`…/services/notification-service.ts`) that builds notifications with
  `src/features/notifications/notification-factory.ts` and emits realtime events.
- Demo simulator (optional, on by default in the app, off in tests): other professionals send offers
  a few seconds after a customer publishes a request; the counterpart auto-replies to chat messages.

### REST contract

| Method & path | Role | Response |
|---|---|---|
| GET /auth/demo-accounts | public | `DemoAccount[]` |
| POST /auth/demo-login | public | `AuthSession` |
| POST /auth/logout | any | `SuccessResponse` |
| GET /me | any | `CurrentUserResponse` |
| POST /me/devices | any | `SuccessResponse` |
| GET /catalog/categories | public | `CategoryCatalog` |
| GET /geo/search?q&limit · GET /geo/reverse?lat&lng | any | `PlaceSuggestion[]` · `PlaceSuggestion` |
| POST /uploads/images | any | `UploadedImage` |
| GET /customer/dashboard | customer | `CustomerDashboard` |
| GET /customer/requests?section&statuses&cursor&limit | customer | `Paginated<CustomerRequestView>` |
| GET/PATCH /customer/profile | customer | `{ user, profile }` |
| POST /requests | customer | `CustomerRequestView` |
| GET /requests/:id | owner customer / matching or offering professional | `RequestDetailsResponse` |
| PATCH /requests/:id · DELETE /requests/:id | owner (draft) | `CustomerRequestView` · `SuccessResponse` |
| POST /requests/:id/publish · /cancel | owner | `CustomerRequestView` |
| GET /requests/:id/offers?sort&statuses | owner | `OfferWithProfessional[]` |
| POST /requests/:id/offers | professional | `Offer` |
| GET /offers/:id | request owner / offer owner | offer + professional + request |
| PATCH /offers/:id · POST /offers/:id/withdraw | offer owner | `Offer` |
| POST /offers/:id/accept | request owner | `AcceptOfferResponse` |
| GET /professional/dashboard | professional | `ProfessionalDashboard` |
| GET /professional/requests/nearby?… | professional | `Paginated<ProfessionalRequestView>` |
| GET /professional/offers?statuses&cursor&limit | professional | `Paginated<OfferWithRequest>` |
| GET/PATCH /professional/profile | professional | `OwnProfessionalProfile` |
| GET /professionals?categoryId&lat&lng · /professionals/:id · /professionals/:id/reviews | any | … |
| GET /jobs?scope · GET /jobs/:id | party | `JobSummary[]` · `JobDetails` |
| POST /jobs/:id/confirm · /start | professional | `Job` |
| POST /jobs/:id/complete | party | `Job` |
| POST /jobs/:id/review | customer | `Review` |
| GET /notifications · /notifications/unread-count | any | … |
| POST /notifications/:id/read · /notifications/read-all | owner | … |
| GET /conversations · /conversations/:id · /conversations/:id/messages | participant | … |
| POST /conversations/:id/messages · /conversations/:id/read | participant | `Message` · `SuccessResponse` |

Errors: `ApiErrorBody { code, message, fieldErrors? }` with HTTP status: 400/422 `VALIDATION_ERROR`
(`UNSUPPORTED_CATEGORY`, `OUTSIDE_SERVICE_AREA`), 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`,
409 `CONFLICT` / `INVALID_STATE_TRANSITION` / `DUPLICATE_OFFER` / `OFFER_EXPIRED` /
`REQUEST_NOT_ACCEPTING_OFFERS`, 0 `NETWORK_ERROR` (simulated).

## 5. React Query conventions

- Keys: only from `src/hooks/queries/query-keys.ts`, always scoped by the signed-in user id.
- One hook per endpoint (`useRequest`, `useNearbyOpenRequests`, `useAcceptOffer`, …). Screens never
  build keys or call `queryClient` themselves.
- Mutations invalidate through helpers in `src/hooks/mutations/invalidation.ts` (e.g.
  `invalidateRequestGraph`). Realtime events reuse the same helpers.
- Optimistic updates: marking notifications read, sending chat messages, editing profile.
- Lists that can grow use `useInfiniteQuery` with cursor pagination.
- Errors are `ApiError` (`src/services/api/errors.ts`); render with `<ErrorState error={…} onRetry />`
  which maps `error.code` to `errors:codes.<CODE>`.

## 6. UI conventions

- Theme: `const useStyles = makeStyles((t) => ({ … }))` / `const t = useTheme()`. Colors from
  `t.colors`, status/urgency colors from `t.colors.tones[tone]`, spacing `t.spacing`, radii `t.radii`,
  text styles via `<AppText variant="heading">`.
- Icons: `<Icon name="…" />` (MaterialCommunityIcons). Directional icons (chevrons/arrows) must pass
  `flipInRTL`.
- RTL: use `marginStart/End`, `paddingStart/End`, `start/end` – never `left/right` for layout.
  `flexDirection: 'row'` mirrors automatically. `AppText` aligns to the start edge.
- Touch targets ≥ 44pt, `accessibilityRole`/`accessibilityLabel` on interactive elements.
- Every data screen handles loading (skeleton), error (retry), empty and success states.
- Destructive/important actions ask for confirmation via `useConfirm()`; results are surfaced with
  `useToast()`.
- Safe areas: use `<Screen>` which handles insets, keyboard avoidance and pull-to-refresh.

## 7. Localization

- i18next + react-i18next, typed keys (`src/i18n/i18next.d.ts`). English is the source of truth;
  Hebrew files are typed `LocaleNamespace<typeof en…>` so missing keys fail type-checking, and every
  `*_other` plural requires a Hebrew `*_two` (dual) form.
- Namespaces (one file per namespace per language): common, errors, validation, auth, settings,
  location, customer, requests, offers, reviews, profile, professional, explore, jobs, notifications,
  messaging. Use `useTranslation(['<ns>', 'common'])` and `t('common:actions.save')` for shared keys.
- Zod schemas use translation keys as messages (e.g. `'validation:request.descriptionTooShort'`);
  form fields translate them.
- Category names come from the catalog as `LocalizedText` (`{ en, he }`), so a backend can add
  categories without an app release; use `useLocalizedText()` / `useCategoryName()`.
- RTL: Hebrew forces RTL (`I18nManager.forceRTL`) and reloads the app once (`reloadAppAsync`); on web
  `<html dir>` is switched live.
