/**
 * Routes that take images together with the thing that owns them (`POST /requests`,
 * `PATCH /requests/:id`, `PUT /me/avatar`) read `multipart/form-data`: the images in one file
 * field and, for requests, the JSON payload in the text field `data` (it becomes `req.body`, so
 * controllers validate it like any JSON body). Files are buffered in memory (at most `maxFiles`
 * of `APP_CONFIG.maxUploadBytes`); the service checks their bytes and stores them once the
 * payload is valid. Use after `requireAuth`. Before the body is read: the per-user rate limit, the
 * admission of posts in flight (`image-admission.ts`), and without image storage (development) the
 * first file answers 503 before its bytes are read. Refusals about the images name the file field
 * (`infra/storage/image-errors.ts`).
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';

import type { AppDeps } from '../deps.js';
import { imageErrors } from '../infra/storage/image-errors.js';
import { ApiError, isApiError } from '../lib/errors.js';
import { APP_CONFIG } from '../shared/limits.js';
import { vm } from '../shared/validation-messages.js';
import { admitImagePost } from './image-admission.js';
import { RATE_LIMITS, rateLimit, userKey } from './rate-limit.js';
import { findForbiddenKey } from './reject-operator-keys.js';

/** Largest JSON payload in `data` (the JSON body limit, 100 KB). */
const JSON_FIELD_MAX_BYTES = 100 * 1024;
/** Text fields besides `data` are ignored; a few are tolerated. */
const MAX_FIELDS = 5;
/** Room for each part's boundary and headers (file name, type) in the body size. */
const PART_OVERHEAD_BYTES = 16 * 1024;

export interface ImageFieldOptions {
  /** The file field: `photos`, `avatar`. */
  field: string;
  maxFiles: number;
  /** Message of the 400 when more than `maxFiles` files are sent. */
  tooManyFiles: string;
  /** Text field holding the JSON payload (becomes `req.body`); omit when there is none. */
  jsonField?: string;
}

type MultipartDeps = Pick<AppDeps, 'env' | 'redis' | 'keys' | 'storage' | 'imageAdmission'>;

/** The largest body a post of these images can have: a larger declared size is refused unread. */
export function maxImageBodyBytes(options: Pick<ImageFieldOptions, 'maxFiles' | 'jsonField'>): number {
  const parts = options.maxFiles + MAX_FIELDS;
  return options.maxFiles * APP_CONFIG.maxUploadBytes + (options.jsonField ? JSON_FIELD_MAX_BYTES : 0) + parts * PART_OVERHEAD_BYTES;
}

function multerErrorToApi(error: multer.MulterError, options: ImageFieldOptions): ApiError {
  const tooMany = ApiError.validation({ [options.field]: [options.tooManyFiles] }, `At most ${options.maxFiles} image(s) in "${options.field}"`);
  switch (error.code) {
    case 'LIMIT_FILE_COUNT':
      return tooMany;
    case 'LIMIT_UNEXPECTED_FILE':
      if (error.field === options.field) return tooMany;
      return imageErrors.invalid(error.field ?? options.field, `Attach the images as the multipart field "${options.field}"`);
    case 'LIMIT_FILE_SIZE':
      return imageErrors.tooLarge(options.field);
    default:
      return ApiError.validation({ [error.field ?? 'root']: [vm('invalid')] }, 'The multipart body was rejected');
  }
}

function parseFailure(error: unknown, options: ImageFieldOptions): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof multer.MulterError) return multerErrorToApi(error, options);
  // busboy: a truncated or malformed body.
  return ApiError.validation({ root: [vm('invalid')] }, 'Malformed multipart body');
}

/** The JSON object in text field `field`, checked like a JSON body (`reject-operator-keys`). */
function jsonPayload(fields: Record<string, unknown>, field: string): Record<string, unknown> {
  const raw = fields[field];
  const invalid = (message: string) => ApiError.validation({ [field]: [vm(raw === undefined ? 'required' : 'invalid')] }, message);
  if (typeof raw !== 'string') throw invalid(`Send the payload as JSON in the multipart field "${field}"`);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalid(`The multipart field "${field}" is not valid JSON`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalid(`The multipart field "${field}" must be a JSON object`);
  const forbidden = findForbiddenKey(value, []);
  if (forbidden) throw ApiError.validation({ [forbidden]: [vm('invalid')] });
  return value as Record<string, unknown>;
}

function parseMultipart(deps: MultipartDeps, options: ImageFieldOptions): RequestHandler {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: APP_CONFIG.maxUploadBytes, files: options.maxFiles, fields: MAX_FIELDS, fieldSize: JSON_FIELD_MAX_BYTES, parts: options.maxFiles + MAX_FIELDS },
    fileFilter: (_req, _file, callback) => {
      if (deps.storage.configured) callback(null, true);
      else callback(imageErrors.unavailable(options.field, 'Image uploads are not configured on this server'));
    },
  }).array(options.field, options.maxFiles);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.is('multipart/form-data')) {
      next(
        options.jsonField
          ? ApiError.validation({ [options.jsonField]: [vm('required')] }, 'Send multipart/form-data')
          : imageErrors.invalid(options.field, 'Send multipart/form-data'),
      );
      return;
    }
    parser(req, res, (error?: unknown) => {
      if (error) {
        next(parseFailure(error, options));
        return;
      }
      try {
        if (options.jsonField) req.body = jsonPayload(req.body as Record<string, unknown>, options.jsonField);
        next();
      } catch (payloadError) {
        next(payloadError);
      }
    });
  };
}

/** The per-user image rate limit, the admission of posts in flight, then the multipart parser (see the file comment). */
export function imageMultipart(deps: MultipartDeps, options: ImageFieldOptions): RequestHandler[] {
  const refusal = () => imageErrors.rateLimited(options.field, 'Too many photo uploads, please try again later');
  return [
    rateLimit(deps, 'images-user', { ...RATE_LIMITS.imagesPerUser, key: userKey, refusal }),
    admitImagePost(deps.imageAdmission, options.field, maxImageBodyBytes(options)),
    parseMultipart(deps, options),
  ];
}

/** The files `imageMultipart` read, in the order they were sent. */
export function uploadedImages(req: Request): Buffer[] {
  return Array.isArray(req.files) ? req.files.map((file) => file.buffer) : [];
}
