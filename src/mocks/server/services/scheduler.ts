/**
 * Time based tasks, run before every request with the injected clock (a real backend would use
 * cron jobs / delayed queues):
 * - pending offers past `expiresAt` expire (the professional is notified and the request returns
 *   to `open` when no pending offers remain);
 * - appointment reminders are sent once to both parties when a job starts within
 *   `APP_CONFIG.appointmentReminderLeadMinutes`.
 */
import { APP_CONFIG } from '@/constants/app-config';

import type { ServerContext } from '../context';
import { customerShortName, professionalUserId, requireProfessional, requireStoredUser } from '../queries';
import { expireOffer } from './lifecycle-service';
import { notify } from './notification-service';

export function expireOverdueOffers(ctx: ServerContext): number {
  const now = ctx.now().getTime();
  const overdue = ctx.db.offers.filter((offer) => offer.status === 'pending' && Date.parse(offer.expiresAt) <= now);
  overdue.forEach((offer) => expireOffer(ctx, offer.id));
  return overdue.length;
}

export function sendAppointmentReminders(ctx: ServerContext): number {
  const now = ctx.now().getTime();
  const leadMs = APP_CONFIG.appointmentReminderLeadMinutes * 60_000;
  const due = ctx.db.jobs.filter((job) => {
    if (job.reminderSentAt !== null) return false;
    if (job.status !== 'scheduled' && job.status !== 'awaiting_confirmation') return false;
    const startsIn = Date.parse(job.scheduledStartAt) - now;
    return startsIn > 0 && startsIn <= leadMs;
  });
  for (const job of due) {
    const professional = requireProfessional(ctx.db, job.professionalId);
    const customer = requireStoredUser(ctx.db, job.customerId);
    notify(ctx, job.customerId, {
      type: 'appointment_reminder',
      job,
      recipientRole: 'customer',
      counterpartName: professional.displayName,
    });
    notify(ctx, professionalUserId(ctx.db, job.professionalId), {
      type: 'appointment_reminder',
      job,
      recipientRole: 'professional',
      counterpartName: customerShortName(customer),
    });
    ctx.db.jobs.update(job.id, { reminderSentAt: ctx.nowIso() });
  }
  return due.length;
}

/** Runs every scheduled task. Returns true when anything changed. */
export function runScheduledTasks(ctx: ServerContext): boolean {
  const expired = expireOverdueOffers(ctx);
  const reminders = sendAppointmentReminders(ctx);
  return expired + reminders > 0;
}
