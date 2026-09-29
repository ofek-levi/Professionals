/** `offer-expiry` (every 5 min): pending offers past `expiresAt` expire (see offer-expiry.service.ts). */
import type { AppDeps } from '../../deps.js';
import type { CronJob } from '../../infra/cron/index.js';
import { expireOverdueOffers } from './offer-expiry.service.js';

export function offerJobs(deps: AppDeps): CronJob[] {
  return [
    {
      name: 'offer-expiry',
      schedule: '*/5 * * * *',
      lockTtlMs: 4 * 60_000,
      run: async () => {
        await expireOverdueOffers(deps);
      },
    },
  ];
}
