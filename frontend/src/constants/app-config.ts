/** App-wide business constants (would typically come from remote config). */
export const APP_CONFIG = {
  defaultCurrency: 'ILS',
  /** Service radius bounds for professionals, km. */
  minServiceRadiusKm: 3,
  maxServiceRadiusKm: 80,
  /** Service radius choices offered when a professional signs up, km (within the bounds above). */
  serviceRadiusPresetsKm: [5, 10, 20, 40, 80] as const,
  defaultServiceRadiusKm: 20,
  /** Account rules (sign-up). */
  passwordMinLength: 8,
  passwordMaxLength: 64,
  personNameMinLength: 2,
  personNameMaxLength: 40,
  /** Distance filter presets on the job explorer, km (the only `maxDistanceKm` values the API accepts). */
  distanceFilterOptionsKm: [5, 10, 20, 40] as const,
  maxRequestPhotos: 6,
  descriptionMinLength: 15,
  descriptionMaxLength: 1000,
  notesMaxLength: 500,
  offerMessageMaxLength: 500,
  messageMaxLength: 2000,
  reviewCommentMaxLength: 800,
  /** Offer price bounds (major currency units). */
  minOfferPrice: 20,
  maxOfferPrice: 200_000,
  /** How far ahead a preferred date / proposed appointment can be scheduled. */
  maxScheduleDaysAhead: 60,
  /** Appointment reminder lead time. */
  appointmentReminderLeadMinutes: 120,
  /** Default page size of cursor-paginated lists. */
  pageSize: 20,
  /** Largest `limit` a paginated endpoint accepts (larger values are rejected with 400). */
  maxPageSize: 100,
} as const;
