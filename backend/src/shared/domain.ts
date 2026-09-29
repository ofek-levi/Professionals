/** Small enumerations of the API contract (copied from the app's `frontend/src/types/domain/*`). */
export const USER_ROLES = ['customer', 'professional'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUPPORTED_LANGUAGES = ['en', 'he'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PREFERRED_TIME_WINDOWS = ['morning', 'afternoon', 'evening', 'any'] as const;
export type PreferredTimeWindow = (typeof PREFERRED_TIME_WINDOWS)[number];

export const REQUEST_CANCELLATION_REASONS = [
  'no_longer_needed',
  'found_elsewhere',
  'too_expensive',
  'scheduling_conflict',
  'other',
] as const;
export type RequestCancellationReason = (typeof REQUEST_CANCELLATION_REASONS)[number];

export const RATING_VALUES = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATING_VALUES)[number];

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const JOB_SCOPES = ['active', 'upcoming', 'completed', 'all'] as const;
export type JobScope = (typeof JOB_SCOPES)[number];

export const NEARBY_REQUEST_SORTS = ['newest', 'nearest', 'most_urgent', 'fewest_offers'] as const;
export type NearbyRequestSort = (typeof NEARBY_REQUEST_SORTS)[number];

export const OFFER_PRESENCE_FILTERS = ['any', 'no_offers', 'has_offers'] as const;
export type OfferPresenceFilter = (typeof OFFER_PRESENCE_FILTERS)[number];

export const OFFER_SORTS = ['recommended', 'lowest_price', 'earliest_availability', 'highest_rating', 'most_reviews'] as const;
export type OfferSort = (typeof OFFER_SORTS)[number];

/** Time zone the marketplace operates in (calendar dates, "this month", push texts). */
export const MARKET_TIME_ZONE = 'Asia/Jerusalem';
