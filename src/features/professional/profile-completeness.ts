/**
 * Profile completeness meter for the professional account screen: a weighted checklist of the
 * things customers look at when comparing offers. Pure, so it can be unit tested.
 */
import { hasAnyWorkingDay } from '@/features/profiles/availability';
import { PROFILE_LIMITS } from '@/lib/validation';
import type { ProfessionalProfile } from '@/types/domain';

export const COMPLETENESS_ITEMS = [
  'photo',
  'bio',
  'categories',
  'headline',
  'baseLocation',
  'availability',
  'license',
  'insurance',
  'startingPrice',
  'website',
] as const;
export type CompletenessItem = (typeof COMPLETENESS_ITEMS)[number];

/** Weights sum to 100; the order above is also the "what to do next" priority. */
export const COMPLETENESS_WEIGHTS: Record<CompletenessItem, number> = {
  photo: 15,
  bio: 15,
  categories: 15,
  headline: 10,
  baseLocation: 10,
  availability: 10,
  license: 10,
  insurance: 5,
  startingPrice: 5,
  website: 5,
};

/** A headline shorter than this is treated as a placeholder. */
export const MIN_USEFUL_HEADLINE_LENGTH = 10;

type CompletenessInput = Pick<
  ProfessionalProfile,
  'avatarUrl' | 'headline' | 'bio' | 'categoryIds' | 'baseLocation' | 'availability' | 'business' | 'startingPrice' | 'contact'
>;

const CHECKS: Record<CompletenessItem, (profile: CompletenessInput) => boolean> = {
  photo: (profile) => Boolean(profile.avatarUrl),
  bio: (profile) => profile.bio.trim().length >= PROFILE_LIMITS.bioMin,
  categories: (profile) => profile.categoryIds.length > 0,
  headline: (profile) => profile.headline.trim().length >= MIN_USEFUL_HEADLINE_LENGTH,
  baseLocation: (profile) => profile.baseLocation !== null,
  availability: (profile) => hasAnyWorkingDay(profile.availability),
  license: (profile) => Boolean(profile.business.licenseNumber?.trim()),
  insurance: (profile) => profile.business.isInsured,
  startingPrice: (profile) => profile.startingPrice !== null,
  website: (profile) => Boolean(profile.contact.website?.trim()),
};

export interface ProfileCompleteness {
  /** 0–100, rounded. */
  percent: number;
  completed: CompletenessItem[];
  /** Missing items, most valuable first. */
  missing: CompletenessItem[];
  isComplete: boolean;
}

export function computeProfileCompleteness(profile: CompletenessInput): ProfileCompleteness {
  const completed: CompletenessItem[] = [];
  const missing: CompletenessItem[] = [];
  let score = 0;
  for (const item of COMPLETENESS_ITEMS) {
    if (CHECKS[item](profile)) {
      completed.push(item);
      score += COMPLETENESS_WEIGHTS[item];
    } else {
      missing.push(item);
    }
  }
  missing.sort((a, b) => COMPLETENESS_WEIGHTS[b] - COMPLETENESS_WEIGHTS[a]);
  const percent = Math.round(Math.min(100, Math.max(0, score)));
  return { percent, completed, missing, isComplete: missing.length === 0 };
}
