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

### Android APK (GitHub Actions)

`.github/workflows/android-apk.yml` builds an installable release APK on GitHub. It never runs
by itself: open **Actions → Android APK → Run workflow**, pick the CPU architectures
(`arm64-v8a` covers modern phones and builds fastest) and whether to publish a release. After
about 15–30 minutes the APK is on a GitHub **pre-release** (open it on the phone, download,
allow installs from the browser) and attached to the run as an artifact.

- Steps: `npm ci` → `expo prebuild --platform android` → `./gradlew assembleRelease`. The native
  `android/` folder is generated on the runner and never committed.
- Signed with React Native's public debug key: fine for testing and sideloading, **not** for the
  Play Store (that needs your own upload key, e.g. with EAS Build). Every build uses the same key,
  and `versionCode` is the run number, so a new APK installs over the previous one.
- The demo runs fully on the phone (mock backend, simulated Google sign-in, OSM map tiles); no
  secrets or `EXPO_PUBLIC_*` variables are needed.

### Maps

Every map (the job explorer and the location pickers) is one component, `AppMap`: **Leaflet** with
free **OpenStreetMap** raster tiles. It needs **no API key**. On iOS and Android it uses
`react-native-webview`, a native module that Expo Go already includes; **rebuild existing
development builds** made before the switch from `react-native-maps` (they lack `RNCWebView`).

- **iOS / Android:** the map page runs in a `react-native-webview` WebView and loads its tiles
  itself, identifying the app in its User-Agent (`professionals/<version>`).
- **Web:** the same page runs in a sandboxed `<iframe srcdoc>` (no `allow-same-origin`). Such a
  frame has no origin, so its requests would carry no `Referer`, which the OSM tile servers require
  from browsers. The app page therefore fetches the tiles for the frame (sending its own origin as
  `Referer`) and hands them over as images; the frame itself loads nothing. The tile server must
  allow CORS, as the OSM servers and the common providers do.
- Leaflet's JS/CSS and the marker glyphs are bundled with the app (no CDN); only the tiles are
  downloaded. Without a connection the map still shows its markers, circles and pin over a plain
  grid in the theme colors.
- The attribution ("© OpenStreetMap contributors") is always visible, as the tile licence requires.
  Tapping it opens the licence page in the browser.
- Inside a scrolling screen or sheet (the location pickers) the mouse wheel scrolls the page; use
  the zoom buttons, a double click or a pinch to zoom. The explorer map zooms with the wheel.

**Tile usage policy.** The public `tile.openstreetmap.org` servers are run on donated resources and
are meant for light use: the [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
requires the attribution, a `Referer` from web pages and a User-Agent that identifies an app (both
are sent as described above), forbids heavy or bulk use (prefetching, offline downloads, scraping)
and can block apps that cause too much traffic. They are fine for development and demos. **For
production**, point `EXPO_PUBLIC_MAP_TILE_URL` at a tile provider (many have a free tier) or at your
own tile server, and set `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION` to the credit that provider requires
(it is used only together with a custom URL; OpenStreetMap tiles always keep the OSM credit). The
URL may contain only the placeholders Leaflet fills (`{z}`, `{x}`, `{y}` or `{-y}`, `{s}`, `{r}`);
put API keys into it as literal text.

**Updating Leaflet or the icons.** `leaflet` and `@mdi/js` are dev dependencies read only by
`npm run generate:map-assets`, which writes `src/components/map/leaflet/generated/` (commit the
result). Run it after upgrading either package or adding a category icon; a Jest test fails until
you do.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_MODE` | `mock` | `mock` uses the in-app backend; `http` uses a real backend |
| `EXPO_PUBLIC_API_BASE_URL` | `https://api.example.com/v1` | Real API base URL (http mode) |
| `EXPO_PUBLIC_MOCK_FAILURE_RATE` | `0` | Probability (0–1) of simulated network failures |
| `EXPO_PUBLIC_MOCK_PERSIST` | `true` | Persist the mock database across launches |
| `EXPO_PUBLIC_MAP_TILE_URL` | OpenStreetMap | Map tile URL template (`https://…/{z}/{x}/{y}.png`, CORS-enabled for the web); use a tile provider or your own server in production |
| `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION` | `© OpenStreetMap contributors` | Plain-text credit shown on the map for the custom tile URL (ignored without one) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | – | Google OAuth client id for the web (unset → simulated Google sign-in) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | – | Google OAuth client id for iOS builds |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | – | Google OAuth client id for Android builds |

### Google sign-in

"Continue with Google" works in two modes (`src/services/auth/google-auth.ts`):

- **Simulated (default, no setup):** when no client id is set for the current platform, the button
  opens our own "Continue with Google (demo)" sheet with sample identities (a sample new user and
  the emails of demo accounts) or "Use another account". It produces a mock id token
  (`mock-google.<base64url JSON>`) that only the in-app mock backend accepts.
- **Real Google:** create OAuth client ids in the Google Cloud console (APIs & Services →
  Credentials → *OAuth client ID*) and set the variables above:
  - **Web** client: add your web origin (e.g. `http://localhost:8081`) to *Authorized JavaScript
    origins* and *Authorized redirect URIs*. The popup redirects back to the app, which completes it
    (`completeGoogleAuthRedirect()` in the root layout).
  - **iOS** client with the bundle id `com.professionals.marketplace`, **Android** client with the
    package `com.professionals.marketplace` and your signing certificate's SHA-1. A release APK made
    with `npx expo prebuild` and `./gradlew assembleRelease` is signed with the template's debug
    keystore, SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
  - iOS/Android need a **development or production build** (`npx expo run:ios|android`,
    `eas build`): Expo Go can't receive Google's native redirect, so it stays in simulated mode.
    The app scheme is `professionals`; native Google redirects use `<applicationId>:/oauthredirect`
    (Android gets an intent filter for that scheme from `app.json`, and `src/app/+native-intent.tsx`
    keeps the router from treating the redirect as a screen).

  The app sends Google's `id_token` to `POST /auth/google`; the backend must verify it (see
  [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)). The mock backend decodes real Google
  JWTs issued for the configured client ids without checking the signature, so real Google sign-in
  can be tried against demo data.

---

## Demo accounts & walkthrough

The first screen lists demo accounts (switch **Customer / Professional**) for one-tap sign-in,
next to **Create account** and **Sign in**. Every demo account can also sign in with its email and
the password **`Demo1234`** (e.g. `noa.levi@example.com`, `avi@aquafix.example.com`). New accounts
(email + password or Google; customers in 2 steps, professionals in 4 with services and service
area) are stored in the mock backend with salted password hashes. You can switch accounts at any
time from **Profile → Switch account**. All data lives in the mock backend and is shared between
accounts, so actions by one role show up for the other. With `EXPO_PUBLIC_API_MODE=http` the demo
accounts are hidden (they only exist in the mock backend).

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

### Create an account, sign in, Google

- **Create account** (first screen) → **I need a service** or **I offer services** → first and last
  name, email, phone, a password (8+ characters with a letter and a number, not a common one like
  `Password1`, entered twice) and the terms (**Terms of Service** and **Privacy Policy** open right
  there). Customers are done after these 2 steps. Professionals continue with their **services**
  (1–10 from the catalog, optional business name) and **service area** (base address by search,
  current location or the map, plus a 5 / 10 / 20 / 40 / 80 km radius). Their matching open
  requests show up in **Explore** right away. Each step checks its fields before moving on (errors
  appear under the fields); the header back arrow – and on the web the browser's back button –
  returns to the previous step. An email that already has an account shows an error with **Sign in
  with this email** right under it.
- **Sign in** with that email and password, or with a demo account: the screen suggests
  `noa.levi@example.com` / **`Demo1234`** and **Fill in** enters both (every demo account uses that
  password). A wrong email or password shows the same message. **Forgot password?** asks for the
  email and always confirms, without revealing whether the account exists (the mock backend sends
  nothing, and says so).
- **Continue with Google** (on Sign in and on the account step): without Google client ids it opens
  our own **Continue with Google (demo)** sheet. *Maya Katz* (sample new user) has no account: the
  sign-up flow says "Signing up with Google" from the first step and continues with her name and a
  locked email and no password fields, asking only for what is missing (role, phone, terms and, for
  a professional, services and area). *Noa Levi* and *Avi Mizrahi* are demo accounts and sign
  straight in; **Use another account** takes any name and email (in this demo an email that already
  has an account signs straight in). With client ids set, the same button opens Google's real
  sign-in (see *Google sign-in*).
- You land on your role's home with a welcome message. **Sign out** (Profile) returns to the first
  screen, demo accounts included.

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

**Accounts**
- **First screen:** **Create account** and **Sign in**, then the demo accounts (mock backend only).
- **Create account:** one step per screen with a progress bar – role, account (or **Continue with
  Google**), and for professionals services and service area – validated step by step.
- **Sign in:** email + password or **Continue with Google**; **Forgot password?** requests a reset
  link.

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
  languages, starting price, experience, emergency calls). The contact phone and email are shown
  only to customers who hired the pro, the base address never (customers see the area); changing
  the contact email doesn't change the sign-in email.

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
  services/       api (client, transports, endpoints), auth (session store, Google sign-in), realtime,
                  push, location
  types/          domain entities and API DTOs
  constants/      category catalog, urgency levels, status models, notification types, app config
  lib/            query client, routes, zod validation schemas
  mocks/          mock backend: seed data, factories, router, handlers, services, scheduler, simulator
  i18n/           i18next setup, RTL handling, typed en/he resources
  theme/          design tokens, theme provider, makeStyles
  utils/          geo, dates, formatting, ids, encoding, SHA-256
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

`npm test` runs 97 Jest suites (642 tests). They cover the category catalog, sign-in/sign-up,
request/offer/profile validation, the auth endpoints (registration of both roles, credentials,
Google sign-in, password reset), status transitions, request filtering by category and service area, offer creation
and duplicate prevention, offer acceptance (including preventing two accepted offers),
cancellation cascades, offer expiry and reminders, notification generation for every scenario,
role separation and address privacy, seed data integrity, the React Query hooks against the mock
backend, the navigation shell and role guards, the account screens (sign-in errors, the sign-up
steps for both roles, Google demo sign-in, password reset), realtime handling, the map (bridge
protocol, the Leaflet page in jsdom, the WebView and iframe hosts, the web tile loader, the explore
map and the location picker), and
view models and components of the main screens.

---

## What a real backend must implement

Authentication (password hashing, tokens, Google id-token verification, reset emails; demo login
is mock-only), authoritative lifecycle rules and atomic offer
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
- Map tiles need a network connection, and the default OpenStreetMap servers are for light use only
  (see [Maps](#maps)).
- Native iOS/Android were verified by type-checking and building the Hermes bundles; interactive
  testing was done on the web build (no simulators were available in the build environment).
- No payments, identity verification or moderation.
