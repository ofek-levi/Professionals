# Backend integration

The backend is implemented: [`backend/`](../../backend) (Express, MongoDB, Redis), and the app talks
only to it. This file used to list what a future server had to implement; that list is now the
backend's own documentation:

| Topic | Where |
|---|---|
| Every endpoint, payload, error, pagination, rate limit and realtime event | [`backend/docs/API.md`](../../backend/docs/API.md) |
| How the server works (auth and sessions, Google linking, realtime, Redis, cron, hardening) | [`backend/docs/ARCHITECTURE.md`](../../backend/docs/ARCHITECTURE.md) |
| Environments, variables, deploying, provider accounts (Atlas, Redis, Cloudinary, email, Google, Expo push) | [`backend/docs/OPERATIONS.md`](../../backend/docs/OPERATIONS.md) |
| Running it locally | [`backend/README.md`](../../backend/README.md) and the repository [`README.md`](../../README.md) |
| How the app connects (API client, token refresh, realtime, push, images) | [ARCHITECTURE.md → Talking to the backend](./ARCHITECTURE.md#4-talking-to-the-backend) |

Older backend comments and docs cite "BACKEND_INTEGRATION.md §3" for the Google account-linking
rules and the breached-password check; both are specified in `backend/docs/API.md`
(`POST /auth/google`, `POST /auth/register`).
