/** App-wide business constants (would typically come from remote config). */
export const APP_CONFIG = {
  defaultCurrency: 'ILS',
  /** Service radius bounds for professionals, km. */
  minServiceRadiusKm: 3,
  maxServiceRadiusKm: 80,
  defaultServiceRadiusKm: 15,
  /** Distance filter presets on the job explorer, km. */
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
  pageSize: 20,
} as const;
