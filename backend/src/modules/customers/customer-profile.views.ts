/** `CustomerProfile` DTO (`/me`, `GET/PATCH /customer/profile`). */
import type { Types } from 'mongoose';

import { toServiceLocation } from '../../infra/schema-parts.js';
import type { CustomerProfile } from '../../shared/contract/index.js';
import { JobModel } from '../jobs/job.model.js';
import { RequestModel } from '../requests/request.model.js';
import type { UserDoc } from '../users/user.model.js';

export type CustomerStats = CustomerProfile['stats'];

/** Published requests and completed jobs of a customer (two indexed counts). */
export async function loadCustomerStats(customerId: Types.ObjectId): Promise<CustomerStats> {
  const [requestsCount, completedJobsCount] = await Promise.all([
    RequestModel.countDocuments({ customer: customerId, status: { $ne: 'draft' } }),
    JobModel.countDocuments({ customer: customerId, status: 'completed' }),
  ]);
  return { requestsCount, completedJobsCount };
}

export function toCustomerProfileDto(
  user: Pick<UserDoc, '_id' | 'defaultLocation' | 'notificationPreferences' | 'updatedAt'>,
  stats: CustomerStats,
): CustomerProfile {
  return {
    userId: user._id.toHexString(),
    defaultLocation: user.defaultLocation ? toServiceLocation(user.defaultLocation) : null,
    // Saved addresses are not a feature of the app (the type is reserved); always empty.
    savedLocations: [],
    notificationPreferences: user.notificationPreferences,
    stats,
    updatedAt: user.updatedAt.toISOString(),
  };
}
