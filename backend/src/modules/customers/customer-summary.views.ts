/**
 * `CustomerSummary` (what professionals see about a customer) for a page of items: one users
 * query + one aggregation for completed-job counts, whatever the page size. Nothing of the
 * customer's default address (often their home) is part of it: requests carry their own city.
 */
import type { Types } from 'mongoose';

import { loadByIds } from '../../lib/batch.js';
import { uniqueIds } from '../../lib/ids.js';
import { customerShortName, DELETED_USER_NAME } from '../../lib/text.js';
import type { CustomerSummary } from '../../shared/contract/index.js';
import { JobModel } from '../jobs/job.model.js';
import { UserModel, type UserDoc } from '../users/user.model.js';

type SummaryUser = Pick<UserDoc, '_id' | 'firstName' | 'lastName' | 'avatar' | 'createdAt' | 'deletedAt'>;

/** Completed jobs per customer (served by the `jobs` {customer, status, …} index). */
async function completedJobCounts(customerIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();
  const rows = await JobModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { customer: { $in: customerIds }, status: 'completed' } },
    { $group: { _id: '$customer', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toHexString(), row.count]));
}

function toCustomerSummary(user: SummaryUser, completedJobsCount: number): CustomerSummary {
  return {
    id: user._id.toHexString(),
    displayName: user.deletedAt ? DELETED_USER_NAME : customerShortName(user),
    avatarUrl: user.avatar?.url ?? null,
    memberSince: user.createdAt.toISOString(),
    completedJobsCount,
    accountDeleted: Boolean(user.deletedAt),
  };
}

export async function loadCustomerSummaries(customerIds: Iterable<Types.ObjectId>): Promise<Map<string, CustomerSummary>> {
  const ids = uniqueIds(customerIds);
  const [users, counts] = await Promise.all([
    loadByIds<UserDoc, SummaryUser>(UserModel, ids, { firstName: 1, lastName: 1, avatar: 1, createdAt: 1, deletedAt: 1 }),
    completedJobCounts(ids),
  ]);
  return new Map([...users].map(([id, user]) => [id, toCustomerSummary(user, counts.get(id) ?? 0)]));
}
