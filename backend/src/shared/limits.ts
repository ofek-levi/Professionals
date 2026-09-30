/**
 * Business limits. `APP_CONFIG` is copied from the app (`frontend/src/constants/app-config.ts`,
 * drift-tested) so both sides enforce the same rules; `API_LIMITS` are server-only.
 */
export const APP_CONFIG = {
  defaultCurrency: 'ILS',
  minServiceRadiusKm: 3,
  maxServiceRadiusKm: 80,
  serviceRadiusPresetsKm: [5, 10, 20, 40, 80],
  defaultServiceRadiusKm: 20,
  passwordMinLength: 8,
  passwordMaxLength: 64,
  personNameMinLength: 2,
  personNameMaxLength: 40,
  distanceFilterOptionsKm: [5, 10, 20, 40],
  maxRequestPhotos: 6,
  /** Largest image the API accepts (8 MiB, per file); the app shrinks or refuses bigger ones first. */
  maxUploadBytes: 8 * 1024 * 1024,
  /**
   * How long the app waits per photo of a post (a request's photos travel in one body, so a post
   * may take `maxRequestPhotos` times this; the API's `API_LIMITS.requestTimeoutMs` is longer).
   */
  photoUploadTimeoutMs: 90_000,
  descriptionMinLength: 15,
  descriptionMaxLength: 1000,
  notesMaxLength: 500,
  offerMessageMaxLength: 500,
  messageMaxLength: 2000,
  reviewCommentMaxLength: 800,
  minOfferPrice: 20,
  maxOfferPrice: 200_000,
  maxScheduleDaysAhead: 60,
  appointmentReminderLeadMinutes: 120,
  pageSize: 20,
  /** The app's explorer map asks for this many items in one page, so it is the server's cap too. */
  maxPageSize: 100,
} as const;

export const API_LIMITS = {
  accessTokenTtlSeconds: 30 * 60,
  refreshTokenTtlDays: 90,
  emailVerificationTtlHours: 48,
  passwordResetTtlMinutes: 60,
  /** Notifications are deleted by a TTL index after this many days. */
  notificationTtlDays: 90,
  jsonBodyLimit: '100kb',
  geocoderCacheTtlDays: 30,
  /** Address suggestions fetched (and cached) per search: the largest `limit` `GET /geo/search` serves. */
  geocoderMaxResults: 20,
  pushTicketTtlSeconds: 24 * 60 * 60,
  publicProfileCacheTtlSeconds: 60,
  /**
   * Time to receive a whole request (Node's `server.requestTimeout`, default 5 min): a post with
   * 6 photos on a slow uplink takes longer, and the app waits up to `maxRequestPhotos` ×
   * `photoUploadTimeoutMs` (9 min) for it.
   */
  requestTimeoutMs: 10 * 60_000,
  /** Image posts of one user running at once, per API process (their files are held in memory). */
  imagePostsInFlightPerUser: 2,
  /** Image bytes stored per user per 24 h (accounts are free; storage and bandwidth are not). */
  imageBytesPerUserPerDay: 200 * 1024 * 1024,
} as const;
