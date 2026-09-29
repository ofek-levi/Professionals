/**
 * Controller wrapper. Express 5 already forwards rejected promises to the error handler; this adds
 * the "return the DTO" convention: a handler returns the response body and the wrapper sends it as
 * JSON with `status` (default 200). Return `undefined` after writing the response yourself
 * (e.g. `res.status(204).end()` or a 304).
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Returns the response body (or a promise of it); `undefined` = already responded. */
export type Controller<Req extends Request = Request> = (req: Req, res: Response) => unknown;

export function asyncHandler(controller: Controller, options: { status?: number } = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = await controller(req, res);
      if (body === undefined || res.headersSent) return;
      res.status(options.status ?? 200).json(body);
    } catch (error) {
      next(error);
    }
  };
}
