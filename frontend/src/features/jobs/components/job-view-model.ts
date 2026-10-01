/**
 * Pure view models of the job tracking screen: the progress steps and which actions are presented
 * as the primary footer CTA vs. quiet secondary actions. Permissions themselves come from
 * `getJobActions` (the same rules the backend enforces).
 */
import type { JobActions } from '@/features/jobs/job-status-machine';
import type { Job, UserRole } from '@/types/domain';

// ─────────────────────────────── Progress ───────────────────────────────

export type JobTimelineStepKey = 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

/**
 * - `done`: reached (check mark, with its timestamp when known)
 * - `active`: reached and ongoing (work in progress)
 * - `next`: the next expected step (highlighted)
 * - `upcoming`: later steps
 * - `skipped`: the job was completed without being started separately
 * - `cancelled`: terminal cancellation step
 */
export type JobTimelineStepState = 'done' | 'active' | 'next' | 'upcoming' | 'skipped' | 'cancelled';

export interface JobTimelineStep {
  key: JobTimelineStepKey;
  state: JobTimelineStepState;
  /** When the step happened (ISO), if known. */
  at: string | null;
}

type TimelineJob = Pick<Job, 'status' | 'createdAt' | 'confirmedAt' | 'startedAt' | 'completedAt' | 'cancelledAt'>;

export function getJobTimeline(job: TimelineJob): JobTimelineStep[] {
  const accepted: JobTimelineStep = { key: 'accepted', state: 'done', at: job.createdAt };
  switch (job.status) {
    case 'awaiting_confirmation':
      return [
        accepted,
        { key: 'confirmed', state: 'next', at: null },
        { key: 'in_progress', state: 'upcoming', at: null },
        { key: 'completed', state: 'upcoming', at: null },
      ];
    case 'scheduled':
      return [
        accepted,
        { key: 'confirmed', state: 'done', at: job.confirmedAt },
        { key: 'in_progress', state: 'next', at: null },
        { key: 'completed', state: 'upcoming', at: null },
      ];
    case 'in_progress':
      return [
        accepted,
        { key: 'confirmed', state: 'done', at: job.confirmedAt },
        { key: 'in_progress', state: 'active', at: job.startedAt },
        { key: 'completed', state: 'next', at: null },
      ];
    case 'completed':
      return [
        accepted,
        { key: 'confirmed', state: 'done', at: job.confirmedAt },
        job.startedAt ? { key: 'in_progress', state: 'done', at: job.startedAt } : { key: 'in_progress', state: 'skipped', at: null },
        { key: 'completed', state: 'done', at: job.completedAt },
      ];
    case 'cancelled': {
      // An account deletion also cancels a job already in progress.
      const steps: JobTimelineStep[] = [accepted];
      if (job.confirmedAt) steps.push({ key: 'confirmed', state: 'done', at: job.confirmedAt });
      if (job.startedAt) steps.push({ key: 'in_progress', state: 'done', at: job.startedAt });
      steps.push({ key: 'cancelled', state: 'cancelled', at: job.cancelledAt });
      return steps;
    }
  }
}

// ─────────────────────────────── Actions ───────────────────────────────

export type JobActionKey = 'confirm' | 'start' | 'complete' | 'review';

interface JobActionPlan {
  /** Main CTA in the sticky footer (next to the chat shortcut). */
  primary: JobActionKey | null;
  /** Less prominent actions, shown as quiet text buttons. */
  secondary: JobActionKey[];
  /** Show the "Message" button (chat is open). */
  message: boolean;
}

/**
 * Chooses how the allowed actions are presented:
 * - professional: confirm → start → complete, with "complete" as secondary while "start" is the CTA;
 * - customer: review once completed; "complete" is the CTA only while the work is in progress
 *   (before that it is secondary).
 * Cancelling a booking has one entry point, the request screen ("Cancel request"), so it is not a
 * job action here.
 */
export function planJobActions(job: Pick<Job, 'status'>, role: UserRole, actions: JobActions): JobActionPlan {
  const secondary: JobActionKey[] = [];
  let primary: JobActionKey | null = null;

  if (role === 'professional') {
    if (actions.canConfirm) primary = 'confirm';
    else if (actions.canStart) primary = 'start';
    else if (actions.canComplete) primary = 'complete';
    if (actions.canComplete && primary !== 'complete') secondary.push('complete');
  } else {
    if (actions.canReview) primary = 'review';
    else if (actions.canComplete && job.status === 'in_progress') primary = 'complete';
    if (actions.canComplete && primary !== 'complete') secondary.push('complete');
  }

  return { primary, secondary, message: actions.canMessage };
}
