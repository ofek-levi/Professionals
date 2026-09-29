/** Correlation id: reuses a sane incoming `X-Request-Id`, otherwise generates one; echoed back. */
import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

const HEADER = 'X-Request-Id';
const VALID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.get(HEADER);
    req.id = incoming && VALID.test(incoming) ? incoming : randomUUID();
    res.setHeader(HEADER, req.id);
    next();
  };
}
