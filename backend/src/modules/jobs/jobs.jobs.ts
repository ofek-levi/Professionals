/** `appointment-reminders` (every 15 min): see appointment-reminders.service.ts. */
import type { AppDeps } from '../../deps.js';
import type { CronJob } from '../../infra/cron/index.js';
import { sendAppointmentReminders } from './appointment-reminders.service.js';

export function jobJobs(deps: AppDeps): CronJob[] {
  return [
    {
      name: 'appointment-reminders',
      schedule: '*/15 * * * *',
      lockTtlMs: 10 * 60_000,
      run: async () => {
        await sendAppointmentReminders(deps);
      },
    },
  ];
}
