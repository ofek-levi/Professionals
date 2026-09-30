/**
 * Admission of image posts (`POST /requests`, `PATCH /requests/:id`, `PUT /me/avatar`). Their files
 * stay in memory until the service has stored them (up to 6 × 8 MiB), and the hourly image rate
 * limit counts posts as they arrive, not how many run at once. So each API process admits, before
 * reading a body:
 * - at most `API_LIMITS.imagePostsInFlightPerUser` posts of one user at once (429);
 * - bodies of up to `IMAGE_UPLOAD_MEMORY_MB` in all, counted by their declared `Content-Length`
 *   (503 with `Retry-After`; a body without one counts as the largest a post can be);
 * and refuses a body larger than a post can be (413) without reading it. A post is released when
 * its response is finished or its client went away. The counters are per process because the
 * memory they protect is.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { imageErrors } from '../infra/storage/image-errors.js';
import { ApiError } from '../lib/errors.js';
import type { AuthContext } from './auth.js';

/** Seconds a refused post is told to wait (the posts in flight usually finish within that). */
const BUSY_RETRY_AFTER_SECONDS = 10;

export interface ImageAdmissionLimits {
  /** Bytes of image post bodies held at once by this process. */
  maxBytes: number;
  postsPerUser: number;
}

export type Admission = { release: () => void } | { refused: 'user' | 'server' };

export class ImagePostAdmission {
  private bytes = 0;
  private readonly posts = new Map<string, number>();

  constructor(private readonly limits: ImageAdmissionLimits) {}

  /** Reserves `bytes` for a post of `userId`, or says which limit refused it. */
  admit(userId: string, bytes: number): Admission {
    const posts = this.posts.get(userId) ?? 0;
    if (posts >= this.limits.postsPerUser) return { refused: 'user' };
    if (this.bytes + bytes > this.limits.maxBytes) return { refused: 'server' };
    this.bytes += bytes;
    this.posts.set(userId, posts + 1);
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.bytes -= bytes;
        const left = (this.posts.get(userId) ?? 1) - 1;
        if (left > 0) this.posts.set(userId, left);
        else this.posts.delete(userId);
      },
    };
  }

  /** Bytes reserved by the posts in flight. */
  get bytesInFlight(): number {
    return this.bytes;
  }
}

/** The declared body size; a body without `Content-Length` (chunked) counts as `max`. */
function declaredBytes(req: Request, max: number): number {
  const header = req.headers['content-length'];
  const declared = header === undefined ? Number.NaN : Number(header);
  return Number.isSafeInteger(declared) && declared >= 0 ? declared : max;
}

/** Middleware (after `requireAuth` and the image rate limit, before the multipart parser). */
export function admitImagePost(admission: ImagePostAdmission, field: string, maxBodyBytes: number): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const bytes = declaredBytes(req, maxBodyBytes);
    if (bytes > maxBodyBytes) {
      next(imageErrors.tooLarge(field));
      return;
    }
    const auth: AuthContext | undefined = req.auth;
    if (!auth) {
      next(ApiError.unauthorized());
      return;
    }
    const admitted = admission.admit(auth.userId.toHexString(), bytes);
    if ('refused' in admitted) {
      next(
        admitted.refused === 'user'
          ? imageErrors.rateLimited(field, 'Wait until your other photos are uploaded', BUSY_RETRY_AFTER_SECONDS)
          : imageErrors.unavailable(field, 'The server is busy with other photo uploads, please try again shortly', BUSY_RETRY_AFTER_SECONDS),
      );
      return;
    }
    res.once('close', admitted.release);
    next();
  };
}
