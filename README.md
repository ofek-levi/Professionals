# Professionals — local services marketplace (Expo)

A two-sided mobile marketplace that connects **customers** who need help at home (repairs,
maintenance, renovation, moving, tech and more) with **qualified local professionals**.
Customers post a request, professionals nearby discover it on a live map and send offers, and the
customer compares offers and hires the best fit. After that, the two sides track the job, chat and
leave reviews.

Built with **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript 6, Expo Router, React
Compiler). The app is client-only: an in-app **mock backend** implements the full REST contract
behind a swappable transport, so a real server can replace it without touching the UI.
English and Hebrew (RTL) are supported, in light and dark themes.

---

## Quick start

```bash
npm install
npx expo start           # press i / a / w, or scan the QR code with Expo Go
```

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run ios` / `npm run android` / `npm run web` | Open on a simulator/emulator or in the browser |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-expo`, React Compiler rules) |
| `npm test` | Jest (`jest-expo`) unit + integration tests |
| `npm run verify` | typecheck + lint + tests |

### Maps

The job map and location pickers use **react-native-maps**
(version 1.27.2, the one bundled with SDK 57; checked with `expo install --check`).

- **Expo Go (iOS & Android):** works out of the box (Apple Maps on iOS, Google Maps on Android).
- **Development / production builds:**
  - **iOS** uses Apple Maps and needs no key.
  - **Android** needs a Google Maps SDK key. Set `GOOGLE_MAPS_ANDROID_API_KEY` before
    `npx expo prebuild` / `eas build`. `app.config.ts` passes it to the `react-native-maps` config
    plugin.
- **Web:** `react-native-maps` has no web support, so `AppMap` has a `.web.tsx` implementation.
  It is an interactive, pannable/zoomable canvas with the same markers, radius circles and
  tap-to-place pin, so every flow can be tested in a browser.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_MODE` | `mock` | `mock` uses the in-app backend; `http` uses a real backend |
| `EXPO_PUBLIC_API_BASE_URL` | `https://api.example.com/v1` | Real API base URL (http mode) |
| `EXPO_PUBLIC_MOCK_FAILURE_RATE` | `0` | Probability (0–1) of simulated network failures |
| `EXPO_PUBLIC_MOCK_PERSIST` | `true` | Persist the mock database across launches |
| `GOOGLE_MAPS_ANDROID_API_KEY` | – | Google Maps key for Android native builds |

---

## Demo accounts & walkthrough

There is no registration or password. The sign-in screen lists demo accounts (switch
**Customer / Professional**). You can switch accounts at any time from **Profile → Settings →
Switch account**. All data lives in the mock backend and is shared between accounts, so actions
by one role show up for the other.

| Account | Role | Good for testing |
|---|---|---|
| Noa Levi (Florentin, Tel Aviv) | Customer | Compare 3 offers on a leak, chat with her electrician, review a finished job, continue a draft |
| Daniel Cohen (Ramat Gan) | Customer | Choose a mover, follow an in-progress Wi-Fi job, publish a request and watch offers arrive live |
| Avi Mizrahi — AquaFix Plumbing | Professional | Plumbing & leak jobs on the map, pending offer on Noa's leak, reviews |
| Yael Ben-David — BrightSpark Electric | Professional | Confirm → start → complete Noa's electrical job, chat |
| Moshe Katz — CoolAir HVAC | Professional | AC / appliance offers, expired offers |
| Dana Shapiro — Handy Dana | Professional | New 5★ review, handyman / assembly / TV mounting jobs |
| Rami Haddad — Swift Moving | Professional | Compete for Daniel's move, junk removal & heavy lifting |
| Lior Azulay — FixIT Home Tech | Professional | Finish Daniel's in-progress Wi-Fi job |

### End-to-end scenario (≈5 minutes)

1. **Customer: Daniel Cohen** → *Request a service* → Plumbing. Describe the problem, optionally add
   photos, choose the address (search, map pin or current location), pick an urgency
   (Emergency / Urgent / Normal / Flexible) and optionally a preferred date. Then **Publish**.
2. Keep the request open. With **Simulated activity** on (Settings → Demo tools, on by default), other plumbers send
   offers within ~30 seconds. Each one shows a banner (a simulated push notification) and appears
   in the offers list. Sort by price, date or rating, open **Compare**, and view a pro's profile and
   reviews.
3. **Switch to Avi Mizrahi (professional)**. A *new matching request* notification is waiting.
   **Explore** shows the request on the map (colored by urgency) and in the list, and filters
   (category, distance, urgency, date, offers) apply to both. Open it; the address is approximate
   until you are hired. Tap **Send an offer**, then set price, date, time, duration and a message.
4. **Switch back to Daniel**. Open the request, compare offers and **Accept** Avi's offer. The
   request becomes *Pro selected*, the other offers are marked *not selected*, and a job and a chat
   are created.
5. **Avi**: *Offer accepted* → the job now shows the full address → **Confirm appointment** →
   **Start job**. Chat with the customer.
6. **Daniel**: **Mark as completed** → **Leave a review**.
7. **Avi**: *Review received*; the rating and review count update on the public profile.

Other things to try: cancel a request that has offers (the professionals are notified), edit or
withdraw a pending offer, edit a professional's categories, service area and weekly hours, switch
to Hebrew (the whole UI mirrors to RTL), dark mode, and **Unreliable network** in Demo tools
(error states with retry).

---

## Features

**Customer**
- Home with a request hero, popular services, browse by service group, a live summary (open
  requests, waiting offers, active jobs), upcoming jobs, "rate your pro" prompts and recent requests.
- Multi-step request wizard. Steps: service (from the strict catalog), description, optional photos
  (multiple, previews, remove), notes, location (search / map pin / GPS with permission fallback),
  urgency, and optional preferred date and time window. It supports drafts and validates each step.
- My Requests, grouped as drafts / awaiting offers / with offers / active / completed / cancelled.
- Request details:
  - a status timeline;
  - cancellation with a reason;
  - offers with sorting (recommended, lowest price, earliest, highest rating, most reviews);
  - highlight badges and a side-by-side compare table;
  - explicit acceptance with confirmation.
- Public professional profiles: bio, categories, rating breakdown, reviews, service area map, weekly
  hours and business info.
- Job tracking, chat, completion and reviews.

**Professional**
- Home: earnings, rating, nearby jobs, items that need attention (confirmations, expiring offers),
  upcoming appointments, pending offers and recent notifications.
- **Explore jobs:**
  - an interactive map with the service-area circle and urgency-colored markers;
  - a preview card for the selected job;
  - a list view with infinite scroll and sorting;
  - shared filters for category, distance, urgency, preferred-date window, offer presence and
    hiding jobs already offered on.
- Request details that keep the address private until acceptance, plus a submit/edit offer form
  (price, date, time, duration, message). The form checks the urgency window and working hours
  and blocks duplicate offers.
- My Offers by status (edit / withdraw), jobs (upcoming / active / completed), and a
  confirm → start → complete workflow.
- A profile editor for categories, service area and radius, weekly availability, contact, business
  info and starting price, with a profile strength meter.

**Both roles**
- Notification center: unread/read, day grouping, mark read, mark all read, deep links. In-app
  banners act as simulated push notifications.
- Job chat with optimistic sending, retry, read receipts and day separators.
- Settings: language (English / עברית with RTL), theme, notification preferences, demo tools
  (simulated activity, unreliable network, reset data), switch account and sign out.

---

## Architecture

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the layering rules, domain and status
models, and the REST contract. **[docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)** lists
what a real backend must implement.

```
Screen/component ──> React Query hooks ──> api.* endpoint functions ──> ApiClient ──> Transport
 (src/app, src/features)  (src/hooks)        (src/services/api/endpoints)               ├─ HTTP (fetch)
                                                                                         └─ Mock server (src/mocks)
```

```
src/
  app/            Expo Router routes (thin; render screens from src/features)
  features/       feature screens + components + pure business logic (state machines, matching,
                  sorting, notification factory, availability, view models)
  components/     design system (ui/) + shared domain components (categories, requests, offers,
                  professionals, jobs, location, map, forms)
  hooks/          React Query queries/mutations, centralized query keys and invalidation
  services/       api (client, transports, endpoints), auth session store, realtime, push, location
  types/          domain entities and API DTOs
  constants/      category catalog, urgency levels, status models, notification types, app config
  lib/            query client, routes, zod validation schemas
  mocks/          mock backend: seed data, factories, router, handlers, services, scheduler, simulator
  i18n/           i18next setup, RTL handling, typed en/he resources
  theme/          design tokens, theme provider, makeStyles
  utils/          geo, dates, formatting, ids
```

Key decisions:
- **Expo Router** with role-specific tab navigators (`/customer/*`, `/professional/*`) guarded by
  `Stack.Protected`, plus shared stack screens and deep links (`professionals://requests/<id>`).
- **TanStack Query** for all server state. Query keys live in one place and are scoped per user, so
  switching accounts never leaks cached data. Invalidation helpers are centralized and also used
  by realtime events. Updates are optimistic for notifications, chat and profiles, and job lists use
  cursor pagination with infinite queries.
- **Transport abstraction:** the mock backend receives the same `{ method, path, query, body }`
  requests a server would, with simulated latency, failures and JSON serialization.
- **Shared business rules:** the state machines and rules in `src/features/*/*.ts` are used by both
  the UI (which actions to show) and the mock server (what is allowed), so the two never disagree.
- **Strict category catalog** (`src/constants/professional-categories.ts`): 52 categories in 4
  groups with stable ids, localized names, icons and search keywords. Both registration and
  request creation use it, and it is also served by `GET /catalog/categories`.
- **Localization:** i18next with typed keys; Hebrew resources must match English at compile time,
  including the dual plural form. RTL is forced natively (with a single reload) and applied live
  on web.
- **Forms:** react-hook-form + zod. The schemas are shared with the mock server, and their error
  messages are translation keys.

---

## Testing

`npm test` runs 80 Jest suites (479 tests). They cover the category catalog, request/offer/profile
validation, status transitions, request filtering by category and service area, offer creation
and duplicate prevention, offer acceptance (including preventing two accepted offers),
cancellation cascades, offer expiry and reminders, notification generation for every scenario,
role separation and address privacy, seed data integrity, the React Query hooks against the mock
backend, the navigation shell and role guards, realtime handling, and view models and components
of the main screens.

---

## What a real backend must implement

Authentication (instead of demo login), authoritative lifecycle rules and atomic offer
acceptance, geo-matching, notification fan-out with real push (APNs/FCM via `expo-notifications`),
realtime events over WebSocket, image uploads (pre-signed URLs), geocoding, and scheduled jobs
(offer expiry, reminders). Details are in [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md).

## Known limitations

- The mock backend runs on the device, so data is per device. "Other users" are simulated by
  switching demo accounts, and live activity comes from the demo simulator.
- Push notifications are simulated with in-app banners; nothing is delivered while the app is
  closed.
- Switching to or from Hebrew on iOS/Android reloads the app once, because React Native applies
  RTL only at startup.
- Simulated offers are scheduled in memory, so reloading the app within ~30 seconds of publishing
  a request cancels the ones not yet sent. Automatic chat replies are written as the counterpart,
  who may be another demo account.
- Saved demo data older than 12 hours is replaced with a fresh seed at launch, so the showcase
  offers never expire under you.
- Map markers of nearby requests can overlap at the default zoom (no clustering yet).
- Native iOS/Android were verified by type-checking and building the Hermes bundles; interactive
  testing was done on the web build (no simulators were available in the build environment).
- No payments, identity verification or moderation.
