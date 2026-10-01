/**
 * Records nobody can see any more, deleted inside an account deletion's transaction (the Privacy
 * Policy and the account-deletion page promise it). What the other parties keep after a deletion is
 * kept for them; once every party to a record has deleted their account, it goes:
 * - requests no professional made an offer on (drafts too) go with the customer's own deletion
 *   (`deleteRequestsWithoutOffers`, from `eraseCustomerData`);
 * - when the other party of the account being deleted is deleted already (`purgeUnseenRecords`):
 *   their jobs with the reviews of those jobs, their chats with every message, the offers between
 *   them, and the deleted customer's requests left without an offer (a request with a job has its
 *   accepted offer, so it is never left without one while its job stays).
 * A request still holding an offer of a professional who has an account stays for them; its
 * accepted offer and job may then be gone, which none of their views reads. Photos are deleted from
 * storage after the commit. Nothing is announced: nobody is left to see it.
 */
import type { ClientSession, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { uniqueIds } from '../../lib/ids.js';
import type { UserRole } from '../../shared/domain.js';
import { ConversationModel, type ConversationParticipantDoc } from '../conversations/conversation.model.js';
import { MessageModel } from '../conversations/message.model.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { OfferModel, type OfferDoc } from '../offers/offer.model.js';
import { discardAfterCommit, publicIdsOf } from '../requests/request-photos.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { ReviewModel } from '../reviews/review.model.js';
import { UserModel, type UserDoc } from './user.model.js';

type PurgeDeps = Pick<AppDeps, 'storage' | 'logger' | 'background'>;

/** Every request of a customer, or the given ones. */
type RequestSelection = { customer: Types.ObjectId } | { _id: { $in: Types.ObjectId[] } };

/** An offer of the account being deleted, or on its request, with the other party of it. */
interface OfferWithCounterpart {
  _id: Types.ObjectId;
  request: Types.ObjectId;
  counterpart: Types.ObjectId;
}

/** Deletes the selected requests that have no offer, and their photos after the commit. */
export async function deleteRequestsWithoutOffers(deps: PurgeDeps, selection: RequestSelection, tx: Tx): Promise<void> {
  const { session } = tx;
  const requests = await RequestModel.find(selection, { photos: 1 }).session(session).lean<Pick<RequestDoc, '_id' | 'photos'>[]>();
  if (requests.length === 0) return;
  const offered = await OfferModel.distinct('request', { request: { $in: requests.map((request) => request._id) } }).session(session);
  const withOffers = new Set(offered.map((id: Types.ObjectId) => id.toHexString()));
  const unseen = requests.filter((request) => !withOffers.has(request._id.toHexString()));
  if (unseen.length === 0) return;
  await RequestModel.deleteMany({ _id: { $in: unseen.map((request) => request._id) } }, { session });
  discardAfterCommit(deps, tx, unseen.flatMap((request) => publicIdsOf(request.photos)));
}

/** Hex ids of the deleted accounts among `userIds`. */
async function deletedAmong(userIds: Types.ObjectId[], session: ClientSession): Promise<Set<string>> {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return new Set();
  const deleted = await UserModel.find({ _id: { $in: ids }, deletedAt: { $exists: true } }, { _id: 1 })
    .session(session)
    .lean<Pick<UserDoc, '_id'>[]>();
  return new Set(deleted.map((user) => user._id.toHexString()));
}

/** A customer's: the offers on their requests (from the professionals); a professional's: their offers (to the customers). */
async function offersWithCounterparts(user: Pick<UserDoc, '_id' | 'role'>, session: ClientSession): Promise<OfferWithCounterpart[]> {
  if (user.role === 'customer') {
    const requests = await RequestModel.find({ customer: user._id }, { _id: 1 }).session(session).lean<Pick<RequestDoc, '_id'>[]>();
    const offers = await OfferModel.find({ request: { $in: requests.map((request) => request._id) } }, { request: 1, professional: 1 })
      .session(session)
      .lean<Pick<OfferDoc, '_id' | 'request' | 'professional'>[]>();
    return offers.map((offer) => ({ _id: offer._id, request: offer.request, counterpart: offer.professional }));
  }
  const offers = await OfferModel.find({ professional: user._id }, { request: 1 }).session(session).lean<Pick<OfferDoc, '_id' | 'request'>[]>();
  const requests = await RequestModel.find({ _id: { $in: uniqueIds(offers.map((offer) => offer.request)) } }, { customer: 1 })
    .session(session)
    .lean<Pick<RequestDoc, '_id' | 'customer'>[]>();
  const customerOf = new Map(requests.map((request) => [request._id.toHexString(), request.customer]));
  return offers.flatMap((offer) => {
    const customer = customerOf.get(offer.request.toHexString());
    return customer ? [{ _id: offer._id, request: offer.request, counterpart: customer }] : [];
  });
}

/**
 * Deletes what `user` (marked deleted in `tx`, its data erased) shared only with accounts that are
 * deleted too. Nothing happens while every other party still has an account.
 */
export async function purgeUnseenRecords(deps: PurgeDeps, user: Pick<UserDoc, '_id' | 'role'>, tx: Tx): Promise<void> {
  const { session } = tx;
  const other: UserRole = user.role === 'customer' ? 'professional' : 'customer';
  const jobs = await JobModel.find({ [user.role]: user._id }, { customer: 1, professional: 1 })
    .session(session)
    .lean<Pick<JobDoc, '_id' | 'customer' | 'professional'>[]>();
  const offers = await offersWithCounterparts(user, session);
  const conversations = await ConversationModel.find({ 'participants.user': user._id }, { 'participants.user': 1 })
    .session(session)
    .lean<{ _id: Types.ObjectId; participants: Pick<ConversationParticipantDoc, 'user'>[] }[]>();
  const counterparts = [
    ...jobs.map((job) => job[other]),
    ...offers.map((offer) => offer.counterpart),
    ...conversations.flatMap((conversation) => conversation.participants.map((participant) => participant.user)),
  ].filter((id) => !id.equals(user._id));
  const gone = await deletedAmong(counterparts, session);
  if (gone.size === 0) return;
  const isGone = (userId: Types.ObjectId) => userId.equals(user._id) || gone.has(userId.toHexString());

  const unseenJobs = jobs.filter((job) => isGone(job[other])).map((job) => job._id);
  if (unseenJobs.length > 0) {
    await ReviewModel.deleteMany({ job: { $in: unseenJobs } }, { session });
    await JobModel.deleteMany({ _id: { $in: unseenJobs } }, { session });
  }
  const unseenChats = conversations.filter((conversation) => conversation.participants.every((participant) => isGone(participant.user)));
  if (unseenChats.length > 0) {
    const ids = unseenChats.map((conversation) => conversation._id);
    await MessageModel.deleteMany({ conversation: { $in: ids } }, { session });
    await ConversationModel.deleteMany({ _id: { $in: ids } }, { session });
  }
  const unseenOffers = offers.filter((offer) => isGone(offer.counterpart));
  if (unseenOffers.length === 0) return;
  await OfferModel.deleteMany({ _id: { $in: unseenOffers.map((offer) => offer._id) } }, { session });
  // The customer's requests, or the deleted customers' requests the professional made those offers on.
  const selection: RequestSelection =
    user.role === 'customer' ? { customer: user._id } : { _id: { $in: uniqueIds(unseenOffers.map((offer) => offer.request)) } };
  await deleteRequestsWithoutOffers(deps, selection, tx);
}
