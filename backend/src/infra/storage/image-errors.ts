/**
 * Refusals of an image post that are about its images carry the file field (`photos`, `avatar`) in
 * `fieldErrors`, whatever their status. The app shows its photo message for exactly these, and
 * handles any other error of the same post (a form field, the request rate limit) as usual.
 */
import { ApiError } from '../../lib/errors.js';
import { vm } from '../../shared/validation-messages.js';

export const imageErrors = {
  /** 400: not an image (JPEG, PNG, WebP, HEIC), or not sent as `field`. */
  invalid(field: string, message: string): ApiError {
    return ApiError.validation({ [field]: [vm('upload.invalid')] }, message);
  },
  /** 413: a file (or the whole body) is larger than a post can be. */
  tooLarge(field: string): ApiError {
    return new ApiError('VALIDATION_ERROR', 'The image is larger than the upload limit', { status: 413, fieldErrors: { [field]: [vm('upload.invalid')] } });
  },
  /** 429: the user's image limits (posts per hour, posts at once, bytes per day). */
  rateLimited(field: string, message: string, retryAfterSeconds?: number): ApiError {
    return new ApiError('RATE_LIMITED', message, { fieldErrors: { [field]: [vm('upload.rateLimited')] }, retryAfterSeconds });
  },
  /** 503: image storage is not configured or failed, or this server is busy with other uploads. */
  unavailable(field: string, message: string, retryAfterSeconds?: number): ApiError {
    return new ApiError('SERVER_ERROR', message, { status: 503, fieldErrors: { [field]: [vm('upload.unavailable')] }, retryAfterSeconds });
  },
};
