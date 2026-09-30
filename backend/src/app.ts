/**
 * `createApp(deps)`: the Express application without `listen` (server.ts and tests share it).
 * Order matters: request id → logging → security headers/CORS/compression → health (no limits)
 * → JSON body → input guards → /v1 → 404 → error handler.
 */
import compression from 'compression';
import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import type { Env } from './config/env.js';
import type { AppDeps } from './deps.js';
import { setModelClock } from './infra/model-clock.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { rejectOperatorKeys } from './middleware/reject-operator-keys.js';
import { requestId } from './middleware/request-id.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createV1Router } from './routes.js';
import { API_LIMITS } from './shared/limits.js';

function corsOptions(env: Env): CorsOptions {
  return {
    origin: env.corsOrigins === '*' ? true : env.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept-Language', 'If-None-Match', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'ETag', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
  };
}

export function createApp(deps: AppDeps): Express {
  setModelClock(deps.clock);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.env.trustProxy);
  app.set('query parser', 'simple');

  app.use(requestId());
  app.use(httpLogger(deps.logger));
  app.use(helmet());
  app.use(cors(corsOptions(deps.env)));
  app.use(compression());
  app.use(createHealthRouter(deps));

  app.use(express.json({ limit: API_LIMITS.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: API_LIMITS.jsonBodyLimit }));
  app.use(rejectOperatorKeys);
  app.use('/v1', createV1Router(deps));

  app.use(notFound);
  app.use(errorHandler(deps.logger));
  return app;
}
