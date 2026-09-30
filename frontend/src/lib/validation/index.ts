/**
 * Validation schemas (zod v4) of the forms, matching the backend's rules (the test double
 * validates with them too).
 * Messages are `validation:*` i18n keys – translate them with `t(message)`.
 */
export * from './messages';
export * from './field-errors';
export * from './common';
export * from './request';
export * from './offer';
export * from './profile';
export * from './review';
export * from './message';
export * from './cancel';
export * from './auth';
