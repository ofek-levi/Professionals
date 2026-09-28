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
    categories/ requests/ offers/ professionals/ jobs/ location/ map/ forms/
  features/
    auth/                   session provider, role guards, sign-in / sign-up screens, demo accounts
    customer/ professional/ requests/ offers/ jobs/ notifications/ messaging/ reviews/ profiles/ settings/
      *.ts                  pure business logic (state machines, selectors, sorting, matching)
      screens/*.tsx         screen components rendered by src/app routes
      components/*.tsx      feature-private components
  services/
    api/                    client.ts, transport.ts, http-transport.ts, endpoints/*, config.ts, index.ts
    auth/session-store.ts   persisted access token + identity
    auth/google-*.ts        Google sign-in config, mock id tokens, real sign-in hook (expo-auth-session)
    realtime/               RealtimeClient (mock event bus today, WebSocket later)
    location/               device location permission & position (expo-location), isolated
    push/                   push provider abstraction (simulated today)
  hooks/
    queries/                useXxx query hooks + query-keys.ts (ALL keys live there)
    mutations/              useXxx mutation hooks + invalidation.ts
  providers/                AppProviders, navigation theme + tab bar options, realtime wiring, bootstrap
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
  `DomainError`s (`src/features/shared/domain-error.ts`) to `{ status, data: ApiErrorBody }`.
- Access tokens are `demo-token:<userId>`.
- Accounts: the `credentials` table (keyed by the lower-cased email) holds salted SHA-256 password
  hashes (`src/mocks/server/passwords.ts`, pure JS; never plaintext) and the linked Google account id.
  Every seeded user signs in with its email and `Demo1234`. `services/account-service.ts` implements
  login, registration (user + customer or professional profile + credential, in one transaction),
  Google sign-in and password reset. Newly registered professionals match open requests right away
  because matching is computed from the profile (categories + service area). Changing a
  professional's contact email moves the credential (409 if another account uses it).
- `MOCK_DB_SCHEMA_VERSION` (db.ts) is bumped whenever stored rows change shape; persisted data of
  another version is re-seeded.
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
| POST /auth/login | public | `AuthSession` (401 `INVALID_CREDENTIALS`) |
| POST /auth/register | public | `AuthSession` (409 `EMAIL_ALREADY_REGISTERED`, 422, 401 `INVALID_GOOGLE_TOKEN`) |
| POST /auth/google | public | `GoogleAuthResponse`: `signed_in` + session, or `registration_required` + profile (401 `INVALID_GOOGLE_TOKEN`) |
| POST /auth/password-reset | public | `SuccessResponse` (always, for a valid email) |
| POST /auth/logout | any | `SuccessResponse` |
| GET /me | any | `CurrentUserResponse` |
| POST /me/devices | any | `SuccessResponse` |
| GET /catalog/categories | public | `CategoryCatalog` |
| GET /geo/search?q&limit · GET /geo/reverse?lat&lng | public (a professional picks the base address while signing up) | `PlaceSuggestion[]` · `PlaceSuggestion` |
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
| GET /professionals?categoryId&lat&lng · /professionals/:id · /professionals/:id/reviews | any | … (`/professionals/:id`: approximate base and area center; `contact` only for customers who hired the pro, otherwise `null`) |
| GET /jobs?scope · GET /jobs/:id | party | `JobSummary[]` · `JobDetails` |
| POST /jobs/:id/confirm · /start | professional | `Job` |
| POST /jobs/:id/complete | party | `Job` |
| POST /jobs/:id/review | customer | `Review` |
| GET /notifications · /notifications/unread-count | any | … |
| POST /notifications/:id/read · /notifications/read-all | owner | … |
| GET /conversations · /conversations/:id · /conversations/:id/messages | participant | … |
| POST /conversations/:id/messages · /conversations/:id/read | participant | `Message` · `SuccessResponse` |

Realtime events (`src/services/realtime/types.ts`, pushed to the affected users):
`notification.created`, `message.created`, `conversation.read` (read receipt: `readerId` read the
other participant's messages up to `readAt`; emitted to both participants when
`POST /conversations/:id/read` or a reply marks messages read), `request.updated`, `offer.updated`,
`job.updated`, `profile.updated`. `src/providers/realtime-events.ts` applies them to the cache.

Pagination: list endpoints take `cursor` (opaque) and `limit` (default `APP_CONFIG.pageSize` = 20,
at most `APP_CONFIG.maxPageSize` = 100; larger values are rejected with 422 `VALIDATION_ERROR`) and
return `Paginated<T> { items, nextCursor, totalCount }`.

Errors: `ApiErrorBody { code, message, fieldErrors? }` with HTTP status: 400/422 `VALIDATION_ERROR`
(`UNSUPPORTED_CATEGORY`, `OUTSIDE_SERVICE_AREA`), 401 `UNAUTHORIZED` / `INVALID_CREDENTIALS` /
`INVALID_GOOGLE_TOKEN`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT` / `EMAIL_ALREADY_REGISTERED` /
`INVALID_STATE_TRANSITION` / `DUPLICATE_OFFER` / `OFFER_EXPIRED` / `REQUEST_NOT_ACCEPTING_OFFERS`,
0 `NETWORK_ERROR` (simulated). A 401 signs the user out (`sessionStore.handleUnauthorized`) except
for requests sent with `skipUnauthorizedHandler` – the public sign-in endpoints of
`endpoints/auth.ts`, where it means failed credentials.

## 5. React Query conventions

- Keys: only from `src/hooks/queries/query-keys.ts`, always scoped by the signed-in user id.
- One hook per endpoint the UI uses (`useRequest`, `useNearbyOpenRequests`, `useAcceptOffer`, …).
  Screens never build keys or call `queryClient` themselves. Endpoints no screen needs yet (e.g.
  `GET /professionals` search) keep their typed function in `src/services/api/endpoints` and their
  mock handler, but get no hook until a screen uses them.
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
- Only irreversible/important actions ask for confirmation via `useConfirm()` (accept an offer,
  cancel a request, withdraw an offer, mark a job completed, delete a draft, reset demo data); results
  are surfaced with `useToast()`. One primary (full-width, usually sticky) action per screen.
- Navigation: the bottom tabs are the single entry point per feature – customer: Home · Requests ·
  Inbox · Profile; professional: Home · Explore · Work (`?tab=offers|jobs`) · Inbox
  (`?tab=updates|messages`) · Profile; the customer's Requests tab takes `?tab=active|past`. Build
  links with `routes` (`src/lib/routes.ts`); notifications and push payloads resolve through
  `notificationTargetToHref` straight to these destinations. Offers are seen and acted on from the
  request screen (`/requests/:id`), for both roles – there is no separate offer screen. Cancelling a
  booking also lives there only ("Cancel request"; the job screen has no cancel action). The Inbox
  shows chat messages under Messages only: `new_message` notifications are left out of Updates, and
  the tab badge is always Updates + Messages (`src/features/notifications/inbox-counts.ts`).
- Design language and component rules: `src/components/README.md`.
- Safe areas: use `<Screen>` which handles insets, keyboard avoidance and pull-to-refresh.
- Stack screens opened with nothing to go back to (deep link, notification on a cold start, web
  refresh) get a header button to the signed-in role's home (`renderHeaderHomeButton`,
  `src/providers/header-home-button.tsx`, used by `src/app/_layout.tsx`).

### Route map (src/app)

Signed-out routes sit in `Stack.Protected guard={!signedIn}`, signed-in ones in
`Stack.Protected guard={signedIn}` (`src/app/_layout.tsx`); `/` redirects to `/sign-in` or the role's
home. Build every link with `routes` (`src/lib/routes.ts`).

| Route | Who | Screen |
|---|---|---|
| `/sign-in` | signed out | entry: **Create account**, **Sign in**, then the demo account picker (hidden in `http` mode) |
| `/auth/login` | signed out | email + password, "Continue with Google", links to reset and sign-up |
| `/auth/sign-up?role=customer\|professional` | signed out | step flow: role → account → services → service area (customers stop after the account); `role` skips the first step |
| `/auth/forgot-password` | signed out | request a reset link (same answer whether or not the account exists) |
| `/customer/(home\|requests\|inbox\|profile)` | customer | tabs (`requests?tab=active\|past`, `inbox?tab=updates\|messages`) |
| `/professional/(home\|explore\|work\|inbox\|profile)` | professional | tabs (`work?tab=offers\|jobs`) |
| `/requests/new`, `/requests/:id`, `/requests/:id/offer` | customer · both · professional | new request, request details (offers live here), send/edit offer |
| `/professionals/:id`, `/professionals/:id/reviews` | signed in | public profile, all reviews |
| `/jobs/:id`, `/jobs/:id/review` | both · customer | job tracking, leave a review |
| `/conversations/:id`, `/profile/edit`, `/settings` | signed in | chat, edit own profile, settings |

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
  router's own, so it can stop it) restores the screen's history entry and calls the screen.
  A role in the link (`?role=`) skips the role step; the progress counts from the first step shown
  and shows no total until a role is chosen (`signUpProgress`).
- Every submit runs through `useSingleFlight`: a second tap while one is being validated or sent
  is ignored (the button's loading state only starts once the mutation is pending), and results
  that arrive after the screen unmounted are dropped.
- A new Google identity (`registration_required`) is kept in memory in
  `pending-google-sign-up.ts` (never in the URL) and cleared when the sign-up screen unmounts or a
  session starts. `GoogleSignInButton` hides itself when neither real Google sign-in nor the mock
  backend is available (`useGoogleSignInAvailable`).
- An email typed on one auth screen is handed to the next one in memory (`auth-email-hint.ts`,
  never in the URL): "Sign in with this email" (sign-up → sign in) and "Forgot password?"
  (sign in → reset) prefill it.

### Maps (src/components/map)

One component, `AppMap`, renders every map: Leaflet with OpenStreetMap raster tiles (no API key,
no native module; usage and examples in `src/components/README.md`).

```
AppMap (app-map.tsx)          props + theme → MapPageState (map-page-state.ts); focus region,
  │                           ref.animateToRegion, zoom buttons (RN IconButtons)
  └─ LeafletMap host          leaflet/leaflet-map.tsx: react-native-webview (iOS/Android)
       │                      leaflet/leaflet-map.web.tsx: sandboxed <iframe srcdoc> (web)
       ├─ useMapBridge        channel, ready handshake, command queue, state dedupe, validation,
       │                      reload after a crashed page, 15 s timeout → error + retry
       └─ page document       map-document.ts: CSP + Leaflet CSS/JS + our CSS + glyph table +
                              map-page-script.ts (the in-page runtime, a plain ES5 string)
```

- **Bridge** (`leaflet/map-protocol.ts`): JSON messages tagged with a random per-mount channel id.
  Host → page: the full declarative `state` (markers, circles, pin, theme colors, tiles and
  attribution, RTL, insets, labels) – the page diffs it by id, so updates never reset the camera
  or the selection – plus camera commands (`setView`, `animateToRegion`, `zoomIn`/`zoomOut`) in
  Leaflet bounds (the host converts regions with `map-geometry.ts`). Page → host: `ready`,
  `markerPress`, `mapPress`, `pinDragEnd`, `regionChange`, `error`, all validated by
  `parsePageMessage` (channel, shape, ranges, size) before any callback runs. Native hosts inject
  `window.__appMap.receive(<escaped JSON>)` and listen to `ReactNativeWebView.postMessage`; the
  web host uses `postMessage` both ways and accepts only its own iframe's messages.
- **Hosts:** the document is built once per mount and never reloaded for prop, theme or language
  changes. The WebView is locked down (https `baseUrl`, no file access or storage, a navigation
  policy that opens links in the browser); the iframe has no `allow-same-origin`. Inside scroll
  views, Android keeps drags through `nestedScrollEnabled`, iOS through the scroll lock that
  `Screen`/`Sheet` provide (`ui/scroll-lock.tsx`).
- **Generated assets** (`leaflet/generated/`, eslint-ignored, committed): Leaflet's JS/CSS and the
  SVG paths of the marker glyphs (every catalog icon + `MAP_EXTRA_ICONS`), written by
  `npm run generate:map-assets` from the `leaflet` and `@mdi/js` dev dependencies. App code never
  imports those packages.
- **Tiles:** `src/constants/map-tiles.ts` (`EXPO_PUBLIC_MAP_TILE_URL` /
  `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`, https only, plain-text credit). The public OSM servers are
  for light use – production should use a tile provider or its own tiles (README → Maps).
- **Tests:** `jest.setup.ts` mocks `react-native-webview` with a prop-exposing View;
  `__test-utils__/map-bridge.ts` plays the page's side. The page runtime itself is tested in jsdom
  with the real document and Leaflet (`leaflet/__tests__/map-page.test.ts`).

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
- RTL: Hebrew forces RTL (`I18nManager.forceRTL`) and reloads the app once (`reloadAppAsync`). On web
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
