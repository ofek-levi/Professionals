# Backend integration guide

The app ships with an in-app mock backend (`src/mocks`) that implements the complete REST
contract described in [ARCHITECTURE.md](./ARCHITECTURE.md#rest-contract). This document lists what
a real backend has to provide and which client files change when it does.

## 1. Switching the transport

```bash
EXPO_PUBLIC_API_MODE=http EXPO_PUBLIC_API_BASE_URL=https://api.example.com/v1 npx expo start
```

- `src/services/api/config.ts` reads the mode; `src/services/api/index.ts` then builds the
  `ApiClient` with `createHttpTransport` (fetch, JSON, timeouts, error normalization) instead of the
  mock transport. **No screen, hook or component changes.**
- Every endpoint function in `src/services/api/endpoints/*` documents its method and path, and every
  request/response body is typed in `src/types/api` + `src/types/domain`. These types are the API
  contract. Generate them from an OpenAPI schema later if you like, as long as the shapes match.
- Error responses must use `ApiErrorBody` (`{ code, message, fieldErrors? }`) with the codes in
  `API_ERROR_CODES`. The UI localizes messages by `code` and shows `fieldErrors` next to form fields.
- Pagination is cursor-based: `?cursor=&limit=` → `{ items, nextCursor, totalCount }`.
- Arrays in query strings are comma-separated (`?urgencies=emergency,urgent`), see
  `serializeQuery` in `src/services/api/transport.ts`.

## 2. Server responsibilities (implemented today by the mock)

| Concern | Mock implementation | Real backend |
|---|---|---|
| Authentication | `POST /auth/demo-login` issues `demo-token:<userId>` | Real sign-up / sign-in (phone OTP or email), JWT access + refresh tokens. Replace the demo sign-in screen; `sessionStore` already persists a token and the client signs out on HTTP 401. Add a refresh-token flow in `ApiClient` if tokens are short-lived. |
| Authorization | `src/mocks/server/auth.ts` role + ownership checks | Same rules: customers only see their own requests; professionals only see matching or offered requests; only the request owner accepts offers. |
| Business rules | `lifecycle-service.ts` + the shared state machines in `src/features/*/…-status-machine.ts` | Must be **authoritative** on the server and transactional. In particular, accepting an offer must atomically accept one offer, reject the others, update the request and create the job + conversation, so a second acceptance fails with 409. |
| Validation | zod schemas in `src/lib/validation` | Re-validate everything server side. The client schemas mirror the server rules only for UX. |
| Matching | `request-matching.ts` (category ∩ service radius, haversine) | Geo index (PostGIS `ST_DWithin` or similar). Keep the privacy rule: return an approximate location to professionals until their offer is accepted. |
| Category catalog | `DEFAULT_CATEGORY_CATALOG` served by `GET /catalog/categories` | Serve from the database, with localized `name` / `description` / `keywords`. The client already renders localized text from the payload and caches it with React Query. |
| Notifications | `notification-service.ts` creates in-app notifications on each event | Persist notifications, fan out push messages (see §3) and honour `NotificationPreferences`. |
| Scheduled work | `scheduler.ts` runs on every request (offer expiry, appointment reminders) | Cron jobs or delayed queues. |
| Realtime | In-process event bus (`src/mocks/realtime.ts`) | WebSocket/SSE sending `RealtimeEvent` JSON frames. `src/services/realtime/websocket-realtime-client.ts` is a ready skeleton (auto-reconnect). |
| Messaging | `messaging-service.ts` | Persist messages. Keep `clientMessageId` idempotency so client retries never duplicate messages. |
| Uploads | `POST /uploads/images` stores the local URI | Pre-signed upload URLs (S3/GCS) or multipart upload. Return `{ id, url }` and reference `photoIds` when creating requests. |
| Geocoding | Gazetteer of ~40 Tel Aviv-area places (`geo-service.ts`) | Google Places / Mapbox / a local geocoder behind `GET /geo/search` and `GET /geo/reverse`. |
| Ratings | `review-service.ts` recomputes averages | Aggregate on write (or via materialized views). |
| Demo simulator | `simulator.ts` (auto offers, auto chat replies) | Not needed. `demoTools` hides itself when `EXPO_PUBLIC_API_MODE=http`. |

## 3. Push notifications

- The client talks to `PushProvider` (`src/services/push/types.ts`). Today
  `simulated-push-provider.ts` shows in-app banners and registers a fake device token through
  `POST /me/devices`.
- To go live, follow the checklist in `src/services/push/expo-push-provider.ts`: install
  `expo-notifications`, implement the provider, return it from `src/services/push/index.ts`
  when in HTTP mode, and configure APNs/FCM credentials with EAS.
- The push payload `data` should include `{ notificationId, target }` (a `NotificationTarget`),
  so taps deep-link through the same `notificationTargetToHref` used by the notification center.

## 4. Payments and other out-of-scope items

Payments, invoicing, disputes, identity/licence verification of professionals, content moderation,
analytics and admin tooling are not implemented. The `ProfessionalProfile.isVerified` flag and the
`agreedPrice` on jobs are the natural integration points for verification and payments.
