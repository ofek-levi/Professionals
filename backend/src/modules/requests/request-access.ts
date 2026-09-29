/** Loading requests with the authorization rules of the mock's `auth.ts` + handlers. */
import type { ClientSession, Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { customerShortName } from '../../lib/text.js';
import type { AuthContext } from '../../middleware/auth.js';
import { ProfessionalModel } from '../professionals/professional.model.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { RequestModel, type RequestDoc } from './request.model.js';

export async function loadRequest(requestId: Types.ObjectId, session?: ClientSession): Promise<RequestDoc> {
  const request = await RequestModel.findById(requestId).session(session ?? null).lean<RequestDoc>();
  if (!request) throw ApiError.notFound('Request');
  return request;
}

/** The caller's own request: missing → 404, someone else's → 403. */
export async function loadOwnedRequest(auth: AuthContext, requestId: Types.ObjectId, session?: ClientSession): Promise<RequestDoc> {
  const request = await loadRequest(requestId, session);
  if (!request.customer.equals(auth.userId)) throw ApiError.forbidden('This request belongs to another customer');
  return request;
}

/** How professionals see the customer in notifications ("Noa L."). */
export async function customerNameOf(customerId: Types.ObjectId, session?: ClientSession): Promise<string> {
  const user = await UserModel.findById(customerId, { firstName: 1, lastName: 1 })
    .session(session ?? null)
    .lean<Pick<UserDoc, 'firstName' | 'lastName'>>();
  return user ? customerShortName(user) : '';
}

/** The professional's public display name (notifications to customers). */
export async function professionalNameOf(professionalId: Types.ObjectId, session?: ClientSession): Promise<string> {
  const professional = await ProfessionalModel.findById(professionalId, { displayName: 1 }).session(session ?? null).lean();
  return professional?.displayName ?? '';
}
