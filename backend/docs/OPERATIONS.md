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
| Images without Cloudinary | 503 for requests with photos and avatars (requests without photos work); or a local stub, `CLOUDINARY_UPLOAD_PREFIX` (§7) | — | — |
| Google sign-in without client ids | 503 | — | — |
| `CORS_ORIGINS` empty | allow every origin | allow none (warning at startup) | allow none (warning at startup) |
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
| `CORS_ORIGINS` | | see §1 | Comma-separated browser origins: the web app's origin(s), e.g. `https://app.example.com` (the native apps need none). Empty when deployed = no browser can call the API, which the web app reports as "No connection"; startup logs a warning |
| `TRUST_PROXY` | staging, production | `false` (development) | Express `trust proxy`: a hop count (`1`), or comma-separated proxy addresses/subnets (`10.0.0.0/8`, `loopback`, …); `false` only when clients connect directly. Deployed environments must set it and refuse `true` (it trusts any `X-Forwarded-For`, so a client could choose the IP every per-IP limit sees) |
| `LOG_LEVEL` | | see §1 | `fatal`…`trace`, `silent` |
| `MONGODB_URI` | always | — | Must point at a **replica set** (transactions) |
| `MONGODB_DB_NAME` | | from the URI | Database name |
| `MONGODB_MAX_POOL_SIZE` | | `20` | Connections per instance |
| `REDIS_URL` | always | — | `redis://` or `rediss://` (TLS) |
| `JWT_ACCESS_SECRET` | always | — | `openssl rand -base64 48`; one per environment. Development accepts ≥ 32 characters (the `.env.example` placeholder, with a warning); staging/production refuse placeholders (`change-me`, `example`, …), secrets under 43 characters (32 random bytes) and low-entropy ones. Also signs refresh tokens (derived key) |
| `JWT_ISSUER` / `JWT_AUDIENCE` | | `professionals-api:<APP_ENV>` / `professionals-app:<APP_ENV>` | Access token `iss` / `aud`; the environment in the defaults makes one environment's tokens useless in another |
| `GOOGLE_WEB_CLIENT_ID` | staging, production | — | Accepted audience of the web app's Google id tokens |
| `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` | for each native app you ship | — | The Android / iOS build's id tokens carry this audience. Deployed without one, startup logs a warning: that app shows "Continue with Google" when it was built with its own id, and every attempt answers 401 `INVALID_GOOGLE_TOKEN`. The APKs of the Android workflow are the shipped native build, so set the Android id wherever they point |
| `CLOUDINARY_URL` (or `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`) | staging, production | — | Image storage |
| `CLOUDINARY_UPLOAD_PREFIX` | never (development only; refused in staging/production) | — | Base URL the Cloudinary API calls go to instead of `https://api.cloudinary.com`: a local stub for live runs (§7) |
| `RESEND_API_KEY`, `EMAIL_FROM` | staging, production | — | `EMAIL_FROM` like `Professionals <no-reply@your-domain>` on a verified domain |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | | `smtp.gmail.com`, `465` | Development only (ignored elsewhere) |
| `EXPO_ACCESS_TOKEN` | when the Expo project enforces push security | — | Expo push |
| `GEOCODER_URL` | | Nominatim | Nominatim-compatible endpoint |
| `GEOCODER_EMAIL`, `GEOCODER_USER_AGENT` | staging, production | dev user agent | Identify the app to the geocoder (usage policy) |
| `GEOCODER_COUNTRY_CODES` | | `il` | Search restricted to these countries |
| `GEOCODER_MIN_INTERVAL_MS` | | `1000` | Spacing of provider calls across all instances (Nominatim's public API: ≥ 1000). Lower it only for a provider that allows more (0 = no gate) |
| `EXPLORER_EVENT_WINDOW_MS` | | `2000` | Explorer refresh events to one professional are merged within this window (0 = send each at once) |
| `CRON_ENABLED` | | `true` | `false` on instances that must not run scheduled jobs |
| `CRON_DISABLED_JOBS` | | — | Comma-separated job names to skip (see §5) |
| `RATE_LIMIT_ENABLED` | | `true` | Keep `true` outside tests |
| `PASSWORD_BREACH_CHECK` | | `true` | Reject new passwords found in data breaches (Pwned Passwords range API, fails open); `false` where the API is unreachable |
| `SHUTDOWN_TIMEOUT_MS` | | `10000` | Graceful shutdown budget (1 000–60 000) |
| `IMAGE_UPLOAD_MEMORY_MB` | | `256` | Memory for the bodies of image posts in flight, per instance (64–16 384): their files are held until stored; past it image posts answer 503 with `Retry-After` (§6). Size the container for it plus about 300 MB |

Secrets (`JWT_ACCESS_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`, `SMTP_PASS`, `EXPO_ACCESS_TOKEN`, the
credentials inside `MONGODB_URI`/`REDIS_URL`) belong in the platform's secret store, never in the image
or the repository. Rotating `JWT_ACCESS_SECRET` invalidates every access token: apps get a 401, refresh
(refresh tokens are looked up by their stored hash and keep working) and continue. Refresh tokens
issued before the rotation lose their reuse detection (their signature no longer verifies, so an old
replayed token is refused but does not revoke its session); tokens issued after it have it again.

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
- Indexes are created by the API at startup (`ensureIndexes`, before it starts listening); it never
  drops one, so old and new releases can boot side by side during a rolling deploy without undoing
  each other's indexes. Consequences:
  - On a large collection, a new index is built before the first instance of the release serves
    traffic; for big data sets create it ahead of the release (same definition as in the model) so
    startup finds it in place.
  - An index removed from the code stays until you drop it: startup logs `stale indexes` with their
    names. Once no running instance uses it (the release after the one that stopped declaring it),
    drop it by hand: `db.<collection>.dropIndex('<name>')`.
  - Changing the options of an index under the same name makes creation fail (`index creation
    failed` in the log): give the new definition a new name, or drop the old index first.
- Data that expires by itself (TTL indexes, no cron): sessions with their push tokens (90 days after the last refresh),
  email links (verification 48 h, reset 1 h), notifications (90 days).
- Indexes this release no longer declares (drop them once no older instance runs):
  `sessions.tokenHash_1` and `sessions.previousTokenHash_1` (refresh tokens now carry their session
  id; sessions are read by `_id`), `sessions.user_1` (replaced by `user_1_pushToken_1`, which also
  serves push fan-out), `requests.customer_1_clientRequestId_1` (replaced by `customer_clientRequestId`:
  its `$type` filter kept the retry lookup of `POST /requests` from using it), `users.googleSub_1`
  (replaced by `googleSub`, for the same reason: every Google sign-in scanned the users) and
  `professionals.serviceArea.center_2dsphere_categoryIds_1` (public searches use
  `serviceArea.publicCenter`). Sessions created before this release have refresh tokens in the old
  format: those users sign in again once.
- Documents written before this release: `professionals.serviceArea.publicCenter` is required; set it
  for existing professionals before deploying (none exist in production yet).

### Redis

Redis 6.2+ (tested on 7), shared by every API instance of an environment. It holds: cache (public
profiles 60 s, geocoder: reverse lookups 30 days, searches 7 days, empty answers 1 day), rate-limit
counters (also WebSocket upgrades per user, failed sign-ins, geocoder misses, reset and
notification emails), "known" sign-in IPs per account (hashed email, 30 days), cron locks and tick
claims, the geocoder's global request gate, explorer event windows (seconds), revoked session ids
(31 min), pending Expo push tickets (sorted set pruned by the `push-receipts` job) and the realtime
pub/sub channel. Nothing in it is the only copy of business
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
  (usually `1`) or to their subnets, so client IPs, rate limits and logs are right. Staging and
  production refuse to start without it, and refuse `true`.
- Rate limits of signed-in traffic are per user, and the per-IP caps of the sign-in routes are sized
  for carrier NAT (many subscribers behind one IPv4); see API.md, Rate limits.
- The WebSocket endpoint `/v1/realtime` shares the HTTP port: allow `Upgrade` and use an idle timeout
  above 30 s (the server pings every 30 s).
- **Image posts are large and slow**: `POST /v1/requests` and `PATCH /v1/requests/:id` carry up to 6
  photos of up to 8 MB in one body (≈ 49 MB), `PUT /v1/me/avatar` one. Allow request bodies of at least
  50 MB on these routes (nginx: `client_max_body_size 50m`, its default is 1 MB; a proxy's own 413 is
  shown by the app as a photo that cannot be sent) and a request/read timeout of at least 10 min: the
  app waits up to 90 s per photo, and the API accepts a body for 10 min (`requestTimeout`, above Node's
  5 min default). Consider `proxy_request_buffering off` so the proxy streams the body instead of
  spooling it first.
- **Access logs of the load balancer, proxy or CDN must not keep query strings of `/v1/realtime`, nor
  its `Sec-WebSocket-Protocol` request header**: the current app sends the user's access token (a JWT
  valid up to 30 min) as the `bearer.<token>` subprotocol, and app versions released before that put
  it in the URL (`?token=<JWT>`); only the API's own log redacts it. Log the path without the query (nginx: a `log_format` with `$uri` instead
  of `$request`/`$request_uri`; AWS ALB and Cloudflare record the full URL, so disable their access
  logs for that path or drop the field before storing them), and keep crash/console capture in the
  browser away from WebSocket URLs (a failing socket prints its URL to the console). The HTTP keep-alive timeout is 65 s, above the usual 60 s
  load-balancer idle timeout.
- Health checks: liveness `GET /health` (process up, no dependencies), readiness `GET /ready` (MongoDB
  and Redis answer; 503 otherwise). Each takes 300 requests / min per IP, counted in the instance's
  memory (a Redis outage never fails a probe): probe every few seconds, not faster.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop accepting connections; at the same time close
  WebSockets (code 1001, the app reconnects to another instance; sockets that do not answer within
  1 s, e.g. a backgrounded phone, are cut) and stop cron; let in-flight requests and then the
  background work they started (push sends, matching fan-out) finish; close MongoDB and Redis; exit
  within `SHUTDOWN_TIMEOUT_MS` (default 10 s). Give the platform a stop grace period a little longer
  than that.

### Release checklist

1. `npm run typecheck && npm run lint && npm test` (needs a local MongoDB replica set + Redis, see the
   README), `npm run build`.
2. Build and push the image; deploy staging with staging secrets; smoke test sign-up, a request, an
   offer, chat (realtime) and a request with a photo.
3. Deploy production with a rolling update; watch `/ready`, error rates and the logs.
4. After the release before it is gone everywhere, drop the indexes startup reports as `stale
   indexes` (see §3, MongoDB).

## 5. Scheduled jobs (cron)

Every instance runs the scheduler by default. Each scheduled tick is claimed in Redis under its own
key (`lock:<job>:tick:<scheduled time>`, `SET NX PX`, left to expire rather than released), so one
instance executes a given tick even when another instance's timer fires late; a second, released lock
keeps two runs of the same job from overlapping. Jobs are idempotent and resume where they stopped.

| Job | Schedule (UTC) | What |
|---|---|---|
| `offer-expiry` | every 5 min | Pending offers past `expiresAt` → `expired`, request counters recounted, professional notified |
| `appointment-reminders` | every 15 min | Jobs starting within 2 h: one reminder per party, exactly once |
| `push-receipts` | every 15 min | Expo push receipts: removes `DeviceNotRegistered` tokens from their sessions, logs other errors, drops old tickets |

To move scheduled work off the API instances, run one extra instance of the same image with
`CRON_ENABLED=true` and set `CRON_ENABLED=false` on the others. `CRON_DISABLED_JOBS` switches off single
jobs (e.g. `push-receipts` while investigating Expo).

## 6. Scaling

- **API instances are stateless**: sessions live in MongoDB, limits/cache/locks in Redis, realtime
  fan-out goes through Redis pub/sub, so any number of instances can run behind a load balancer (no
  sticky sessions needed; a WebSocket simply stays on the instance it connected to).
- **Connections**: each instance keeps up to `MONGODB_MAX_POOL_SIZE` MongoDB connections (default 20)
  and 2 Redis connections. Keep instances × pool size within the cluster's connection limit.
- **Database load**: every query is served by an index (documented next to each schema), lists use
  keyset pagination (no `skip`; the cursor is an index bound, so a deep page reads about `limit` keys)
  and count their total on the first page only, reads use projections and `lean()`, related data is
  batch-loaded with `$in`. `test/query-plans.test.ts` and `test/write-paths.test.ts` check the plans
  of the hottest lists and of the chat write path with MongoDB's profiler (keys examined, no
  in-memory sort, no recount). The heaviest read is the professional explorer (`$geoNear` on
  `{status, categoryId, publicPoint}`, every open request in the radius per page, sorted in memory).
- **Hot spots to watch**: the publish fan-out (matching, one `new_matching_request` per matching
  professional and a `request.updated` that makes each connected explorer refetch), run in the
  background after the response; matching reads professionals per radius bucket (5/10/20/40/80 km)
  so it only walks those who can cover the request, and explorer refresh events are merged per
  professional (`EXPLORER_EVENT_WINDOW_MS`, first event at once, the rest of the window as one), so a
  burst of publications costs each open explorer one or two refetches instead of one per request.
  The geocoder (Nominatim's public service allows 1 request/s for the whole deployment; the cache
  absorbs repeats, cache misses have a per-IP / per-user budget, and anonymous callers get at most
  half of the rate so signed-in users are never starved): for production volume use a hosted
  Nominatim-compatible provider (`GEOCODER_URL`) and raise its rate (`GEOCODER_MIN_INTERVAL_MS`).
  Expo push volume, and notification emails ("Email updates": at most 10 per user per hour, one per
  chat per 30 min; they count against the Resend plan).
- **Image posts** hold their files in memory until they are stored at Cloudinary (up to ≈ 49 MB per
  post). Each instance admits at most 2 image posts per user at once (429) and bodies of up to
  `IMAGE_UPLOAD_MEMORY_MB` in all, by declared size (503 with `Retry-After`; the app shows its photo
  message), and refuses a body larger than a post can be without reading it (413). Cloudinary cost is
  bounded per user: 60 image posts per hour and 200 MB of stored images per day (429).
- **Node**: one process per container; scale horizontally rather than with cluster mode.

## 7. Providers

### Cloudinary (images)

1. Create an account (one product environment per `APP_ENV`, or one shared: images already go to
   `professionals/<APP_ENV>/requests|avatars` folders).
2. Copy the *API environment variable* (`cloudinary://<key>:<secret>@<cloud>`) into `CLOUDINARY_URL`.
3. Nothing else to configure: uploads are signed server-side (the app never sees the secret), limited
   to 2048 px and served over HTTPS. There is no cleanup job: an image is uploaded together with the
   request or avatar that shows it and deleted when that stops showing it, one Upload API `destroy`
   per image (not the hourly-limited Admin API) with `invalidate`, so the CDN stops serving it too.
   This is best effort, so a few orphans are possible: a deletion that fails is logged as `images
   could not be deleted from storage; delete them there` with the `publicIds`, and photos kept after a
   save whose outcome was unknown as `photos of a failed save were kept`. A crash between an upload and
   its save, or an upload that completed at Cloudinary after the API gave up on it, leaves no log
   line: compare the `professionals/<APP_ENV>/requests|avatars` folders with the `publicId`s stored in
   `requests.photos` and `users.avatar` to find them, or ignore a few.

#### Images without Cloudinary (development)

Without credentials, requests without photos work and anything with an image answers 503. For a live
run with images, point the API at a local stub that answers like Cloudinary's upload and
delete endpoints:

```sh
CLOUDINARY_URL=cloudinary://key:secret@local      # any values: the stub does not check the signature
CLOUDINARY_UPLOAD_PREFIX=http://127.0.0.1:4700    # refused when APP_ENV is staging or production
```

The API then calls `POST <prefix>/v1_1/<cloud>/image/upload` (multipart, the image in `file`; answer
`{ "public_id": "…", "secure_url": "…" }`) and, per deleted image, `POST <prefix>/v1_1/<cloud>/image/destroy`
(multipart `public_id`, `invalidate=true`; answer `{ "result": "ok" }`). The `secure_url` the stub returns is what the app loads, so serve the
images from the stub too (e.g. `http://127.0.0.1:4700/img/<id>.jpg`). Startup logs a warning while
the prefix is set.

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
   screen). Create OAuth client ids: **Web application** (authorized JavaScript origin: the web app's
   URL), **Android** for the APKs (package name + the SHA-1 of **that environment's** release
   keystore, see `frontend/README.md`; never the public debug keystore's SHA-1 outside development)
   and **iOS** (bundle id) if an iOS build ships.
2. Give the same ids to the app (`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`) and to the API
   (`GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`). The API accepts id
   tokens whose audience is any of them and whose email is verified.
3. No client secret is needed on the server (id tokens are verified with Google's public keys, cached;
   if Google cannot be reached the API answers 503, not 401).

### Expo push notifications

1. The app registers Expo push tokens (`ExponentPushToken[…]`) with `POST /v1/me/devices`; the token is
   stored on the caller's session (`sessions.pushToken`) and goes away with it.
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
`GEOCODER_USER_AGENT` and `GEOCODER_EMAIL`, and results are cached (reverse lookups 30 days, searches
7 days, empty answers 1 day). For higher traffic point
`GEOCODER_URL` at a paid Nominatim-compatible provider or a self-hosted instance. When the geocoder is
unreachable the geo endpoints answer 503 and the app lets the user type the address.

## 8. Logs and monitoring

- JSON logs on stdout (pino), one line per request with method, path, status, duration and request id
  (`X-Request-Id`). Authorization headers, passwords, refresh tokens and `?token=` query values are
  redacted, and other request headers (such as `Sec-WebSocket-Protocol`) are not logged; request/response bodies are not logged. This covers the API's own log only: logs of
  anything in front of it record the realtime URL with its token unless configured not to (see §4,
  load balancer).
- Startup warnings (`warn`) in staging/production: an empty `CORS_ORIGINS` (the web app cannot reach
  the API) and a missing native Google client id. Check them after each deploy.
- Levels: 5xx `error`, 503/429 `warn`, other 4xx `info`; unhandled errors are logged once with their
  stack. Cron runs log `cron job finished` with their duration; failures log at `error`.
- Suggested alerts: `/ready` failing, 5xx rate, `unhandled error` lines, `cron job failed`, push send
  failures (`Expo push request failed`), `refresh token reuse: session revoked` spikes (token theft or a
  client bug).
