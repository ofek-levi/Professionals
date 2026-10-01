# Professionals — local services marketplace (Expo)

A two-sided mobile marketplace that connects **customers** who need help at home (repairs,
maintenance, renovation, moving, tech and more) with **qualified local professionals**.
A customer posts a request in seconds, professionals nearby discover it on a live map and send a
price and an appointment time, and the customer accepts the best offer. After that, the two sides
track the job, chat and leave reviews.

Built with **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript 6, Expo Router, React
Compiler). The app talks to the API in [`../backend`](../backend) (REST + WebSocket; contract in
[`backend/docs/API.md`](../backend/docs/API.md)); there is no offline or demo mode. English and
Hebrew (RTL) are supported, in light and dark themes.

---

## Quick start

The app needs the backend running. From the repository root (details in
[`backend/README.md`](../backend/README.md)):

```bash
docker compose up -d --wait                  # MongoDB (replica set) + Redis for local development
cd backend && cp .env.example .env && npm install && npm run dev   # API on http://localhost:4000
```

Then the app, in a second terminal from the repository root:

```bash
cd frontend
npm install
cp .env.example .env.local   # optional: the defaults target http://localhost:4000/v1
npx expo start               # w = web, i = iOS simulator, a = Android emulator
```

Where the app finds the API (`EXPO_PUBLIC_API_BASE_URL`, restart Expo with `--clear` after a change):

| Running on | API base URL |
|---|---|
| Web browser, iOS simulator | `http://localhost:4000/v1` (default) |
| Android emulator | `http://10.0.2.2:4000/v1` |
| A phone on the same Wi-Fi | `http://<your computer's LAN IP>:4000/v1` |

The first time, create accounts in the app (**Create account**): e.g. one customer and one
professional whose services and service area cover the customer's address. The development
backend writes verification and password-reset emails to its log unless SMTP is configured.

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run ios` / `npm run android` / `npm run web` | Open on a simulator/emulator or in the browser |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-expo`, React Compiler rules) |
| `npm test` | Jest (`jest-expo`) unit + integration tests (no backend needed) |
| `npm run verify` | typecheck + lint + tests |

### Environment variables

All are read at build time and documented in [`.env.example`](.env.example). `EXPO_PUBLIC_*` values
end up in the JavaScript bundle: never put secrets in them.

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | `development` | `development`, `staging` or `production` |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:4000/v1` (development only) | API root ending in `/v1`; the WebSocket URL is derived from it. Staging and production builds require an `https://` URL and refuse to start without one |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | – | EAS project id the Expo push tokens are issued for; unset → push notifications off |
| `GOOGLE_SERVICES_FILE` | – | Build-time path to Firebase `google-services.json` (FCM, required for push on Android); read by `app.config.ts` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | – | Google OAuth client id for the web |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | – | Google OAuth client id for iOS builds |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | – | Google OAuth client id for Android builds |
| `EXPO_PUBLIC_MAP_TILE_URL` | OpenStreetMap | Map tile URL template (`https://…/{z}/{x}/{y}.png`, CORS-enabled for the web); use a tile provider or your own server in production |
| `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION` | `© OpenStreetMap contributors` | Plain-text credit shown on the map for the custom tile URL (ignored without one) |

### What needs real credentials

Everything runs locally without accounts anywhere; these features need real credentials:

| Feature | App | Backend (see [OPERATIONS.md](../backend/docs/OPERATIONS.md)) | Without them |
|---|---|---|---|
| Continue with Google | `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` for the platform | the same ids (`GOOGLE_*_CLIENT_ID`) | the button is hidden (and the backend answers 503) |
| Push notifications (iOS/Android) | `EXPO_PUBLIC_EAS_PROJECT_ID`, Android also `google-services.json`; a development or release build | FCM / APNs credentials in Expo (`eas credentials`), optionally `EXPO_ACCESS_TOKEN` | no push; realtime still updates the open app |
| Photos (requests, avatars) | – | Cloudinary (or a local stub in development: `CLOUDINARY_UPLOAD_PREFIX`) | requests and avatars with a photo fail (503 in development); requests without photos work |
| Emails (verification, password reset) | – | Resend (staging/production) or Gmail SMTP (development) | development writes them to the log |
| Address search and reverse geocoding | – | network access to Nominatim (or `GEOCODER_URL`) | address search is unavailable (503) |
| Production map tiles | `EXPO_PUBLIC_MAP_TILE_URL` (+ attribution) | – | public OpenStreetMap tiles (light use only) |

### Android APK (GitHub Actions)

`.github/workflows/android-apk.yml` builds an installable release APK on GitHub. It never runs
by itself: open **Actions → Android APK → Run workflow**, pick the **environment** (`staging` or
`production`), the CPU architectures (`arm64-v8a` covers modern phones and builds fastest) and
whether to publish a release. After about 15–30 minutes the APK is on a GitHub **pre-release** (open
it on the phone, download, allow installs from the browser) and attached to the run as an artifact.

Configure each environment once under **Settings → Environments → staging | production**:

| Kind | Name | Used for |
|---|---|---|
| Variable | `API_BASE_URL` | **required**: `https://…/v1` of that environment's backend (the run fails in its first step without it) |
| Variable | `EAS_PROJECT_ID` | push notifications |
| Variable | `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` | "Continue with Google" (the APK needs the Android id) |
| Variable | `MAP_TILE_URL`, `MAP_TILE_ATTRIBUTION` | custom map tiles |
| Secret | `GOOGLE_SERVICES_JSON_BASE64` | `base64 -w0 google-services.json` (FCM for push on Android; checked against the app's package name) |
| Secret | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | the environment's release keystore (see Signing below): **required for production** |

They become the `EXPO_PUBLIC_*` variables of the build (`EXPO_PUBLIC_APP_ENV` is the chosen
environment). A missing optional value only turns its feature off, with a warning in the run.

- Steps: `npm ci` → `expo prebuild --platform android` → `./gradlew assembleRelease`. The native
  `android/` folder is generated on the runner and never committed.
- The build job can only read the repository (`npm ci` install scripts and Gradle plugins run
  there, and the checkout keeps no token); a separate job, which runs no build code, publishes the
  finished APK as a pre-release. `versionCode` is the run number, so a new APK installs over the
  previous one. The APK name and the release tag include the environment.

#### Signing

Android installs an APK over an installed app with the same package only when both are signed with
the same key, and keeps the app's data (including the signed-in session). So each environment signs
with its **own private keystore**, kept in that GitHub Environment's secrets:

```bash
keytool -genkeypair -v -keystore professionals-production.keystore -alias professionals \
  -keyalg RSA -keysize 4096 -validity 10000          # asks for the passwords; keep a backup
base64 -w0 professionals-production.keystore          # -> ANDROID_KEYSTORE_BASE64
keytool -list -v -keystore professionals-production.keystore -alias professionals | grep SHA1
```

Set `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD` under **Settings → Environments → production** (and staging, with a
different keystore). A **production** run without them fails; a **staging** run without them signs
with React Native's public debug keystore, with a warning (testing only: anyone can sign an APK with
that key that installs over it). Register each environment's SHA-1 with its own Google Android
OAuth client (see [Google sign-in](#google-sign-in)). Losing a keystore means users must uninstall
before they can install new builds, so keep it backed up outside GitHub.

### App icon & logo

The master artwork is `assets/brand/logo-mark.svg` (speech bubble with a wrench, brand blue
`#1E62E6`, which is also the app's `primary` color in light mode). Everything else is derived from it:

| File | Use |
|---|---|
| `assets/images/icon.png` | App icon (iOS and fallback), 1024 × 1024, opaque: white mark at 50 % width on the brand blue |
| `assets/images/android-icon-foreground.png` / `-monochrome.png` | Android adaptive icon layers (white mark inside the 66 dp safe circle; background color `#1E62E6` in `app.json`; the monochrome layer drives Android 13+ themed icons) |
| `assets/images/splash-icon.png` | Splash screen mark (white, on `#1E62E6`) |
| `assets/images/favicon.png` | Web favicon: rounded blue tile, mark at 76 % height so it stays legible at 16 px |
| `BrandMark` (`src/components/ui/brand-mark.tsx`) | The mark inside the app: white on the entry screen's blue hero, blue above the sign-in title |

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
and can block apps that cause too much traffic. They are fine for development and testing. **For
production**, point `EXPO_PUBLIC_MAP_TILE_URL` at a tile provider (many have a free tier) or at your
own tile server, and set `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION` to the credit that provider requires
(it is used only together with a custom URL; OpenStreetMap tiles always keep the OSM credit). The
URL may contain only the placeholders Leaflet fills (`{z}`, `{x}`, `{y}` or `{-y}`, `{s}`, `{r}`);
put API keys into it as literal text.

**Updating Leaflet or the icons.** `leaflet` and `@mdi/js` are dev dependencies read only by
`npm run generate:map-assets`, which writes `src/components/map/leaflet/generated/` (commit the
result). Run it after upgrading either package or adding a category icon; a Jest test fails until
you do.

### Google sign-in

"Continue with Google" uses Google's real sign-in (`expo-auth-session`,
`src/services/auth/google-auth.ts`). It is shown only when the client id of the running platform
is set, and not in Expo Go on iOS/Android. To set it up, create OAuth client ids in the Google Cloud
console (APIs & Services → Credentials → *OAuth client ID*), set the variables above and give the
backend the same ids:

- **Web** client: add your web origin (e.g. `http://localhost:8081`) to *Authorized JavaScript
  origins* and *Authorized redirect URIs*. The popup redirects back to the app, which completes it
  (`completeGoogleAuthRedirect()` in the root layout).
- **iOS** client with the bundle id `com.professionals.marketplace`, **Android** client with the
  package `com.professionals.marketplace` and the SHA-1 of the keystore that signs that
  environment's APKs (one Android client per environment; see [Signing](#signing)). Only a local
  development build (`npx expo run:android`) is signed with the template's public debug keystore,
  SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`: register it on a
  development client only, never on the production one.
- iOS/Android need a **development or release build** (`npx expo run:ios|android`, `eas build`):
  Expo Go can't receive Google's native redirect, so the button stays hidden there. The app scheme
  is `professionals`; native Google redirects use `<applicationId>:/oauthredirect` (Android gets an
  intent filter for that scheme from `app.json`, and `src/app/+native-intent.tsx` keeps the router
  from treating the redirect as a screen).

The app sends Google's `id_token` to `POST /auth/google`, which verifies it (signature, audience =
one of the client ids, verified email). A Google identity without an account continues in the
sign-up flow with its name and email filled in.

---

## Walkthrough (two accounts)

1. **Create account → I need a service** (a customer): name, email, phone, a password (8+
   characters with a letter and a number, not a common one like `Password1`) and the checkbox
   confirming you're 18 or older and accept the Terms of Use and the Privacy Policy (its links
   open each document).
2. On the customer's Home tap **Request a service**: pick the service, describe the problem, choose
   the urgency, set the address (search, map pin or current location) and optionally add photos.
   **Post request**.
3. Sign out (Profile → **Sign out**) and **Create account → I offer services** (a professional):
   services that include the request's, and a service area (base address + radius) that covers its
   address. The request shows up in **Explore** (map and list) and, as *new matching request*, in
   the **Inbox**. Open it (the address stays approximate until you are hired) and **Send offer**
   with a price, a date and a time.
4. Sign in as the customer (or use a second browser/device, where updates arrive live): the offer
   appears on the request. **Accept** it: a job and a chat are created.
5. Professional: **Confirm appointment** → **Start job**; chat from the job screen (messages
   arrive live). Customer: **Mark as completed** → **Leave a review**.

Also try: cancel a request that has offers, edit or withdraw a pending offer, switch to Hebrew (the
whole UI mirrors to RTL), dark mode, and **Forgot password?** (without SMTP the link is in the
backend log).

---

## Features

Bottom tabs are the main navigation, one entry point per feature:

- **Customer:** Home · Requests · Inbox · Profile
- **Professional:** Home · Explore · Work · Inbox · Profile

**Accounts**
- **First screen:** the brand, a language switch, **Create account** and **Sign in**.
- **Create account:** one step per screen with a progress bar – role, account (or **Continue with
  Google**), and for professionals services and service area – validated step by step.
- **Sign in:** email + password or **Continue with Google** (when configured); **Forgot password?**
  requests a reset link. The session survives restarts (secure storage on phones) and is refreshed
  in the background; **Sign out** (with confirmation) ends it on the server too.

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
  languages, starting price, experience, emergency calls). The contact phone, email and website are
  shown only to customers who hired the pro (on the job, a call button on the request and the pro's
  profile, while the job is not cancelled), the base address never (customers see the area); changing the contact email doesn't
  change the sign-in email.

**Both roles**
- **Inbox:** **Updates | Messages** – notifications grouped by day with unread dots and "Mark all
  read", and the chats list. The tab badge counts unread updates plus unread messages. Everything
  updates live over the realtime connection; while the app is open a new notification shows as an
  in-app banner, otherwise as a push notification (iOS/Android). Both deep-link like the list.
- **Job details:** the status, a slim progress indicator and the single next action (Confirm
  appointment / Start job / Mark as completed / Leave a review) with a chat button, plus the
  appointment, price, address and the other party.
- **Chat** with optimistic sending, retry, read receipts and day separators.
- **Profile tab:** Edit profile, (professionals) View public profile, Settings, Sign out.
- **Settings:** language (English / עברית with RTL, saved to the account), appearance (system /
  light / dark), notification preferences (push notifications, per-type switches, email
  updates), **Legal** (Terms of Use, Privacy Policy) and **Account → Delete account**: what it
  would cancel right now, what stays, the password (or Google for an account without one) and a
  last confirmation; the account is deleted at once and the app returns to the entry screen.
  Others then see the person as "Deleted user".
- **Legal documents:** the Terms of Use and the Privacy Policy as the backend serves them, in the
  app's language (`/legal/terms`, `/legal/privacy`). Signed out they are linked from the entry and
  sign-in screens and the sign-up checkbox; they also open by URL on the web.

---

## Architecture

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the layering rules, how the app talks to
the backend (API client, token refresh, realtime, push, images), the domain and status models and
the UI conventions. The API itself is documented in [`backend/docs/API.md`](../backend/docs/API.md).

```
Screen/component ──> React Query hooks ──> api.* endpoint functions ──> ApiClient ──> HTTP ──> backend /v1
 (src/app, src/features)  (src/hooks)        (src/services/api/endpoints)   (bearer token, refresh on 401)
Realtime (WebSocket /v1/realtime) ──> providers/realtime-events.ts ──> React Query cache
```

```
src/
  app/            Expo Router routes (thin; render screens from src/features)
  config/         build-time environment (EXPO_PUBLIC_APP_ENV, API base URL, EAS project id)
  features/       feature screens + components + pure business logic (state machines, sorting,
                  availability, view models)
  providers/      app providers, navigation theme/tab bar options, realtime wiring, push, bootstrap
  components/     design system (ui/) + shared domain components (categories, requests, offers,
                  professionals, jobs, location, map, forms)
  hooks/          React Query queries/mutations, centralized query keys and invalidation
  services/       api (client, HTTP transport, endpoints, multipart image bodies), auth (session store, token
                  refresh, Google sign-in), realtime (WebSocket), push (expo-notifications), location
  types/          domain entities and API DTOs
  constants/      category catalog, urgency levels, status models, notification types, app config
  lib/            query client, routes, zod validation schemas
  test-utils/     Jest only: the backend test double (mock-backend/) and native module stand-ins
  i18n/           i18next setup, RTL handling, typed en/he resources
  theme/          design tokens, theme provider, makeStyles
  utils/          geo, dates, formatting, ids, bidi
```

Key decisions:
- **Expo Router** with role-specific tab navigators (`/customer/*`, `/professional/*`) guarded by
  `Stack.Protected`, plus shared stack screens and deep links (`professionals://requests/<id>`).
- **TanStack Query** for all server state. Query keys live in one place and are scoped per user, so
  switching accounts never leaks cached data (the cache is cleared on every identity change).
  Invalidation helpers are centralized and also used by realtime events. Updates are optimistic for
  notifications, chat and profiles. Lists that can grow use cursor pagination with infinite queries.
- **Sessions:** short-lived access tokens refreshed proactively and after a 401 (one refresh at a
  time), refresh tokens in `expo-secure-store` on phones (`localStorage` on the web).
- **Shared business rules:** the state machines and rules in `src/features/*/*.ts` decide which
  actions the UI offers; the backend enforces the same rules (drift-tested copies).
- **Strict category catalog** (`src/constants/professional-categories.ts`): 52 categories in 4
  groups with stable ids, localized names, icons and search keywords. Both registration and
  request creation use it, and it is also served by `GET /catalog/categories`.
- **Localization:** i18next with typed keys; Hebrew resources must match English at compile time,
  including the dual plural form. RTL is forced natively (with a single reload) and applied live
  on web.
- **Forms:** react-hook-form + zod; error messages are translation keys, and server `fieldErrors`
  (same keys) land on the same fields.

---

## Testing

`npm test` runs the Jest suites without a backend: the real hooks, endpoint modules, API client,
token manager, WebSocket client and screens run against an in-process test double of the API
(`src/test-utils/mock-backend`, the backend contract of `backend/docs/API.md`; ESLint forbids
importing it from app code, so it is never bundled). They cover the category catalog,
sign-in/sign-up, sessions (secure storage, proactive and single-flight token refresh, sign-out when
the refresh token is rejected, logout), realtime (4001 → refresh, backoff, foreground), push
(registration, token changes, taps), requests and avatars sent with their photos (multipart),
request/offer/profile validation, status
transitions, request filtering by category and service area, offers and their acceptance,
cancellation cascades, notifications, role separation and address privacy, the React Query hooks,
the navigation shell and role guards, the account screens, the map (bridge protocol, the Leaflet
page in jsdom, the WebView and iframe hosts, the web tile loader) and the view models and components
of the main screens. The backend has its own suite (`backend/`, `npm test`).

## Known limitations

- Switching to or from Hebrew on iOS/Android reloads the app once, because React Native applies
  RTL only at startup.
- Push notifications need a development or release build with the credentials above (Expo Go on
  Android has no remote push); the web has no push, only live updates while a tab is open.
- On the web the session (including the refresh token) is kept in `localStorage`, readable by any
  script on the page; phones use the OS keychain/keystore.
- Map markers of nearby requests can overlap at the default zoom (no clustering yet).
- Map tiles need a network connection, and the default OpenStreetMap servers are for light use only
  (see [Maps](#maps)).
- A staging APK built without a release keystore is signed with the public debug key (testing
  only); production APKs need the environment's own keystore.
- No payments, identity verification or moderation.
