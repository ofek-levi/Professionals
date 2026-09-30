/**
 * Error copy. `codes.<ApiErrorCode>` must cover every entry of `API_ERROR_CODES`
 * (rendered by `<ErrorState />` and `useErrorText()`).
 */
export const errors = {
  codes: {
    NETWORK_ERROR: {
      title: 'No connection',
      description: 'We couldn’t reach the server. Check your internet connection and try again.',
    },
    TIMEOUT: {
      title: 'This is taking too long',
      description: 'The server didn’t respond in time. Please try again.',
    },
    UNAUTHORIZED: {
      title: 'Please sign in again',
      description: 'Your session has expired. Sign in to continue.',
    },
    INVALID_CREDENTIALS: {
      title: 'Wrong email or password',
      description: 'Check your email and password and try again, or reset your password.',
    },
    INVALID_GOOGLE_TOKEN: {
      title: 'Google sign-in didn’t work',
      description: 'We couldn’t verify your Google account. Please try again.',
    },
    FORBIDDEN: {
      title: 'No access',
      description: 'You don’t have permission to view or change this.',
    },
    NOT_FOUND: {
      title: 'Not found',
      description: 'This item may have been removed or is no longer available.',
    },
    VALIDATION_ERROR: {
      title: 'Please check your details',
      description: 'Some information is missing or invalid. Review the form and try again.',
    },
    CONFLICT: {
      title: 'Something changed',
      description: 'This was updated in the meantime. Refresh and try again.',
    },
    EMAIL_ALREADY_REGISTERED: {
      title: 'This email is already registered',
      description: 'Sign in with this email instead, or use a different one.',
    },
    INVALID_STATE_TRANSITION: {
      title: 'This action is no longer available',
      description: 'The status has changed in the meantime. Refresh to see the latest details.',
    },
    DUPLICATE_OFFER: {
      title: 'You already sent an offer',
      description: 'You can edit or withdraw your existing offer for this request.',
    },
    OFFER_EXPIRED: {
      title: 'This offer has expired',
      description: 'The offer is no longer valid. Choose another offer or wait for a new one.',
    },
    REQUEST_NOT_ACCEPTING_OFFERS: {
      title: 'This request is closed',
      description: 'The customer is no longer accepting offers for this request.',
    },
    UNSUPPORTED_CATEGORY: {
      title: 'Service not supported',
      description: 'This service category isn’t available. Please choose another one.',
    },
    OUTSIDE_SERVICE_AREA: {
      title: 'Outside your service area',
      description: 'This request is outside the area you serve. Update your service area to respond.',
    },
    RATE_LIMITED: {
      title: 'Too many attempts',
      description: 'Please wait a moment before trying again.',
    },
    SERVER_ERROR: {
      title: 'We’re having trouble',
      description: 'It’s not you, it’s us. Please try again in a few minutes.',
    },
    UNKNOWN: {
      title: 'Something went wrong',
      description: 'An unexpected error occurred. Please try again.',
    },
  },
  /** `Retry-After` of a 429, appended to the RATE_LIMITED text. */
  retryAfter: {
    seconds_one: 'Please try again in {{count}} second.',
    seconds_other: 'Please try again in {{count}} seconds.',
    minutes_one: 'Please try again in {{count}} minute.',
    minutes_other: 'Please try again in {{count}} minutes.',
  },
  /** `POST /uploads/images` failures. */
  upload: {
    invalid: {
      title: 'This photo can’t be used',
      description: 'Choose a JPEG, PNG, WebP or HEIC photo of up to 8 MB.',
    },
    rateLimited: {
      title: 'Too many photos for now',
      description: 'You’ve uploaded a lot of photos recently. Please try again later.',
    },
  },
} as const;
