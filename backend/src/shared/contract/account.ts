/** Account deletion: `GET /me/deletion-impact` and `POST /me/deletion`. */
import type { CategoryId } from '../catalog/index.js';
import type { JobStatus, OfferStatus, RequestStatus } from '../statuses.js';
import type { EntityId, ISODateTimeString } from './common.js';

/** One request, offer or job the deletion changes (what the app lists under its count). */
export interface DeletionImpactItem<Status extends string> {
  /** The request, offer or job id. */
  id: EntityId;
  /** The request it belongs to (its own id for a request). */
  requestId: EntityId;
  categoryId: CategoryId;
  status: Status;
  /** Requests: when published; offers: the proposed start; jobs: the scheduled start. */
  date: ISODateTimeString;
  /** The other party as the user sees them ("Noa L.", a business name); `null` when there is none. */
  counterpartName: string | null;
}

export interface DeletionImpactList<Status extends string> {
  count: number;
  /** The first `API_LIMITS.deletionImpactItems` of them, soonest or newest first. */
  items: DeletionImpactItem<Status>[];
}

/** What `POST /me/deletion` accepts to confirm it is the account holder. */
export interface DeletionReauthentication {
  /** The account has a password: send `password`. */
  password: boolean;
  /** The account is linked to Google: a fresh Google `idToken` of that account works too (the only way without a password). */
  google: boolean;
}

/** `GET /me/deletion-impact`: what deleting the account now would change. */
export type AccountDeletionImpact =
  | {
      role: 'customer';
      reauthentication: DeletionReauthentication;
      /** Requests taking offers or with an active job: cancelled (reason `account_deleted`). */
      requestsToCancel: DeletionImpactList<RequestStatus>;
      /** Pending offers on those requests: declined (their professionals are notified). */
      offersToDecline: number;
      /** Unpublished drafts: deleted. */
      draftsToDelete: number;
      /** Jobs awaiting confirmation, scheduled or in progress: cancelled (the professional is notified). */
      jobsToCancel: DeletionImpactList<JobStatus>;
    }
  | {
      role: 'professional';
      reauthentication: DeletionReauthentication;
      /** Pending offers: withdrawn (the customers are notified). */
      offersToWithdraw: DeletionImpactList<OfferStatus>;
      /** Jobs awaiting confirmation, scheduled or in progress: cancelled with their requests (the customers are notified). */
      jobsToCancel: DeletionImpactList<JobStatus>;
    };
