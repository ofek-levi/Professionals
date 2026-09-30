/** Route table of the mock REST API (see docs/ARCHITECTURE.md → REST contract). */
import type { CompiledRoute } from '../router';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { conversationRoutes } from './conversations';
import { customerRoutes } from './customer';
import { jobRoutes } from './jobs';
import { legalRoutes } from './legal';
import { notificationRoutes } from './notifications';
import { offerRoutes } from './offers';
import { professionalRoutes } from './professional';
import { professionalsRoutes } from './professionals';
import { requestRoutes } from './requests';

export const ROUTES: readonly CompiledRoute[] = [
  ...authRoutes,
  ...catalogRoutes,
  ...legalRoutes,
  ...customerRoutes,
  ...requestRoutes,
  ...offerRoutes,
  ...professionalRoutes,
  ...professionalsRoutes,
  ...jobRoutes,
  ...notificationRoutes,
  ...conversationRoutes,
];
