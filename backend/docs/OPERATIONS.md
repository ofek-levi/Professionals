# Operations

How to configure, deploy, scale and run the API. Endpoint behaviour is in [API.md](API.md); code
conventions in [CONVENTIONS.md](CONVENTIONS.md).

## 1. Environments

`APP_ENV` is required and must be `development`, `staging` or `production`; anything else stops the
process at startup. It decides which credentials are required and prefixes every Redis key and pub/sub
channel (`development:…`, `staging:…`, `production:…`), so the three environments can share one Redis
without seeing each other's cache, rate limits, locks, push tickets or realtime events.

| | development | staging | production |
|---|---|---|---|
| Missing provider credentials | Warning at startup, feature degraded | Refuses to start (lists every missing variable) | Refuses to start |
| Email | Gmail SMTP (`SMTP_USER`/`SMTP_PASS`), else written to the log | Resend | Resend |
| Image uploads without Cloudinary | 503 | — | — |
| Google sign-in without client ids | 503 | — | — |
| `CORS_ORIGINS` empty | allow every origin | allow none | allow none |
| Default `LOG_LEVEL` | `debug` | `info` | `info` |

Use separate MongoDB databases per environment (`MONGODB_DB_NAME` or the database in the URI) and
separate provider projects/keys where the provider allows it (Cloudinary folders are already split:
`professionals/<APP_ENV>/…`).

## 2. Environment variables

Every variable is documented in [`.env.example`](../.env.example); invalid values stop the process with
a list of every problem. Summary:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `APP_ENV` | always | — | `development`, `staging`, `production` |
| `PORT` | | `4000` | HTTP and WebSocket |
| `PUBLIC_API_URL` | staging, production | `http://localhost:<PORT>` | Public base URL (no `/v1`) used in email links |
| `CORS_ORIGINS` | | see §1 | Comma-separated browser origins (the native app needs none; Expo web does) |
| `TRUST_PROXY` | behind a proxy | `false` | Express `trust proxy`: `true`, a hop count (`1`) or subnets. Needed for real client IPs (rate limits, logs) |
| `LOG_LEVEL` | | see §1 | `fatal`…`trace`, `silent` |
| `MONGODB_URI` | always | — | Must point at a **replica set** (transactions) |
| `MONGODB_DB_NAME` | | from the URI | Database name |
| `MONGODB_MAX_POOL_SIZE` | | `20` | Connections per instance |
| `REDIS_URL` | always | — | `redis://` or `rediss://` (TLS) |
| `JWT_ACCESS_SECRET` | always | — | ≥ 32 characters (`openssl rand -base64 48`); one per environment |
| `JWT_ISSUER` / `JWT_AUDIENCE` | | `professionals-api` / `professionals-app` | Access token `iss` / `aud` |
| `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` | staging, production | — | Accepted audiences of Google id tokens |
| `GOOGLE_ANDROID_CLIENT_ID` | when Android signs in with Google | — | The Android build's id tokens carry this audience |
| `CLOUDINARY_URL` (or `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`) | staging, production | — | Image storage |
| `RESEND_API_KEY`, `EMAIL_FROM` | staging, production | — | `EMAIL_FROM` like `Professionals <no-reply@your-domain>` on a verified domain |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | | `smtp.gmail.com`, `465` | Development only (ignored elsewhere) |
| `EXPO_ACCESS_TOKEN` | when the Expo project enforces push security | — | Expo push |
| `GEOCODER_URL` | | Nominatim | Nominatim-compatible endpoint |
| `GEOCODER_EMAIL`, `GEOCODER_USER_AGENT` | staging, production | dev user agent | Identify the app to the geocoder (usage policy) |
| `GEOCODER_COUNTRY_CODES` | | `il` | Search restricted to these countries |
| `CRON_ENABLED` | | `true` | `false` on instances that must not run scheduled jobs |
| `CRON_DISABLED_JOBS` | | — | Comma-separated job names to skip (see §5) |
| `RATE_LIMIT_ENABLED` | | `true` | Keep `true` outside tests |
| `PASSWORD_BREACH_CHECK` | | `true` | Reject new passwords found in data breaches (Pwned Passwords range API, fails open); `false` where the API is unreachable |
| `SHUTDOWN_TIMEOUT_MS` | | `10000` | Graceful shutdown budget (1 000–60 000) |

Secrets (`JWT_ACCESS_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`, `SMTP_PASS`, `EXPO_ACCESS_TOKEN`, the
credentials inside `MONGODB_URI`/`REDIS_URL`) belong in the platform's secret store, never in the image
or the repository. Rotating `JWT_ACCESS_SECRET` invalidates every access token: apps get a 401, refresh
(refresh tokens are not JWTs and keep working) and continue.

## 3. Infrastructure

### MongoDB (replica set required)

Accepting an offer, cancelling a request, sending a message, reviewing and several other writes run
in **multi-document transactions**, which MongoDB only supports on a replica set or sharded cluster.

- **MongoDB Atlas** (recommended): every Atlas cluster, including the free tier, is a replica set.
  Create one project per environment (or at least one cluster per production), a database user with
  `readWrite` on the app database, allow the API's egress IPs in *Network Access*, and use the
  `mongodb+srv://…` connection string as `MONGODB_URI`. Enable continuous backups on production.
- **Self-hosted**: a 3-member replica set (a single-member set works for development:
  `mongod --replSet rs0` + `rs.initiate()`), with authentication and TLS.
- MongoDB 7 or newer (tested on 7).
- Indexes are created/updated by the API at startup (`syncIndexes`, before it starts listening) and
  indexes no longer declared in the code are dropped. Consequences:
  - On a large collection, a new index is built before the first instance of the release serves
    traffic; for big data sets create it ahead of the release (same definition as in the model) so
    the sync finds it in place.
  - During a rolling deploy the old and new releases briefly share the database; changing an index an
    old instance still relies on only makes its queries slower until it is replaced.
- Data that expires by itself (TTL indexes, no cron): sessions (90 days after the last refresh),
  email links (verification 48 h, reset 1 h), notifications (90 days).

### Redis

Redis 6.2+ (tested on 7), shared by every API instance of an environment. It holds: cache (public
profiles 60 s, geocoder results 30 days), rate-limit counters, cron locks, the geocoder's global
request gate, revoked session ids (30 min), pending Expo push tickets (sorted set pruned by the
`push-receipts` job) and the realtime pub/sub channel. Nothing in it is the only copy of business
data, so persistence is optional; losing it resets limits and caches and drops push receipts not yet
checked.

- Managed options: Redis Cloud, Upstash, AWS ElastiCache, GCP Memorystore. Use `rediss://` when the
  provider offers TLS.
- Size it so it never evicts (`maxmemory-policy noeviction`, or `volatile-lru` since everything except
  the push-ticket set has a TTL). The keyspace is small: one key per active rate-limit bucket and
  cache entry.
- The API opens two connections per instance (commands and the pub/sub subscriber).
- If Redis is unreachable: rate limits and the revoked-session check let requests pass (logged),
  cache reads miss, cron jobs do not run (they need their lock) and realtime delivery stops; `/ready`
  answers 503 so the load balancer can react.

## 4. Deploying

### Docker image

```bash
docker build -t professionals-api backend          # from the repository root (context = backend/)
docker run --env-file backend/.env -p 4000:4000 professionals-api
```

Multi-stage `node:22-alpine` image: TypeScript is compiled in the build stage, the runtime stage has
production dependencies only (`npm ci --omit=dev`), runs as the unprivileged `node` user and declares
a `HEALTHCHECK` on `/health`. The command is `node dist/server.js`. The build needs no files outside
`backend/` (the contract drift tests that read `frontend/` are skipped there).

Without Docker: `npm ci && npm run build && npm start` on Node ≥ 22.12.

### Behind a load balancer / reverse proxy

- Terminate TLS at the load balancer; set `TRUST_PROXY` to the number of proxies in front of the app
  (usually `1`) so client IPs, rate limits and logs are right.
- The WebSocket endpoint `/v1/realtime` shares the HTTP port: allow `Upgrade` and use an idle timeout
  above 30 s (the server pings every 30 s). The HTTP keep-alive timeout is 65 s, above the usual 60 s
  load-balancer idle timeout.
- Health checks: liveness `GET /health` (process up, no dependencies), readiness `GET /ready` (MongoDB
  and Redis answer; 503 otherwise).
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop accepting connections, close WebSockets (code 1001, the
  app reconnects to another instance), stop cron, let in-flight requests and background work (push
  sends) finish, close MongoDB and Redis, exit within `SHUTDOWN_TIMEOUT_MS` (default 10 s). Give the
  platform a stop grace period a little longer than that.

### Release checklist

1. `npm run typecheck && npm run lint && npm test` (needs a local MongoDB replica set + Redis, see the
   README), `npm run build`.
2. Build and push the image; deploy staging with staging secrets; smoke test sign-up, a request, an
   offer, chat (realtime) and an upload.
3. Deploy production with a rolling update; watch `/ready`, error rates and the logs.

## 5. Scheduled jobs (cron)

Every instance runs the scheduler by default; each run takes a Redis lock (`SET NX PX`), so only one
instance executes a given tick. Jobs are idempotent and resume where they stopped.

| Job | Schedule (UTC) | What |
|---|---|---|
| `offer-expiry` | every 5 min | Pending offers past `expiresAt` → `expired`, request counters recounted, professional notified |
| `appointment-reminders` | every 15 min | Jobs starting within 2 h: one reminder per party, exactly once |
| `push-receipts` | every 15 min | Expo push receipts: deletes `DeviceNotRegistered` tokens, logs other errors, drops old tickets |
| `orphan-uploads` | daily 03:17 | Deletes uploads never attached to anything after 24 h (Cloudinary first, then the database) |

To move scheduled work off the API instances, run one extra instance of the same image with
`CRON_ENABLED=true` and set `CRON_ENABLED=false` on the others. `CRON_DISABLED_JOBS` switches off single
jobs (e.g. `orphan-uploads` while investigating storage).

## 6. Scaling

- **API instances are stateless**: sessions live in MongoDB, limits/cache/locks in Redis, realtime
  fan-out goes through Redis pub/sub, so any number of instances can run behind a load balancer (no
  sticky sessions needed; a WebSocket simply stays on the instance it connected to).
- **Connections**: each instance keeps up to `MONGODB_MAX_POOL_SIZE` MongoDB connections (default 20)
  and 2 Redis connections. Keep instances × pool size within the cluster's connection limit.
- **Database load**: every query is served by an index (documented next to each schema, checked with
  `explain()`), lists use keyset pagination (no `skip`), reads use projections and `lean()`, related
  data is batch-loaded with `$in`. The heaviest read is the professional explorer (`$geoNear` on
  `{status, categoryId, location}`).
- **Hot spots to watch**: `new_matching_request` fan-out on publish (one notification per matching
  professional, written after the request is committed), the geocoder (Nominatim's public service
  allows 1 request/s for the whole deployment; the cache absorbs repeats), Expo push volume.
- **Node**: one process per container; scale horizontally rather than with cluster mode.

## 7. Providers

### Cloudinary (image uploads)

1. Create an account (one product environment per `APP_ENV`, or one shared: images already go to
   `professionals/<APP_ENV>/…` folders).
2. Copy the *API environment variable* (`cloudinary://<key>:<secret>@<cloud>`) into `CLOUDINARY_URL`.
3. Nothing else to configure: uploads are signed server-side (the app never sees the secret), limited
   to 2048 px and served over HTTPS; the `orphan-uploads` job deletes abandoned images.

### Resend (email in staging/production)

1. Create an API key with *sending access* → `RESEND_API_KEY`.
2. *Domains* → add your sending domain (e.g. `mail.example.com`) and create the DNS records Resend
   shows (SPF `TXT`, DKIM `CNAME`s, optionally DMARC); wait until the domain is *Verified*.
3. Set `EMAIL_FROM` to an address on that domain, e.g. `Professionals <no-reply@mail.example.com>`.
4. Set `PUBLIC_API_URL` to the public API URL: verification and reset links point at
   `<PUBLIC_API_URL>/v1/auth/…`.

### Gmail SMTP (email in development)

1. On the Google account that sends: enable 2-Step Verification, then create an **app password**
   (<https://myaccount.google.com/apppasswords>).
2. `SMTP_USER=<the gmail address>`, `SMTP_PASS=<the 16-character app password>` (host/port default to
   `smtp.gmail.com:465`). Without them, development writes emails (with their links) to the log.

### Google sign-in

1. Google Cloud console → *APIs & Services* → *Credentials* (same project as the app's OAuth consent
   screen). Create OAuth client ids: **Web application**, **iOS** (bundle id of the app) and, if the
   Android build signs in with Google, **Android** (package name + signing certificate SHA-1).
2. Give the same ids to the app (`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`) and to the API
   (`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`). The API accepts id
   tokens whose audience is any of them and whose email is verified.
3. No client secret is needed on the server (id tokens are verified with Google's public keys, cached;
   if Google cannot be reached the API answers 503, not 401).

### Expo push notifications

1. The app registers Expo push tokens (`ExponentPushToken[…]`) with `POST /v1/me/devices`.
2. Configure the credentials in Expo (EAS): FCM v1 service account for Android, APNs key for iOS
   (`eas credentials`).
3. If *Enhanced security for push notifications* is enabled on the Expo project, create an access token
   (Expo → account settings → access tokens) and set `EXPO_ACCESS_TOKEN`.
4. Sending is batched (100 per request); receipts are checked by the `push-receipts` job.

### Breached-password check (Pwned Passwords)

Sign-up and password reset reject passwords that appear in known data breaches, using
`https://api.pwnedpasswords.com/range/<first 5 SHA-1 hex characters>` (free, no key; the full hash and
the password never leave the server, responses are padded). Allow outbound HTTPS to that host. If it
is unreachable (2 s timeout) the password is accepted and a warning is logged.

### Geocoding (Nominatim)

The default is the public Nominatim service (<https://operations.osmfoundation.org/policies/nominatim/>):
at most 1 request per second for the whole deployment (enforced through Redis), an identifying
`GEOCODER_USER_AGENT` and `GEOCODER_EMAIL`, and results are cached 30 days. For higher traffic point
`GEOCODER_URL` at a paid Nominatim-compatible provider or a self-hosted instance. When the geocoder is
unreachable the geo endpoints answer 503 and the app lets the user type the address.

## 8. Logs and monitoring

- JSON logs on stdout (pino), one line per request with method, path, status, duration and request id
  (`X-Request-Id`). Authorization headers, passwords, refresh tokens and `?token=` query values are
  redacted; request/response bodies are not logged.
- Levels: 5xx `error`, 503/429 `warn`, other 4xx `info`; unhandled errors are logged once with their
  stack. Cron runs log `cron job finished` with their duration; failures log at `error`.
- Suggested alerts: `/ready` failing, 5xx rate, `unhandled error` lines, `cron job failed`, push send
  failures (`Expo push request failed`), `refresh token reuse: session revoked` spikes (token theft or a
  client bug).
