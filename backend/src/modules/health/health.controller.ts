import type { Request, Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { checkReadiness } from './health.service.js';

/** Liveness: the process is up (no dependency checks, so a DB outage does not restart pods). */
export function getHealth(): { status: 'ok' } {
  return { status: 'ok' };
}

/** Readiness: 503 until MongoDB and Redis answer. */
export function getReadiness(deps: Pick<AppDeps, 'redis'>) {
  return async (_req: Request, res: Response) => {
    const readiness = await checkReadiness(deps);
    res.status(readiness.ready ? 200 : 503).json({ status: readiness.ready ? 'ready' : 'unavailable', checks: readiness.checks });
  };
}
