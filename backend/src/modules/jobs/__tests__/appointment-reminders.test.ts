import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { createCustomer, createJob, createOffer, createProfessional, createRequest } from '../../../../test/factories.js';
import { NotificationModel } from '../../notifications/notification.model.js';
import { HOUR } from '../../requests/__tests__/marketplace-fixtures.js';
import { UserModel } from '../../users/user.model.js';
import { sendAppointmentReminders } from '../appointment-reminders.service.js';
import { JobModel } from '../job.model.js';
import { jobJobs } from '../jobs.jobs.js';

describe('appointment-reminders cron', () => {
  const deps = createTestDeps();
  beforeEach(clearDatabase);

  async function jobStartingIn(hours: number, status: 'scheduled' | 'awaiting_confirmation' | 'in_progress' = 'scheduled') {
    const customer = await createCustomer();
    const { professional } = await createProfessional();
    const request = await createRequest(customer, { status: 'scheduled' });
    const offer = await createOffer(request, professional, { status: 'accepted', proposedStartAt: new Date(deps.clock.now().getTime() + hours * HOUR) });
    return { customer, professional, job: await createJob(request, offer, { status }) };
  }

  it('reminds both parties once when the job starts within the lead time', async () => {
    const soon = await jobStartingIn(1.5);
    const awaiting = await jobStartingIn(1, 'awaiting_confirmation');
    await jobStartingIn(3);
    await jobStartingIn(1, 'in_progress');
    await jobStartingIn(-1);

    expect(await sendAppointmentReminders(deps)).toBe(2);
    expect(await sendAppointmentReminders(deps)).toBe(0);
    const reminders = await NotificationModel.find({ type: 'appointment_reminder' }).lean();
    expect(reminders).toHaveLength(4);
    const forPro = reminders.find((n) => n.user.equals(soon.professional._id));
    expect(forPro?.params).toMatchObject({ customerName: expect.stringMatching(/^Noa L/), categoryId: 'plumbing' });
    const forCustomer = reminders.find((n) => n.user.equals(soon.customer._id));
    expect(forCustomer?.params).toMatchObject({ professionalName: soon.professional.displayName });
    expect(forCustomer?.target).toEqual({ kind: 'job', jobId: soon.job._id.toHexString() });
    const stored = await JobModel.findById(awaiting.job._id).lean();
    expect(stored?.reminderSentAt).toEqual(deps.clock.now());
    // The reminder is not a visible change of the job.
    expect(stored?.updatedAt).toEqual(awaiting.job.updatedAt);
  });

  it('runs through the cron job and honours the reminders toggle', async () => {
    const { customer } = await jobStartingIn(1);
    await UserModel.updateOne({ _id: customer._id }, { $set: { 'notificationPreferences.reminders': false } });
    const [job] = jobJobs(deps);
    expect(job?.name).toBe('appointment-reminders');
    await job?.run();
    expect(await NotificationModel.countDocuments({ user: customer._id })).toBe(0);
    expect(await NotificationModel.countDocuments({ type: 'appointment_reminder' })).toBe(1);
  });
});
