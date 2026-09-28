# Professionals — local services marketplace (Expo)

A two-sided mobile marketplace that connects **customers** who need help at home (repairs,
maintenance, renovation, moving, tech and more) with **qualified local professionals**.
A customer posts a request in seconds, professionals nearby discover it on a live map and send a
price and an appointment time, and the customer accepts the best offer. After that, the two sides
track the job, chat and leave reviews.

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
**Customer / Professional**). You can switch accounts at any time from **Profile → Switch
account**. All data lives in the mock backend and is shared between accounts, so actions
by one role show up for the other.

| Account | Role | Good for testing |
|---|---|---|
| Noa Levi (Florentin, Tel Aviv) | Customer | Review 3 offers on a leak, chat with her electrician, review a finished job, continue a draft |
| Daniel Cohen (Ramat Gan) | Customer | Choose a mover, follow an in-progress Wi-Fi job, publish a request and watch offers arrive live |
| Avi Mizrahi — AquaFix Plumbing | Professional | Plumbing & leak jobs on the map, pending offer on Noa's leak, reviews |
| Yael Ben-David — BrightSpark Electric | Professional | Confirm → start → complete Noa's electrical job, chat |
| Moshe Katz — CoolAir HVAC | Professional | AC / appliance offers, expired offers |
| Dana Shapiro — Handy Dana | Professional | New 5★ review, handyman / assembly / TV mounting jobs |
| Rami Haddad — Swift Moving | Professional | Compete for Daniel's move, junk removal & heavy lifting |
| Lior Azulay — FixIT Home Tech | Professional | Finish Daniel's in-progress Wi-Fi job |

### End-to-end scenario (≈5 minutes)

1. **Customer: Daniel Cohen** → Home → **Request a service** (or tap a popular service). On the one
   request screen pick the service, describe the problem, choose how urgent it is (Normal is
   preselected), check the address (his default address; **Change** opens the location picker with
   search, map pin and current location) and optionally add photos. Tap **Post request**.
2. The request screen opens. With **Simulated activity** on (Settings → Demo tools, on by default),
   other plumbers send offers within ~30 seconds. Each one shows a banner (a simulated push
   notification) and appears under **Offers**, sortable by Recommended / Lowest price / Earliest.
   Tap **View profile** to see a pro's rating and reviews.
3. **Switch to Avi Mizrahi (professional)**. A *new matching request* update waits in the **Inbox**.
   **Explore** shows the request on the map (colored by urgency) and in the list; **Filters**
   (service, distance, urgency) apply to both. Open it: the address is approximate until you are
   hired. Tap **Send offer**, enter a price, pick a date and a time, optionally add a message, and
   send.
4. **Switch back to Daniel**. Open the request and **Accept** Avi's offer. The request becomes
   *Booked*, the other offers are marked *not selected*, and a job and a chat are created.
5. **Avi**: *Offer accepted* in the Inbox → the job shows the full address → **Confirm
   appointment** → **Start job**. Chat with the customer from the job screen.
6. **Daniel**: **Mark as completed** → **Leave a review**.
7. **Avi**: *Review received*; the rating and review count update on the public profile.

Other things to try: cancel a request that has offers (the professionals are notified), edit or
withdraw a pending offer from the request screen, edit a professional's services, service area and
weekly hours, switch to Hebrew (the whole UI mirrors to RTL), dark mode, and **Unreliable network**
in Demo tools (error states with retry).

---

## Features

Bottom tabs are the main navigation, one entry point per feature:

- **Customer:** Home · Requests · Inbox · Profile
- **Professional:** Home · Explore · Work · Inbox · Profile

**Customer**
- **Home:** a greeting, a "What do you need help with?" card with **Request a service** and a row
  of popular services, and one **Active** section (up to 3 requests, the ones that need the
  customer first: offers to review, booked jobs, requests waiting for offers, pros to rate).
- **New request:** one screen – service, description, urgency (Emergency / Urgent / Normal /
  Flexible), address (the customer's default address, or search / map pin / GPS) and optional
  photos – with a sticky **Post request** button. Drafts saved earlier can still be continued,
  posted or deleted.
- **Requests tab:** **Active | Past** segments of compact cards with one status line ("3 offers to
  review", "Waiting for offers", "Booked · Tue 10:00", …).
- **Request details:** the status line, description, one meta line and photos; offers with a sort
  control (Recommended / Lowest price / Earliest), **View profile** and **Accept** (with
  confirmation). After acceptance only the hired pro is shown (appointment, price, **View job**,
  chat). Cancelling asks for a reason.
- **Public professional profiles:** rating, about, services, reviews, service area and working
  hours.

**Professional**
- **Home:** a greeting, a "N open jobs near you" card with **Find jobs**, two tiles (pending offers,
  active jobs) that open the Work tab, and **Up next** (appointments to confirm, the next visit).
- **Explore:** a map | list toggle over the same results – the service-area circle, urgency-colored
  markers and a compact preview card on the map, infinite scroll in the list – and one **Filters**
  sheet (service, distance, urgency).
- **Request details:** category, urgency, distance and posting time, the description and photos,
  the approximate area (the exact address is shared once hired), the customer's name and the
  number of offers so far, with a sticky **Send offer**. Once offered, a compact **Your offer** card
  with **Edit** / **Withdraw**.
- **Send offer:** one screen – price, a date (the next days the urgency allows), a 30-minute time
  slot within the pro's working hours, and an optional message. The same form edits a pending
  offer; server rejections (duplicate offer, request no longer open, outside the service area) are
  explained in the form.
- **Work tab:** **Offers | Jobs** – offers waiting for a reply and past offers; upcoming and completed
  jobs with this month's total. Jobs follow confirm → start → complete.
- **Profile editor:** the essentials (photo, names, headline, bio, services, service area and radius,
  weekly hours, contact) plus a collapsed "More details" section (website, license, insurance,
  languages, starting price, experience, emergency calls).

**Both roles**
- **Inbox:** **Updates | Messages** – notifications grouped by day with unread dots and "Mark all
  read", and the chats list. The tab badge counts unread updates plus unread messages. In-app
  banners act as simulated push notifications and deep-link like the notification list.
- **Job details:** the status, a slim progress indicator and the single next action (Confirm
  appointment / Start job / Mark as completed / Leave a review) with a chat button, plus the
  appointment, price, address and the other party.
- **Chat** with optimistic sending, retry, read receipts and day separators.
- **Profile tab:** Edit profile, (professionals) View public profile, Settings, Switch account, Sign
  out.
- **Settings:** language (English / עברית with RTL), appearance (system / light / dark),
  notification preferences, and demo tools (simulated activity, unreliable network, reset demo
  data).

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
  providers/      app providers, navigation theme/tab bar options, realtime wiring, bootstrap
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
  by realtime events. Updates are optimistic for notifications, chat and profiles. Lists that can
  grow (requests, offers, notifications, chat messages, reviews) use cursor pagination with infinite
  queries.
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

`npm test` runs 78 Jest suites (455 tests). They cover the category catalog, request/offer/profile
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
