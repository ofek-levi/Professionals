# Professionals

Local services marketplace: customers post requests, nearby professionals send offers, the
customer accepts one and the job is tracked through chat, appointment, completion and review.

| Folder | What |
|---|---|
| [`frontend/`](frontend/README.md) | Expo / React Native app (iOS, Android, web), English + Hebrew (RTL) |
| [`backend/`](backend/README.md) | Express 5 API on Node 22: MongoDB, Redis, REST + WebSocket ([API reference](backend/docs/API.md)) |
| [`docker-compose.yml`](docker-compose.yml) | MongoDB (single-member replica set) + Redis for local development |
| [`.github/workflows/android-apk.yml`](.github/workflows/android-apk.yml) | Manual GitHub Action that builds an installable Android APK |

The app talks only to the backend: there is no demo or offline mode.

## Quick start

Requirements: Node ≥ 22.12, Docker.

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
  GitHub Environment provides `API_BASE_URL` (required) and the optional variables/secret listed in
  [`frontend/README.md`](frontend/README.md#android-apk-github-actions).
