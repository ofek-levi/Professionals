/**
 * `GET /professionals/:id`: the public profile as the viewer may see it (privacy rules of the
 * app's reference backend): approximate base and service-area center for everyone but the owner;
 * the contact only for customers who hired the professional (a job with them that was not
 * cancelled: what the sign-up promises, "only customers who hire you see your phone and email").
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { ProfessionalContact, ProfessionalProfile } from '../../shared/contract/index.js';
import type { JobStatus } from '../../shared/statuses.js';
import { JobModel } from '../jobs/job.model.js';
import { ProfessionalModel, type ProfessionalDoc } from './professional.model.js';
import { cachedPublicProfile } from './professional-cache.js';
import { toPublicProfessionalProfile } from './professional.views.js';
import { loadProfessionalProfile } from './own-profile.service.js';

/** Jobs through which a customer hired the professional: every status but `cancelled`. */
const HIRED_JOB_STATUSES: JobStatus[] = ['awaiting_confirmation', 'scheduled', 'in_progress', 'completed'];

async function hasHired(customerId: Types.ObjectId, professionalId: Types.ObjectId): Promise<boolean> {
  const hired = await JobModel.exists({ customer: customerId, professional: professionalId, status: { $in: HIRED_JOB_STATUSES } });
  return hired !== null;
}

async function loadContact(professionalId: Types.ObjectId): Promise<ProfessionalContact | null> {
  const pro = await ProfessionalModel.findById(professionalId, { contact: 1 }).lean<Pick<ProfessionalDoc, 'contact'>>();
  return pro?.contact ?? null;
}

export async function getPublicProfessionalProfile(
  deps: Pick<AppDeps, 'cache'>,
  viewer: AuthContext,
  professionalId: Types.ObjectId,
): Promise<ProfessionalProfile> {
  if (viewer.userId.equals(professionalId)) {
    const own = await loadProfessionalProfile(professionalId);
    if (!own) throw ApiError.notFound('Professional');
    return toPublicProfessionalProfile(own.pro, own.user, { isOwner: true, hiredByViewer: false });
  }
  const [profile, hired] = await Promise.all([
    cachedPublicProfile(deps, professionalId, async () => {
      const loaded = await loadProfessionalProfile(professionalId);
      return loaded ? toPublicProfessionalProfile(loaded.pro, loaded.user, { isOwner: false, hiredByViewer: false }) : null;
    }),
    viewer.role === 'customer' ? hasHired(viewer.userId, professionalId) : Promise.resolve(false),
  ]);
  if (!profile) throw ApiError.notFound('Professional');
  return hired ? { ...profile, contact: await loadContact(professionalId) } : profile;
}
