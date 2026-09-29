/**
 * `professionals`: the public business profile of a professional user. 1:1 with `users` and
 * sharing its `_id` (the professional id IS the user id, as in the app's data), so resolving
 * "the professional's user" or "the user's profile" never needs a lookup. The personal name,
 * avatar and notification preferences stay on the user document.
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { geoPointSchema, locationSchema, type LocationDoc } from '../../infra/schema-parts.js';
import type { GeoPoint } from '../../lib/geo.js';
import { CATEGORY_IDS, type CategoryId } from '../../shared/catalog/index.js';
import type {
  Money,
  ProfessionalBusinessInfo,
  ProfessionalContact,
  ProfessionalStats,
  WeeklyAvailability,
} from '../../shared/contract/index.js';
import { SUPPORTED_CURRENCIES, WEEKDAYS } from '../../shared/domain.js';
import { RATING_PRIOR } from './professional-rank.js';

export interface ServiceAreaDoc {
  /** Matching is measured from here (GeoJSON, 2dsphere-indexed). */
  center: GeoPoint;
  radiusKm: number;
  label: string;
}

/**
 * Aggregates maintained on write so profile, search and summary reads never aggregate:
 * rating fields on review creation, `completedJobsCount` on job completion, `responseTimeMinutes`
 * (median minutes from publication to offer) on offer submission. `rankScore` is the Bayesian
 * rating used as the search sort key (updated with the rating).
 */
export interface ProfessionalStatsDoc extends ProfessionalStats {
  rankScore: number;
}

export interface ProfessionalDoc {
  /** Same value as the owner's `users._id`. */
  _id: Types.ObjectId;
  /** Business name when set, otherwise the full name (editable). */
  displayName: string;
  headline: string;
  bio: string;
  categoryIds: CategoryId[];
  yearsOfExperience: number;
  serviceArea: ServiceAreaDoc;
  baseLocation: LocationDoc | null;
  availability: WeeklyAvailability;
  /** Public contact details (not the sign-in email). */
  contact: ProfessionalContact;
  business: ProfessionalBusinessInfo;
  startingPrice: Money | null;
  isVerified: boolean;
  stats: ProfessionalStatsDoc;
  /** createdAt = `memberSince`. */
  createdAt: Date;
  updatedAt: Date;
}

export function createDefaultAvailability(): WeeklyAvailability {
  const workday = { enabled: true, start: '08:00', end: '18:00' };
  return {
    days: {
      sun: { ...workday },
      mon: { ...workday },
      tue: { ...workday },
      wed: { ...workday },
      thu: { ...workday },
      fri: { enabled: true, start: '08:00', end: '13:00' },
      sat: { enabled: false, start: '09:00', end: '17:00' },
    },
    acceptsEmergencyCalls: false,
  };
}

const daySchema = new Schema(
  { enabled: { type: Boolean, required: true }, start: { type: String, required: true }, end: { type: String, required: true } },
  { _id: false },
);

const availabilitySchema = new Schema<WeeklyAvailability>(
  {
    days: new Schema(Object.fromEntries(WEEKDAYS.map((day) => [day, { type: daySchema, required: true }])), { _id: false }),
    acceptsEmergencyCalls: { type: Boolean, required: true },
  },
  { _id: false },
);

const professionalSchema = new Schema<ProfessionalDoc>(
  {
    displayName: { type: String, required: true },
    headline: { type: String, default: '' },
    bio: { type: String, default: '' },
    categoryIds: { type: [String], enum: CATEGORY_IDS, required: true },
    yearsOfExperience: { type: Number, default: 0 },
    serviceArea: {
      type: new Schema<ServiceAreaDoc>(
        {
          center: { type: geoPointSchema, required: true },
          radiusKm: { type: Number, required: true },
          label: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    baseLocation: { type: locationSchema, default: null },
    availability: { type: availabilitySchema, required: true, default: createDefaultAvailability },
    contact: {
      type: new Schema<ProfessionalContact>(
        { phone: { type: String, required: true }, email: { type: String, required: true }, website: { type: String, default: null } },
        { _id: false },
      ),
      required: true,
    },
    business: {
      type: new Schema<ProfessionalBusinessInfo>(
        {
          businessName: { type: String, default: null },
          licenseNumber: { type: String, default: null },
          isInsured: { type: Boolean, default: false },
          languages: { type: [String], default: [] },
        },
        { _id: false },
      ),
      required: true,
    },
    startingPrice: {
      type: new Schema<Money>(
        { amount: { type: Number, required: true }, currency: { type: String, enum: SUPPORTED_CURRENCIES, required: true } },
        { _id: false },
      ),
      default: null,
    },
    isVerified: { type: Boolean, default: false },
    stats: {
      type: new Schema<ProfessionalStatsDoc>(
        {
          averageRating: { type: Number, default: null },
          reviewCount: { type: Number, default: 0 },
          completedJobsCount: { type: Number, default: 0 },
          responseTimeMinutes: { type: Number, default: null },
          rankScore: { type: Number, default: RATING_PRIOR.mean },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: modelTimestamps() },
);

// Matching: professionals whose service-area center is near a request point, by category
// ($geoNear from the request, then distance ≤ own radiusKm).
professionalSchema.index({ 'serviceArea.center': '2dsphere', categoryIds: 1 });
// GET /professionals?categoryId= (keyset: best ranked first, see professional-search.service.ts).
professionalSchema.index({ categoryIds: 1, 'stats.rankScore': -1, 'stats.reviewCount': -1, _id: 1 });
// GET /professionals without a category (same order).
professionalSchema.index({ 'stats.rankScore': -1, 'stats.reviewCount': -1, _id: 1 });

export const ProfessionalModel = model<ProfessionalDoc>('Professional', professionalSchema);
