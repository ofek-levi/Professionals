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
 *     session is revoked.
 * After the commit: images are deleted from storage, and a confirmation goes to the address the
 * account had (best effort). The operator deletes an account the same way when its holder asks by
 * email (`deleteAccountOf`, run by `src/delete-account.ts`).
 */
import { Types } from 'mongoose';

import { LEGAL_CONFIG } from '../../config/legal.js';
import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { isObjectIdString } from '../../lib/ids.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { AccountDeletionImpact } from '../../shared/contract/index.js';
import { cancelJobForDeletedProfessional } from '../jobs/job-lifecycle.service.js';
import { withdrawOfferInTx } from '../offers/offer-changes.service.js';
import { cancelRequestInTx } from '../requests/request-cancel.service.js';
import { collectDeletionImpact } from './account-deletion.impact.js';
import { reauthenticate, type ReauthUser } from './account-deletion.reauth.js';
import { toDeletionImpactDto } from './account-deletion.views.js';
import { eraseAccount, eraseCustomerData, eraseProfessionalData, type ErasedAccount } from './account-erasure.js';
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

async function sendConfirmation(deps: Pick<DeletionDeps, 'mailer'>, account: ErasedAccount): Promise<void> {
  await deps.mailer.send(renderAccountDeletedEmail({ to: account.email, firstName: account.firstName, language: account.language, contactEmail: contactEmail() }));
}

/**
 * The deletion itself, once it is certain the holder wants it: they proved it (`deleteAccount`), or
 * the operator checked a request emailed from the account's address (`delete-account.ts`).
 */
export async function deleteAccountNow(deps: DeletionDeps, user: Pick<UserDoc, '_id' | 'role'>): Promise<void> {
  const erased = await withTransaction(deps.logger, async (tx) => {
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
    return eraseAccount(deps, user._id, tx);
  });
  // The id only (nothing personal): what to delete again after restoring an older backup (OPERATIONS.md §9).
  deps.logger.info({ userId: user._id.toHexString(), role: user.role }, 'account deleted');
  deps.background.run('account-deleted-email', () => sendConfirmation(deps, erased));
}

/** `POST /me/deletion` */
export async function deleteAccount(deps: DeletionDeps, auth: AuthContext, input: DeleteAccountInput, clientIp: string): Promise<void> {
  const user = await loadDeletingUser(auth);
  // Slow on purpose (argon2) or remote (Google): before the transaction, which it would hold open.
  await reauthenticate(deps, user, input, clientIp);
  await deleteAccountNow(deps, user);
}

/**
 * The operator's deletion of the account with this sign-in email (or this id: the `account deleted`
 * log lines name ids); `null` when there is none.
 */
export async function deleteAccountOf(deps: DeletionDeps, emailOrId: string): Promise<Pick<UserDoc, '_id' | 'role'> | null> {
  const key = emailOrId.trim();
  // `isObjectIdString` guards `string`, which leaves `key` typed `never` in the email branch.
  const which = isObjectIdString(key) ? { _id: new Types.ObjectId(key) } : { email: emailOrId.trim().toLowerCase() };
  const user = await UserModel.findOne({ ...which, ...NOT_DELETED }, { role: 1 }).lean<Pick<UserDoc, '_id' | 'role'>>();
  if (user) await deleteAccountNow(deps, user);
  return user;
}
