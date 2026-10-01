/**
 * Professional DTO mappers shared by several modules (summaries in offers/jobs/search, profiles in
 * `/me` and `/professional(s)/*`). Privacy (`views.ts` of the mock backend): public views get an
 * approximate base location and service-area center, no personal name (customers see the display
 * name), and the contact only when the viewer hired the professional; the own profile is complete.
 */
import type { Types } from 'mongoose';

import { toServiceLocation } from '../../infra/schema-parts.js';
import { loadByIds } from '../../lib/batch.js';
import { approximateLocation, fromGeoPoint } from '../../lib/geo.js';
import { uniqueIds } from '../../lib/ids.js';
import { fullName } from '../../lib/text.js';
import type {
  OwnProfessionalProfile,
  ProfessionalProfile,
  ProfessionalSummary,
  ServiceArea,
} from '../../shared/contract/index.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { ProfessionalModel, type ProfessionalDoc } from './professional.model.js';

type ProfileUser = Pick<UserDoc, '_id' | 'firstName' | 'lastName' | 'avatar' | 'notificationPreferences'>;
type SummaryUser = Pick<UserDoc, '_id' | 'avatar'>;
type SummaryProfessional = Pick<
  ProfessionalDoc,
  '_id' | 'displayName' | 'headline' | 'categoryIds' | 'yearsOfExperience' | 'stats' | 'isVerified' | 'baseLocation' | 'serviceArea' | 'deletedAt'
>;

export const PROFESSIONAL_SUMMARY_PROJECTION = {
  displayName: 1,
  headline: 1,
  categoryIds: 1,
  yearsOfExperience: 1,
  stats: 1,
  isVerified: 1,
  'baseLocation.city': 1,
  'serviceArea.label': 1,
  deletedAt: 1,
} as const;

function professionalCity(pro: Pick<ProfessionalDoc, 'baseLocation' | 'serviceArea'>): string {
  return pro.baseLocation?.city ?? pro.serviceArea.label;
}

export function toProfessionalSummary(pro: SummaryProfessional, user: SummaryUser | undefined): ProfessionalSummary {
  return {
    id: pro._id.toHexString(),
    displayName: pro.displayName,
    avatarUrl: user?.avatar?.url ?? null,
    headline: pro.headline,
    categoryIds: [...pro.categoryIds],
    yearsOfExperience: pro.yearsOfExperience,
    averageRating: pro.stats.averageRating,
    reviewCount: pro.stats.reviewCount,
    completedJobsCount: pro.stats.completedJobsCount,
    isVerified: pro.isVerified,
    city: professionalCity(pro),
    // The tombstone's display name is already `DELETED_USER_NAME`.
    accountDeleted: Boolean(pro.deletedAt),
  };
}

/** Summaries for a page of items: one professionals query + one users query (avatars). */
export async function loadProfessionalSummaries(professionalIds: Iterable<Types.ObjectId>): Promise<Map<string, ProfessionalSummary>> {
  const ids = uniqueIds(professionalIds);
  const [professionals, users] = await Promise.all([
    loadByIds<ProfessionalDoc, SummaryProfessional>(ProfessionalModel, ids, PROFESSIONAL_SUMMARY_PROJECTION),
    loadByIds<UserDoc, SummaryUser>(UserModel, ids, { avatar: 1 }),
  ]);
  return new Map([...professionals].map(([id, pro]) => [id, toProfessionalSummary(pro, users.get(id))]));
}

function serviceAreaOf(pro: ProfessionalDoc): ServiceArea {
  return { center: fromGeoPoint(pro.serviceArea.center), radiusKm: pro.serviceArea.radiusKm, label: pro.serviceArea.label };
}

function baseProfile(pro: ProfessionalDoc, user: ProfileUser): OwnProfessionalProfile {
  return {
    id: pro._id.toHexString(),
    userId: user._id.toHexString(),
    fullName: fullName(user),
    displayName: pro.displayName,
    avatarUrl: user.avatar?.url ?? null,
    headline: pro.headline,
    bio: pro.bio,
    categoryIds: [...pro.categoryIds],
    yearsOfExperience: pro.yearsOfExperience,
    serviceArea: serviceAreaOf(pro),
    baseLocation: pro.baseLocation ? toServiceLocation(pro.baseLocation) : null,
    availability: pro.availability,
    contact: pro.contact,
    business: pro.business,
    stats: {
      averageRating: pro.stats.averageRating,
      reviewCount: pro.stats.reviewCount,
      completedJobsCount: pro.stats.completedJobsCount,
      responseTimeMinutes: pro.stats.responseTimeMinutes,
    },
    startingPrice: pro.startingPrice,
    isVerified: pro.isVerified,
    memberSince: pro.createdAt.toISOString(),
    updatedAt: pro.updatedAt.toISOString(),
    notificationPreferences: user.notificationPreferences,
  };
}

/** The professional's own, complete profile (`GET/PATCH /professional/profile`, `/me`). */
export function toOwnProfessionalProfile(pro: ProfessionalDoc, user: ProfileUser): OwnProfessionalProfile {
  return baseProfile(pro, user);
}

/**
 * Public profile as a viewer sees it (never the personal name nor the notification settings).
 * `isOwner`: the professional themself (exact data); `hiredByViewer`: the viewer is a customer who
 * hired them (`public-profile.service.ts`).
 */
export function toPublicProfessionalProfile(
  pro: ProfessionalDoc,
  user: ProfileUser,
  viewer: { isOwner: boolean; hiredByViewer: boolean },
): ProfessionalProfile {
  const { notificationPreferences: _preferences, fullName: _fullName, ...profile } = baseProfile(pro, user);
  if (viewer.isOwner) return profile;
  // The stored approximate center for both points: the base is the area's center (the app moves
  // the center with the base), and a stored point never moves unless the professional moves it.
  return {
    ...profile,
    serviceArea: { ...profile.serviceArea, center: fromGeoPoint(pro.serviceArea.publicCenter) },
    baseLocation: profile.baseLocation ? approximateLocation(profile.baseLocation, pro.serviceArea.publicCenter) : null,
    contact: viewer.hiredByViewer ? profile.contact : null,
  };
}
