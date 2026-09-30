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
  uploadMaxBytes: 8 * 1024 * 1024,
  uploadAllowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  /** Unattached uploads older than this are deleted by the orphan-uploads cron. */
  orphanUploadMaxAgeHours: 24,
  geocoderCacheTtlDays: 30,
  /** Address suggestions fetched (and cached) per search: the largest `limit` `GET /geo/search` serves. */
  geocoderMaxResults: 20,
  pushTicketTtlSeconds: 24 * 60 * 60,
  publicProfileCacheTtlSeconds: 60,
} as const;
