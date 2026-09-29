/**
 * Appointment reminders (the mock scheduler's `sendAppointmentReminders`, run by the
 * `appointment-reminders` cron): both parties of a confirmed or awaiting job are reminded once when
 * it starts within `appointmentReminderLeadMinutes`. `reminderSentAt` is claimed in the same
 * transaction that stores the two notifications, so a reminder is sent exactly once.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { loadByIds } from '../../lib/batch.js';
import { customerShortName } from '../../lib/text.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { createNotifications } from '../notifications/create-notification.service.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { JobModel, type JobDoc } from './job.model.js';

type ReminderDeps = Pick<AppDeps, 'logger' | 'clock' | 'realtime' | 'push' | 'redis' | 'keys' | 'background'>;

const BATCH_SIZE = 100;
const MAX_BATCHES = 20;

async function remind(deps: ReminderDeps, job: JobDoc, names: { customer: string; professional: string }, now: Date): Promise<boolean> {
  return withTransaction(deps.logger, async (tx) => {
    // `timestamps: false`: a reminder is not a change of the job the apps should see.
    const claimed = await JobModel.updateOne({ _id: job._id, reminderSentAt: null }, { $set: { reminderSentAt: now } }, { session: tx.session, timestamps: false });
    if (claimed.modifiedCount === 0) return false;
    await createNotifications(
      deps,
      [
        { userId: job.customer, input: { type: 'appointment_reminder', job, recipientRole: 'customer', counterpartName: names.professional } },
        { userId: job.professional, input: { type: 'appointment_reminder', job, recipientRole: 'professional', counterpartName: names.customer } },
      ],
      tx,
    );
    return true;
  });
}

/** Returns how many jobs were reminded. */
export async function sendAppointmentReminders(deps: ReminderDeps): Promise<number> {
  const now = deps.clock.now();
  const horizon = new Date(now.getTime() + APP_CONFIG.appointmentReminderLeadMinutes * 60_000);
  const failed: Types.ObjectId[] = [];
  let reminded = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const due = await JobModel.find({
      status: { $in: ['awaiting_confirmation', 'scheduled'] },
      scheduledStartAt: { $gt: now, $lte: horizon },
      reminderSentAt: null,
      _id: { $nin: failed },
    })
      .sort({ scheduledStartAt: 1 })
      .limit(BATCH_SIZE)
      .lean<JobDoc[]>();
    const [professionals, customers] = await Promise.all([
      loadByIds<ProfessionalDoc, Pick<ProfessionalDoc, '_id' | 'displayName'>>(ProfessionalModel, due.map((job) => job.professional), { displayName: 1 }),
      loadByIds<UserDoc, Pick<UserDoc, '_id' | 'firstName' | 'lastName'>>(UserModel, due.map((job) => job.customer), { firstName: 1, lastName: 1 }),
    ]);
    for (const job of due) {
      const customer = customers.get(job.customer.toHexString());
      const names = { customer: customer ? customerShortName(customer) : '', professional: professionals.get(job.professional.toHexString())?.displayName ?? '' };
      try {
        if (await remind(deps, job, names, now)) reminded += 1;
      } catch (error) {
        failed.push(job._id);
        deps.logger.error({ err: error, jobId: job._id.toHexString() }, 'appointment reminder failed');
      }
    }
    if (due.length < BATCH_SIZE) break;
  }
  if (reminded > 0) deps.logger.info({ reminded }, 'sent appointment reminders');
  return reminded;
}
