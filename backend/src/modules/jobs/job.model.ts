/**
 * `jobs`: the agreement created when a customer accepts an offer, and its execution. Price,
 * schedule and category are copied from the offer/request at acceptance (an immutable
 * agreement, and the fields cron jobs, dashboards and lists filter on). The address is read from
 * the request.
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { CATEGORY_IDS, type CategoryId } from '../../shared/catalog/index.js';
import { SUPPORTED_CURRENCIES, USER_ROLES, type CurrencyCode, type UserRole } from '../../shared/domain.js';
import { JOB_STATUSES, type JobStatus } from '../../shared/statuses.js';

export interface JobDoc {
  _id: Types.ObjectId;
  request: Types.ObjectId;
  offer: Types.ObjectId;
  /** `users._id` of the customer. */
  customer: Types.ObjectId;
  /** `professionals._id` (= the professional's user id). */
  professional: Types.ObjectId;
  conversation: Types.ObjectId;
  categoryId: CategoryId;
  status: JobStatus;
  scheduledStartAt: Date;
  estimatedDurationMinutes: number | null;
  agreedPrice: number;
  currency: CurrencyCode;
  confirmedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  completedBy: UserRole | null;
  cancelledAt: Date | null;
  /** Set when the customer reviews the job ("awaiting review" = completed without one). */
  review: Types.ObjectId | null;
  /** Appointment-reminder cron idempotency. */
  reminderSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<JobDoc>(
  {
    request: { type: Schema.Types.ObjectId, ref: 'Request', required: true },
    offer: { type: Schema.Types.ObjectId, ref: 'Offer', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    professional: { type: Schema.Types.ObjectId, ref: 'Professional', required: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    categoryId: { type: String, enum: CATEGORY_IDS, required: true },
    status: { type: String, enum: JOB_STATUSES, required: true },
    scheduledStartAt: { type: Date, required: true },
    estimatedDurationMinutes: { type: Number, default: null },
    agreedPrice: { type: Number, required: true },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, required: true },
    confirmedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: String, enum: [...USER_ROLES, null], default: null },
    cancelledAt: { type: Date, default: null },
    review: { type: Schema.Types.ObjectId, ref: 'Review', default: null },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: modelTimestamps() },
);

// One job per request: a concurrent second acceptance fails on this key (→ 409).
jobSchema.index({ request: 1 }, { unique: true });
// Job lists `active`/`upcoming`/`all` (`status: {$in}` + scheduledStartAt order, merged per status),
// dashboards (active jobs), "hired by viewer" contact check (customer prefix).
jobSchema.index({ customer: 1, status: 1, scheduledStartAt: 1, _id: 1 });
jobSchema.index({ professional: 1, status: 1, scheduledStartAt: 1, _id: 1 });
// Completed jobs newest first: `completed` list, "awaiting review", completed-job counts and the
// professional's earnings this month (completedAt range). Partial: only completed jobs have it.
const COMPLETED_ONLY = { partialFilterExpression: { status: 'completed' } };
jobSchema.index({ customer: 1, completedAt: -1, _id: -1 }, COMPLETED_ONLY);
jobSchema.index({ professional: 1, completedAt: -1, _id: -1 }, COMPLETED_ONLY);
// Appointment-reminder cron: upcoming awaiting_confirmation/scheduled jobs.
jobSchema.index({ status: 1, scheduledStartAt: 1 });

export const JobModel = model<JobDoc>('Job', jobSchema);
