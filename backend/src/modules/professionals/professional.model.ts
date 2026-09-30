/**
 * `professionals`: the public business profile of a professional user. 1:1 with `users` and
 * sharing its `_id` (the professional id IS the user id, as in the app's data), so resolving
 * "the professional's user" or "the user's profile" never needs a lookup. The personal name,
 * avatar and notification preferences stay on the user document.
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { geoPointSchema, locationSchema, type LocationDoc } from '../../infra/schema-parts.js';
import { approximateCoordinates, fromGeoPoint, toGeoPoint, type GeoPoint } from '../../lib/geo.js';
import { CATEGORY_IDS, type CategoryId } from '../../shared/catalog/index.js';
import type {
  Money,
  ProfessionalBusinessInfo,
  ProfessionalContact,
  ProfessionalStats,
  WeeklyAvailability,
} from '../../shared/contract/index.js';
import { SUPPORTED_CURRENCIES, WEEKDAYS } from '../../shared/domain.js';
import { emptyRatingCounts, RATING_PRIOR } from './professional-rank.js';

export interface ServiceAreaDoc {
  /** The professional's own point (their sign-up base address by default): matching and their explorer measure from here. */
  center: GeoPoint;
  /**
   * The approximate center everyone else sees (`approximateCoordinates(center, id)`, what the
   * public profile shows). Stored and indexed because customer-facing searches, sorting and
   * distances use it: a query on the exact center, even one answering only "covered or not", lets
   * a caller probe the circle's edge and pin down the hidden address.
   */
  publicCenter: GeoPoint;
  radiusKm: number;
  label: string;
}

/**
 * Aggregates maintained on write so profile, search and review-list reads never aggregate:
 * `ratingCounts` (reviews per star, incremented on review creation: the reviews list breakdown and
 * the source of `averageRating`/`reviewCount`), `completedJobsCount` on job completion,
 * `responseTimeMinutes` (median minutes from publication to offer) after offer submission.
 * `rankScore` is the Bayesian rating used as the search sort key (updated with the rating).
 */
export interface ProfessionalStatsDoc extends ProfessionalStats {
  /** `ratingCounts[rating - 1]` = number of reviews with that rating. */
  ratingCounts: number[];
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
  /**
   * The account was deleted: a tombstone ("Deleted user", no categories, contact, business or exact
   * base) kept for the customers' offers, jobs and reviews; left out of every search and match.
   */
  deletedAt?: Date;
  /** createdAt = `memberSince`. */
  createdAt: Date;
  updatedAt: Date;
}

function createDefaultAvailability(): WeeklyAvailability {
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
          publicCenter: { type: geoPointSchema, required: true },
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
          ratingCounts: { type: [Number], default: emptyRatingCounts },
          rankScore: { type: Number, default: RATING_PRIOR.mean },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    deletedAt: { type: Date },
  },
  { timestamps: modelTimestamps(), versionKey: false },
);

/** The approximate service-area center of professional `id` (same offset as the public profile's). */
export function professionalPublicCenter(center: GeoPoint, id: Types.ObjectId): GeoPoint {
  return toGeoPoint(approximateCoordinates(fromGeoPoint(center), id.toHexString()));
}

// Created or moved service areas get their public center (`$set` updates set it themselves).
professionalSchema.pre('validate', function setPublicCenter() {
  if (this.isNew || this.isModified('serviceArea')) this.serviceArea.publicCenter = professionalPublicCenter(this.serviceArea.center, this._id);
});

// Request matching: professionals of a category whose radius is in a bucket, near the request's
// pin, measured from their own center ($geoNear per radius bucket, see service-area-coverage.ts).
professionalSchema.index({ categoryIds: 1, 'serviceArea.radiusKm': 1, 'serviceArea.center': '2dsphere' });
// `GET /professionals?categoryId&lat&lng`: the same buckets on the public center.
professionalSchema.index({ categoryIds: 1, 'serviceArea.radiusKm': 1, 'serviceArea.publicCenter': '2dsphere' });
// `GET /professionals?lat&lng` without a category (its $geoNear has no category to bound).
professionalSchema.index({ 'serviceArea.publicCenter': '2dsphere', categoryIds: 1 });
// GET /professionals?categoryId= (keyset: best ranked first, see professional-search.service.ts).
professionalSchema.index({ categoryIds: 1, 'stats.rankScore': -1, 'stats.reviewCount': -1, _id: 1 });
// GET /professionals without a category (same order).
professionalSchema.index({ 'stats.rankScore': -1, 'stats.reviewCount': -1, _id: 1 });

export const ProfessionalModel = model<ProfessionalDoc>('Professional', professionalSchema);
