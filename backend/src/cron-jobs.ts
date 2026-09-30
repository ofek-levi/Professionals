/** Every cron job of the API (each module declares its own in `<module>.jobs.ts`). */
import type { AppDeps } from './deps.js';
import type { CronJob } from './infra/cron/index.js';
import { jobJobs } from './modules/jobs/jobs.jobs.js';
import { notificationJobs } from './modules/notifications/notifications.jobs.js';
import { offerJobs } from './modules/offers/offers.jobs.js';

export function allCronJobs(deps: AppDeps): CronJob[] {
  return [...offerJobs(deps), ...jobJobs(deps), ...notificationJobs(deps)];
}
