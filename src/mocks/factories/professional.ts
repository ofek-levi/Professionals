import { APP_CONFIG } from '@/constants/app-config';
import { createDefaultAvailability } from '@/features/profiles/availability';
import type { OwnProfessionalProfile } from '@/types/domain';

import { DEFAULT_NOTIFICATION_PREFERENCES } from './user';

export type ProfessionalInput = Pick<
  OwnProfessionalProfile,
  'id' | 'userId' | 'fullName' | 'displayName' | 'categoryIds' | 'serviceArea' | 'memberSince'
> &
  Partial<OwnProfessionalProfile>;

/** Builds a professional profile with sensible defaults (stats are recomputed by the server). */
export function createProfessional(input: ProfessionalInput): OwnProfessionalProfile {
  return {
    avatarUrl: null,
    headline: '',
    bio: '',
    yearsOfExperience: 5,
    baseLocation: null,
    availability: createDefaultAvailability(),
    contact: { phone: '050-000-0000', email: `${input.id}@example.com`, website: null },
    business: { businessName: input.displayName, licenseNumber: null, isInsured: false, languages: ['he'] },
    stats: { averageRating: null, reviewCount: 0, completedJobsCount: 0, responseTimeMinutes: null },
    startingPrice: null,
    isVerified: false,
    updatedAt: input.memberSince,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    ...input,
  };
}

export const defaultStartingPrice = (amount: number) => ({ amount, currency: APP_CONFIG.defaultCurrency });
