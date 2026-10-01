/**
 * Account deletion (`GET /me/deletion-impact`, `POST /me/deletion`) with the backend's observable
 * rules (backend/docs/API.md → Users):
 * - proof first: the password of a password account (or a Google token of its linked Google
 *   account), a Google token of the linked account for a Google-only one; refusals are 400, never
 *   401 (the app refreshes on a 401);
 * - then, all or nothing: every active request of a customer is cancelled (`account_deleted`:
 *   pending offers declined, an active job cancelled), and the requests no professional made an
 *   offer on (drafts too) are deleted – nobody else ever saw them; a professional's pending
 *   offers (overdue ones too) are withdrawn and their active jobs cancelled with their requests
 *   (`job_cancelled` to the customer). The other parties' texts get no name ("A customer");
 * - an anonymous tombstone stays (shown as "Deleted user" with `accountDeleted`), every chat of the
 *   account closes, its notifications, sessions and sign-in credential go (the email and the
 *   Google account can sign up again).
 */
import { z } from 'zod';

import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import type { AccountDeletionImpact, DeletionImpactItem, DeletionImpactList, SuccessResponse } from '@/types/api';
import type { JobStatus, NotificationPreferences, Offer, ServiceRequest } from '@/types/domain';
import { compareIds } from '@/utils/id';

import type { Actor, CustomerActor, ProfessionalActor } from '../auth';
import type { ServerContext } from '../context';
import type { StoredCredential, StoredJob } from '../db';
import { SUCCESS } from '../handlers/shared';
import { verifyPassword } from '../passwords';
import { customerShortName, DELETED_USER_NAME, requireProfessional, requireRequest, requireStoredUser } from '../queries';
import { approximateLocation } from '../request-matching';
import { revokeAllSessions } from '../sessions';
import { parseBody } from '../validate';
import { googleClaimsOf } from './account-service';
import { cancelJobOfDeletedProfessional, cancelRequestAndItsWork, withdrawPendingOffer } from './lifecycle-service';
import { closeConversation } from './messaging-service';

/** How many items of each list the impact shows (`count` covers them all). */
const IMPACT_ITEMS = 20;

/** Requests past draft that are not finished: taking offers, or with an active job. */
const CANCELLABLE_REQUEST_STATUSES: readonly ServiceRequest['status'][] = [
  'open',
  'offers_received',
  'professional_selected',
  'scheduled',
  'in_progress',
];
const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ['awaiting_confirmation', 'scheduled', 'in_progress'];

const NOTHING_ENABLED: NotificationPreferences = {
  pushEnabled: false,
  emailEnabled: false,
  jobUpdates: false,
  messages: false,
  newRequests: false,
  reminders: false,
};

const deleteAccountSchema = z.object({
  password: z
    .string({ error: vm('auth.passwordRequired') })
    .min(1, vm('auth.passwordRequired'))
    .optional(),
  googleIdToken: z
    .string({ error: vm('invalid') })
    .trim()
    .min(1, vm('required'))
    .optional(),
});

// ────────────────────────────── What changes ──────────────────────────────

/** One read shared by the preview and the deletion. */
interface CustomerImpact {
  drafts: ServiceRequest[];
  requests: ServiceRequest[];
  jobs: StoredJob[];
}

interface ProfessionalImpact {
  offers: Offer[];
  jobs: StoredJob[];
}

const bySoonest = (a: StoredJob, b: StoredJob) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt) || compareIds(a.id, b.id);
const byNewest =
  <T extends { id: string }>(date: (row: T) => string) =>
  (a: T, b: T) =>
    Date.parse(date(b)) - Date.parse(date(a)) || compareIds(b.id, a.id);

function activeJobs(ctx: ServerContext, isParty: (job: StoredJob) => boolean): StoredJob[] {
  return ctx.db.jobs.filter((job) => isParty(job) && ACTIVE_JOB_STATUSES.includes(job.status)).sort(bySoonest);
}

function customerImpact(ctx: ServerContext, actor: CustomerActor): CustomerImpact {
  const own = ctx.db.requests.filter((request) => request.customerId === actor.userId);
  return {
    drafts: own.filter((request) => request.status === 'draft'),
    requests: own.filter((request) => CANCELLABLE_REQUEST_STATUSES.includes(request.status)).sort(byNewest((request) => request.createdAt)),
    jobs: activeJobs(ctx, (job) => job.customerId === actor.userId),
  };
}

function professionalImpact(ctx: ServerContext, actor: ProfessionalActor): ProfessionalImpact {
  return {
    offers: ctx.db.offers
      .filter((offer) => offer.professionalId === actor.professional.id && offer.status === 'pending')
      .sort(byNewest((offer) => offer.updatedAt)),
    jobs: activeJobs(ctx, (job) => job.professionalId === actor.professional.id),
  };
}

function list<T, Status extends string>(rows: T[], toItem: (row: T) => DeletionImpactItem<Status>): DeletionImpactList<Status> {
  return { count: rows.length, items: rows.slice(0, IMPACT_ITEMS).map(toItem) };
}

/** "Noa L." (the customer's short name). */
function customerName(ctx: ServerContext, customerId: string): string {
  const user = requireStoredUser(ctx.db, customerId);
  return user.deletedAt ? DELETED_USER_NAME : customerShortName(user);
}

function jobItem(job: StoredJob, counterpartName: string): DeletionImpactItem<JobStatus> {
  return {
    id: job.id,
    requestId: job.requestId,
    categoryId: job.categoryId,
    status: job.status,
    date: job.scheduledStartAt,
    counterpartName,
  };
}

function credentialOf(ctx: ServerContext, userId: string): StoredCredential | undefined {
  return ctx.db.credentials.find((credential) => credential.userId === userId);
}

/** `GET /me/deletion-impact` */
export function getDeletionImpact(ctx: ServerContext, actor: Actor): AccountDeletionImpact {
  const credential = credentialOf(ctx, actor.userId);
  const reauthentication = { password: Boolean(credential?.passwordHash), google: Boolean(credential?.googleSubject) };
  const proName = (professionalId: string) => requireProfessional(ctx.db, professionalId).displayName;
  if (actor.role === 'customer') {
    const impact = customerImpact(ctx, actor);
    // A request with an active job is that job's request: its counterpart is the hired professional.
    const hiredFor = new Map(impact.jobs.map((job) => [job.requestId, job.professionalId]));
    return {
      role: 'customer',
      reauthentication,
      requestsToCancel: list(impact.requests, (request) => {
        const hired = hiredFor.get(request.id);
        return {
          id: request.id,
          requestId: request.id,
          categoryId: request.categoryId,
          status: request.status,
          date: request.publishedAt ?? request.createdAt,
          counterpartName: hired ? proName(hired) : null,
        };
      }),
      offersToDecline: impact.requests.reduce((sum, request) => sum + request.pendingOfferCount, 0),
      draftsToDelete: impact.drafts.length,
      jobsToCancel: list(impact.jobs, (job) => jobItem(job, proName(job.professionalId))),
    };
  }
  const impact = professionalImpact(ctx, actor);
  return {
    role: 'professional',
    reauthentication,
    offersToWithdraw: list(impact.offers, (offer) => {
      const request = requireRequest(ctx.db, offer.requestId);
      return {
        id: offer.id,
        requestId: offer.requestId,
        categoryId: request.categoryId,
        status: offer.status,
        date: offer.proposedStartAt,
        counterpartName: customerName(ctx, request.customerId),
      };
    }),
    jobsToCancel: list(impact.jobs, (job) => jobItem(job, customerName(ctx, job.customerId))),
  };
}

// ────────────────────────────── Deleting ──────────────────────────────

/** The proof that the account holder is deleting it (400 on a refusal, never 401). */
function reauthenticate(ctx: ServerContext, credential: StoredCredential | undefined, body: unknown): void {
  const { password, googleIdToken } = parseBody(deleteAccountSchema, body ?? {});
  const passwordHash = credential?.passwordHash ?? null;
  const googleSubject = credential?.googleSubject ?? null;
  if (passwordHash && password !== undefined) {
    if (verifyPassword(password, passwordHash)) return;
    throw DomainError.validation({ password: [vm('auth.passwordIncorrect')] }, 'The password is incorrect');
  }
  if (googleSubject && googleIdToken !== undefined) {
    if (googleClaimsOf(ctx, googleIdToken)?.sub === googleSubject) return;
    throw DomainError.validation({ googleIdToken: [vm('invalid')] }, 'Confirm with the Google account linked to this account');
  }
  throw passwordHash
    ? DomainError.validation({ password: [vm('auth.passwordRequired')] }, 'Enter your password to delete the account')
    : DomainError.validation({ googleIdToken: [vm('required')] }, 'Confirm with Google to delete the account');
}

/**
 * Everything a deleted customer leaves: the requests professionals made offers on, without the
 * exact place, notes or photos (the others go); reviews without the comment.
 */
function eraseCustomerData(ctx: ServerContext, actor: CustomerActor): void {
  ctx.db.requests
    .filter((request) => request.customerId === actor.userId)
    .forEach((request) => {
      if (ctx.db.offers.count((offer) => offer.requestId === request.id) === 0) {
        ctx.db.requests.delete(request.id);
        return;
      }
      ctx.db.requests.update(request.id, {
        location: approximateLocation(request.location, request.id),
        notes: null,
        photos: [],
        cancellationComment: null,
      });
    });
  // The hired professionals' job records keep the area, not the address.
  ctx.db.jobs
    .filter((job) => job.customerId === actor.userId)
    .forEach((job) => ctx.db.jobs.update(job.id, { location: approximateLocation(job.location, job.requestId) }));
  ctx.db.reviews
    .filter((review) => review.customerId === actor.userId)
    .forEach((review) =>
      ctx.db.reviews.update(review.id, {
        comment: null,
        customerDisplayName: DELETED_USER_NAME,
        customerAvatarUrl: null,
        customerAccountDeleted: true,
      }),
    );
  ctx.db.customerProfiles.update(actor.userId, {
    defaultLocation: null,
    savedLocations: [],
    notificationPreferences: { ...NOTHING_ENABLED },
    updatedAt: ctx.nowIso(),
  });
}

/** A deleted professional's profile keeps its stats; it leaves every search and match (no categories). */
function eraseProfessionalData(ctx: ServerContext, actor: ProfessionalActor): void {
  const professional = requireProfessional(ctx.db, actor.professional.id);
  ctx.db.offers
    .filter((offer) => offer.professionalId === professional.id && offer.message !== null)
    .forEach((offer) => ctx.db.offers.update(offer.id, { message: null }));
  const { center, label } = professional.serviceArea;
  const approximateCenter = approximateLocation(
    { coordinates: center, addressLine: '', city: label, neighborhood: null, details: null, isApproximate: false },
    professional.id,
  ).coordinates;
  ctx.db.professionals.update(professional.id, {
    fullName: '',
    displayName: DELETED_USER_NAME,
    avatarUrl: null,
    headline: '',
    bio: '',
    categoryIds: [],
    baseLocation: null,
    serviceArea: { ...professional.serviceArea, center: approximateCenter },
    contact: { phone: '', email: '', website: null },
    business: { businessName: null, licenseNumber: null, isInsured: false, languages: [] },
    startingPrice: null,
    notificationPreferences: { ...NOTHING_ENABLED },
    updatedAt: ctx.nowIso(),
  });
}

/** The account itself: a tombstone (id, role, language, dates); nothing that names the person. */
function eraseAccount(ctx: ServerContext, actor: Actor, credential: StoredCredential | undefined): void {
  ctx.db.conversations
    .filter((conversation) => conversation.participants.some((participant) => participant.userId === actor.userId))
    .forEach((conversation) => closeConversation(ctx, conversation.id));
  ctx.db.notifications
    .filter((notification) => notification.userId === actor.userId)
    .forEach((notification) => ctx.db.notifications.delete(notification.id));
  if (credential) ctx.db.credentials.delete(credential.email);
  ctx.db.users.update(actor.userId, {
    firstName: '',
    lastName: '',
    displayName: DELETED_USER_NAME,
    email: `deleted-${actor.userId}@deleted.invalid`,
    phone: '',
    avatarUrl: null,
    deletedAt: ctx.nowIso(),
  });
  revokeAllSessions(ctx, actor.userId);
}

/** `POST /me/deletion` – a second submit finds no session left (401, like any request of a deleted account). */
export function deleteAccount(ctx: ServerContext, actor: Actor, body: unknown): SuccessResponse {
  const credential = credentialOf(ctx, actor.userId);
  reauthenticate(ctx, credential, body);
  if (actor.role === 'customer') {
    const impact = customerImpact(ctx, actor);
    for (const request of impact.requests) {
      cancelRequestAndItsWork(ctx, request, { reason: 'account_deleted', comment: null, customerName: '' });
    }
    eraseCustomerData(ctx, actor);
  } else {
    const impact = professionalImpact(ctx, actor);
    for (const offer of impact.offers) withdrawPendingOffer(ctx, offer, '');
    for (const job of impact.jobs) cancelJobOfDeletedProfessional(ctx, job);
    eraseProfessionalData(ctx, actor);
  }
  eraseAccount(ctx, actor, credential);
  return SUCCESS;
}
