# Professionals

Local services marketplace: customers post requests, nearby professionals send offers, the
customer accepts one and the job is tracked through chat, appointment, completion and review.

| Folder | What |
|---|---|
| [`frontend/`](frontend/README.md) | Expo / React Native app (iOS, Android, web), English + Hebrew (RTL) |
| [`backend/`](backend/README.md) | Express 5 API on Node 22: MongoDB, Redis, REST + WebSocket ([API reference](backend/docs/API.md)) |
| [`docker-compose.yml`](docker-compose.yml) | MongoDB (single-member replica set) + Redis for local development |
| [`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml) | Manual GitHub Action that builds an installable Android APK |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Checks on every push and pull request: backend typecheck (with the app contract check), lint, tests against MongoDB + Redis and build; frontend typecheck, lint and tests |

The app talks only to the backend: there is no demo or offline mode.

## Quick start

Requirements: Node 22.13 or newer (React Native 0.86 and Expo need `^22.13`, `^24.3` or `≥ 25`; the
backend alone runs on 22.12), Docker.

```bash
# 1. Data stores: MongoDB as a replica set (the API uses transactions) + Redis
docker compose up -d --wait

# 2. The API on http://localhost:4000 (development needs no provider credentials)
cd backend
cp .env.example .env
npm install
npm run dev
```

```bash
# 3. The app (second terminal); it targets http://localhost:4000/v1 by default
cd frontend
npm install
npx expo start          # w = web, i = iOS simulator, a = Android emulator
```

- **Android emulator:** set `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/v1`; **a phone** on the same
  Wi-Fi: `http://<your computer's LAN IP>:4000/v1` (in `frontend/.env.local`, then `npx expo start --clear`).
- Create a customer and a professional in the app (**Create account**) and follow the walkthrough in
  [`frontend/README.md`](frontend/README.md#walkthrough-two-accounts).
- Check the API: `curl localhost:4000/ready`. In development, emails (verification, password reset)
  are written to the API's log; photo uploads, Google sign-in and push need provider credentials (see
  [what needs real credentials](frontend/README.md#what-needs-real-credentials)).
- Stop the data stores with `docker compose down` (`-v` also deletes their data). If ports 27017/6379
  are taken, see the comments in `docker-compose.yml`.

## Checks

| Where | Command |
|---|---|
| `backend/` | `npm run typecheck && npm run lint && npm test` (tests need MongoDB + Redis running) |
| `frontend/` | `npm run verify` (typecheck, lint, Jest; no backend needed) |

The backend's typecheck also compiles a contract check against the app's API types, and its tests
include drift checks against the app's constants and validation rules.

## Deploying

- **API:** Docker image (`backend/Dockerfile`), environments, variables and provider setup in
  [`backend/docs/OPERATIONS.md`](backend/docs/OPERATIONS.md).
- **Android APK:** Actions → *Android APK* → Run workflow, choosing `staging` or `production`; each
  GitHub Environment provides `API_BASE_URL` (required), the release signing key (required for
  `production`) and the optional variables/secrets listed in
  [`frontend/README.md`](frontend/README.md#android-apk-github-actions).
- **Web app:** see below.

### Web app

The web app is a static single-page app (`web.output: "single"` in `frontend/app.json`): one
`index.html` plus hashed assets, served by any static host or CDN.

1. **Build** in `frontend/` with the environment's values (they are inlined at build time, so build
   once per environment):

   ```bash
   EXPO_PUBLIC_APP_ENV=production \
   EXPO_PUBLIC_API_BASE_URL=https://api.example.com/v1 \
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id> \
   EXPO_PUBLIC_MAP_TILE_URL='https://tiles.example.com/{z}/{x}/{y}.png' \
   npx expo export --platform web --output-dir dist-web
   ```

   `EXPO_PUBLIC_API_BASE_URL` must be `https://…/v1` in staging and production (the app refuses to
   start otherwise); the other `EXPO_PUBLIC_*` variables are optional (see
   [`frontend/README.md`](frontend/README.md#environment-variables)). Push is not available on the web.
2. **Host** `dist-web/` over HTTPS with an **SPA fallback**: every path that is not a file answers
   `index.html` with status 200 (the router resolves `/customer/home`, `/auth/reset?…` and other deep
   links in the browser). Examples: nginx `try_files $uri /index.html;`, Netlify
   `/* /index.html 200` in `_redirects`, Cloudflare Pages and Vercel handle it for single-page apps.
   Cache `/_expo/static/*` for a long time (file names are hashed) and `index.html` not at all.
3. **Backend:** add the web app's origin (scheme + host, no path, e.g. `https://app.example.com`) to
   `CORS_ORIGINS`. Without it the browser blocks every API call and the app shows "No connection";
   the API logs a warning at startup when `CORS_ORIGINS` is empty.
4. **Google sign-in:** on the *Web application* OAuth client, add the same origin to *Authorized
   JavaScript origins* and *Authorized redirect URIs*, and give its id to both the build
   (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) and the API (`GOOGLE_WEB_CLIENT_ID`).
5. **Access logs:** the app sends its access token to `/v1/realtime` in the WebSocket's
   `Sec-WebSocket-Protocol` request header (older app versions put it in the query string); keep that
   header and the query strings of `/v1/realtime` out of the load balancer's and CDN's logs
   ([OPERATIONS.md §4](backend/docs/OPERATIONS.md#behind-a-load-balancer--reverse-proxy)).
