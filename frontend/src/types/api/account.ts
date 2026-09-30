import type { CategoryId, EntityId, ISODateTimeString, JobStatus, OfferStatus, RequestStatus } from '../domain';

/** One request, offer or job that deleting the account changes (listed under its count). */
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
  /** The first few (up to 20), soonest or newest first. */
  items: DeletionImpactItem<Status>[];
}

/** How `POST /me/deletion` can confirm it is the account holder. */
export interface DeletionReauthentication {
  /** The account has a password: send `password`. */
  password: boolean;
  /** The account is linked to Google: a fresh Google `idToken` of that account works too (the only way without a password). */
  google: boolean;
}

/** `GET /me/deletion-impact` – what deleting the account now would change. */
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

/**
 * `POST /me/deletion` → `SuccessResponse`: deletes the account at once (it cannot be undone).
 * Password accounts send `password` (or a Google `idToken` of the linked Google account); Google-only
 * accounts send `googleIdToken`. Errors are 400, never 401: a wrong password →
 * `fieldErrors.password: ['validation:auth.passwordIncorrect']` (it counts towards the sign-in
 * throttle, so 429 may follow); a token of another Google account → `fieldErrors.googleIdToken`.
 */
export interface DeleteAccountRequest {
  password?: string;
  googleIdToken?: string;
}
