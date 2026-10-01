/**
 * `GET /me/deletion-impact` and `POST /me/deletion`. Deleting is immediate and all or nothing, in
 * one transaction:
 *  1. the account is marked deleted by a conditional write (a second submit finds it gone: 401,
 *     like any request of a deleted account);
 *  2. what is in progress closes, and the other parties are told (with an empty name, so their
 *     notifications read "A customer" / "A professional"): a customer's requests are cancelled
 *     (reason `account_deleted`) with their pending offers declined and their jobs cancelled; a
 *     professional's pending offers are withdrawn and their active jobs cancelled with the requests
 *     (`job_cancelled` to the customer);
 *  3. the personal data goes and an anonymous tombstone stays (`account-erasure.ts`), every
 *     session is revoked; a record goes once every party to it has deleted their account
 *     (`account-purge.ts`).
 * After the commit: images are deleted from storage, and a confirmation goes to the address the
 * account had (best effort), saying who asked and what was closed. The operator deletes an account
 * the same way (`deleteAccountOf`, run by `src/delete-account.ts`) when its holder asks by email,
 * to close it under the Terms, or again after restoring an older backup (without the email).
 */
import { LEGAL_CONFIG } from '../../config/legal.js';
import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { AccountDeletionImpact } from '../../shared/contract/index.js';
import { cancelJobForDeletedProfessional } from '../jobs/job-lifecycle.service.js';
import { withdrawOfferInTx } from '../offers/offer-changes.service.js';
import { cancelRequestInTx } from '../requests/request-cancel.service.js';
import { closedBy, collectDeletionImpact, type DeletionClosed } from './account-deletion.impact.js';
import { reauthenticate, type ReauthUser } from './account-deletion.reauth.js';
import { toDeletionImpactDto } from './account-deletion.views.js';
import { eraseAccount, eraseCustomerData, eraseProfessionalData, type ErasedAccount } from './account-erasure.js';
import { findActiveAccount } from './account-lookup.js';
import { purgeUnseenRecords } from './account-purge.js';
import type { DeletionOrigin } from './emails/account-deleted-texts.js';
import { renderAccountDeletedEmail } from './emails/render-account-deleted-email.js';
import { accountGone } from './me.service.js';
import { NOT_DELETED, UserModel, type UserDoc } from './user.model.js';
import type { DeleteAccountInput } from './users.schemas.js';

type DeletionDeps = Pick<
  AppDeps,
  'env' | 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background' | 'storage' | 'cache' | 'google'
>;
type DeletingUser = ReauthUser & Pick<UserDoc, '_id' | 'role'>;

/** The account of `auth` unless it is gone (deleted, or never existed). */
async function loadDeletingUser(auth: AuthContext): Promise<DeletingUser> {
  const user = await UserModel.findOne({ _id: auth.userId, ...NOT_DELETED }, { role: 1, email: 1, passwordHash: 1, googleSub: 1 }).lean<DeletingUser>();
  if (!user) throw accountGone();
  return user;
}

export async function getDeletionImpact(auth: AuthContext): Promise<AccountDeletionImpact> {
  const user = await loadDeletingUser(auth);
  const impact = await collectDeletionImpact(user);
  return toDeletionImpactDto(impact, { password: Boolean(user.passwordHash), google: Boolean(user.googleSub) });
}

/** Filled in before launch (`assertLegalConfigured` requires it outside development). */
const OPERATOR_EMAIL: string = LEGAL_CONFIG.operator.email;

function contactEmail(): string {
  return OPERATOR_EMAIL || '[contact email — set in backend/src/config/legal.ts]';
}

async function sendConfirmation(deps: Pick<DeletionDeps, 'mailer'>, account: ErasedAccount, via: DeletionOrigin, closed: DeletionClosed): Promise<void> {
  await deps.mailer.send(
    renderAccountDeletedEmail({ to: account.email, firstName: account.firstName, language: account.language, via, closed, contactEmail: contactEmail() }),
  );
}

export type { DeletionOrigin };

export interface DeletionOptions {
  /**
   * Who asked, for the confirmation email: the holder in the app (`app`), the holder by email,
   * confirmed from the account's address (`email`), or nobody: the operator closed the account
   * under the Terms (`operator`).
   */
  via: DeletionOrigin;
  /** `false` deletes again after restoring an older backup: the holder was told the first time. */
  sendEmail?: boolean;
}

/**
 * The deletion itself, once it is certain the holder wants it (they proved it: `deleteAccount`; or
 * the operator checked their emailed request: `delete-account.ts`), or the operator closes the account.
 */
export async function deleteAccountNow(deps: DeletionDeps, user: Pick<UserDoc, '_id' | 'role'>, { via, sendEmail = true }: DeletionOptions): Promise<void> {
  const { erased, closed } = await withTransaction(deps.logger, async (tx) => {
    const now = deps.clock.now();
    const marked = await UserModel.updateOne({ _id: user._id, ...NOT_DELETED }, { $set: { deletedAt: now } }, { session: tx.session });
    if (marked.matchedCount === 0) throw accountGone();
    const impact = await collectDeletionImpact(user, tx.session);
    if (impact.role === 'customer') {
      for (const request of impact.requests) {
        await cancelRequestInTx(deps, request, { reason: 'account_deleted', comment: null, customerName: '' }, tx);
      }
      await eraseCustomerData(deps, user._id, tx);
    } else {
      for (const offer of impact.offers) await withdrawOfferInTx(deps, offer, { professionalName: '' }, tx);
      for (const job of impact.jobs) await cancelJobForDeletedProfessional(deps, job, now, tx);
      await eraseProfessionalData(deps, user._id, now, tx);
    }
    await purgeUnseenRecords(deps, user, tx);
    return { erased: await eraseAccount(deps, user._id, tx), closed: closedBy(impact) };
  });
  // The id only (nothing personal): what to delete again after restoring an older backup (OPERATIONS.md §9).
  deps.logger.info({ userId: user._id.toHexString(), role: user.role, via }, 'account deleted');
  if (sendEmail) deps.background.run('account-deleted-email', () => sendConfirmation(deps, erased, via, closed));
}

/** `POST /me/deletion` */
export async function deleteAccount(deps: DeletionDeps, auth: AuthContext, input: DeleteAccountInput, clientIp: string): Promise<void> {
  const user = await loadDeletingUser(auth);
  // Slow on purpose (argon2) or remote (Google): before the transaction, which it would hold open.
  await reauthenticate(deps, user, input, clientIp);
  await deleteAccountNow(deps, user, { via: 'app' });
}

/**
 * The operator's deletion of the account with this sign-in email (or this id: the `account deleted`
 * log lines name ids); `null` when there is none.
 */
export async function deleteAccountOf(deps: DeletionDeps, emailOrId: string, options: DeletionOptions): Promise<Pick<UserDoc, '_id' | 'role'> | null> {
  const user = await findActiveAccount<Pick<UserDoc, '_id' | 'role'>>(emailOrId, { role: 1 });
  if (user) await deleteAccountNow(deps, user, options);
  return user;
}
