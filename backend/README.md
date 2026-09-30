# Professionals API

REST + WebSocket backend of the Professionals marketplace app ([`../frontend`](../frontend)).
Customers post service requests, nearby professionals send offers, the customer accepts one, and the
job is tracked through chat, appointment, completion and review.

Express 5 on Node 22 (TypeScript, ESM), MongoDB (Mongoose) for data, Redis for cache, rate limits,
locks and realtime fan-out, Cloudinary for images, Resend (Gmail SMTP in development) for email, Expo
for push notifications, Google id tokens for "Sign in with Google".

| Document | What |
|---|---|
| [docs/API.md](docs/API.md) | Every endpoint: auth, errors, pagination, rate limits, realtime, contract changes vs the app |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit: layers, request path, data and consistency, auth, realtime, Redis, cron, hardening |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Environments, variables, deploy, cron, scaling, provider setup (Atlas, Redis, Cloudinary, Resend, Gmail, Google, Expo) |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | How the code is organised and written (read before adding code) |

## Run it locally

Requirements: Node ≥ 22.12 (the app in `../frontend` needs 22.13 or newer), Docker (for MongoDB and Redis).

```bash
# 1. MongoDB as a single-member replica set (transactions need a replica set) + Redis
#    (or, from the repository root: docker compose up -d --wait)
docker run -d --name pro-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
# mongod needs a few seconds before it accepts connections: wait for it, then initiate the replica set
until docker exec pro-mongo mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; do sleep 1; done
docker exec pro-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
docker run -d --name pro-redis -p 6379:6379 redis:7

# 2. The API
cd backend
cp .env.example .env        # starts as is; set your own JWT_ACCESS_SECRET and LOCATION_PRIVACY_SECRET (openssl rand -base64 48)
npm install
npm run dev                 # http://localhost:4000 (restarts on changes)
```

Check it: `curl localhost:4000/ready` → `{"status":"ready",…}`; the API is under
`http://localhost:4000/v1` and the WebSocket at `ws://localhost:4000/v1/realtime` (access token in the
`bearer.<token>` subprotocol, see docs/API.md). The legal documents are at
`http://localhost:4000/legal/terms`, `/legal/privacy` and `/legal/account-deletion`.
The app targets `http://localhost:4000/v1` by default; on a phone set
`EXPO_PUBLIC_API_BASE_URL=http://<your LAN IP>:4000/v1` (a phone cannot reach `localhost` of your
computer; see [`frontend/README.md`](../frontend/README.md#quick-start)).

`APP_ENV=development` runs without provider credentials, printing a warning for each:

| Missing | Behaviour in development |
|---|---|
| `SMTP_USER` / `SMTP_PASS` | Emails (with their verification/reset links) are written to the log |
| Cloudinary | Request photos and avatars answer 503 (or use a local stub: `CLOUDINARY_UPLOAD_PREFIX`, see OPERATIONS.md) |
| Google client ids | `POST /v1/auth/google` (and Google sign-up) answer 503 |
| Network access to Nominatim | `GET /v1/geo/*` answer 503 |

With `APP_ENV=staging` or `production` the process refuses to start until every required credential is
set (see [OPERATIONS.md](docs/OPERATIONS.md#2-environment-variables)) and the operator of the service is
filled in [`src/config/legal.ts`](src/config/legal.ts) (legal name, postal address, contact email:
the Terms of Use and the Privacy Policy publish them). Development shows placeholders instead.

On later runs: `docker start pro-mongo pro-redis`.

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Watch mode (`tsx`), reads `.env` |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server (`node dist/server.js`) |
| `npm run typecheck` | `tsc --noEmit` on sources and tests, then the contract check against the app's types (skipped without `../frontend`) |
| `npm run lint` | ESLint (typescript-eslint strict, type-checked) |
| `npm test` | vitest + supertest against the local MongoDB and Redis |
| `npm run test:watch` | Tests in watch mode |
| `npm run delete-account -- <email>` | Deletes that account as the app's "Delete account" does, for a request emailed by its holder (reads `.env`; in the image `node dist/delete-account.js <email>`; see [OPERATIONS.md](docs/OPERATIONS.md#9-account-deletion)) |

## Tests

`npm test` needs the local MongoDB replica set and Redis from above (override with `TEST_MONGODB_URI` /
`TEST_REDIS_URL` if yours live elsewhere, see `test/context.ts`).

- Each test file gets its own database (`pro_test_<pid>_<random>`, dropped afterwards) and its own
  Redis key prefix (deleted afterwards), so files run in parallel and never touch real data.
- External providers (Cloudinary, email, Expo push, Google, the geocoder) are replaced with in-memory
  fakes through `deps`; time is a controllable fake clock where a rule depends on it.
- Coverage: auth (register, login, refresh rotation and reuse detection, logout, immediate
  revocation, password reset, email verification, Google linking), account deletion (impact,
  re-authentication, what the other parties keep and see), the legal documents (format rules of the
  texts, placeholders, JSON and HTML pages), the whole request → offer →
  accept (transaction, concurrent 409) → job → review lifecycle, authorization and privacy views,
  keyset pagination, validation errors, messaging idempotency and read receipts, notifications and
  push fan-out, cron jobs, rate limits, realtime (real WebSocket clients across two instances), and
  drift checks that fail when the backend's copies of the app's constants (categories, statuses,
  error codes, limits, validation keys) diverge from `frontend/`.

## Docker

```bash
docker build -t professionals-api backend     # from the repository root
docker run --env-file backend/.env --network host professionals-api
```

The image is multi-stage `node:22-alpine`, production dependencies only, non-root, with a `HEALTHCHECK`
on `/health`. Deployment notes (load balancer, WebSockets, graceful shutdown, scaling, cron workers) are
in [OPERATIONS.md](docs/OPERATIONS.md#4-deploying).

## Layout

```
src/
  server.ts        bootstrap: env → MongoDB (indexes) + Redis → HTTP + WebSocket → cron; graceful shutdown
  delete-account.ts  operator command: delete an account on an emailed request
  app.ts           createApp(deps): middleware, /health, /ready, /legal/* pages, /v1 routes, errors (no listen)
  routes.ts        mounts every module router under /v1
  deps.ts          AppDeps: providers injected into services (swapped for fakes in tests)
  cron-jobs.ts     every scheduled job
  config/env.ts    zod-validated environment (APP_ENV = development | staging | production)
  config/legal.ts  the operator of the service and the dates of the legal documents (fill in before launch)
  shared/          categories, statuses, urgency, notification types, error codes, limits, contract DTO types
  lib/             errors, validation, pagination, access tokens, crypto, geo, clock, logger, batch loading
  infra/           mongo, redis (+ keys, cache, session denylist), mail, push, storage, geo, google, realtime, cron
  middleware/      auth, rate limits, request id, logging, input guards, errors
  modules/<name>/  model, schemas, services, controller, routes, views, jobs, __tests__
test/              per-file database/Redis setup, app factory with fakes, factories, auth + realtime helpers,
                   contract/ (compile-time check against the app's types)
docs/              API.md, ARCHITECTURE.md, OPERATIONS.md, CONVENTIONS.md
```

Modules: `auth` (+ sessions and their push tokens), `users` (me, avatar, device registration, account deletion), `catalog`, `geo`, `customers`, `professionals`,
`requests` (+ matching and the professional explorer), `offers`, `jobs`, `reviews`, `conversations`,
`notifications` (+ push), `dashboard`, `legal` (Terms of Use, Privacy Policy, account-deletion page: JSON and public pages), `health`.
