/** Inserts the customers and professionals of the demo data set. */
import { APP_CONFIG } from '@/constants/app-config';
import type { ServiceLocation } from '@/types/domain';

import { createCustomerProfile, createProfessional, createUser } from '../factories';
import { streetCoordinates } from '../server/services/geo-service';
import { getPlace } from './places';
import { PROFESSIONALS, type ProfessionalSeed } from './professionals';
import type { SeedBuilder } from './seed-builder';
import { CUSTOMERS } from './users';

function professionalSeedById(id: string): ProfessionalSeed {
  const seed = PROFESSIONALS.find((professional) => professional.id === id);
  if (!seed) throw new Error(`Unknown professional seed "${id}"`);
  return seed;
}

/** Display (business) name of a seeded professional. */
export function proName(id: string): string {
  return professionalSeedById(id).businessName;
}

export function seedPeople(b: SeedBuilder): void {
  const { t } = b;

  for (const customer of CUSTOMERS) {
    const createdAt = t.daysAgo(customer.memberSinceDaysAgo);
    const home: ServiceLocation = b.location(
      customer.home.placeId,
      customer.home.streetIndex,
      customer.home.houseNumber,
      customer.home.details,
    );
    b.db.users.insert(
      createUser({
        id: customer.id,
        role: 'customer',
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: `${customer.firstName}.${customer.lastName}@example.com`.toLowerCase(),
        phone: customer.phone,
        avatarUrl: customer.avatarUrl,
        createdAt,
        isDemo: customer.isDemo,
        demoDescription: customer.demoDescription,
      }),
    );
    b.db.customerProfiles.insert(createCustomerProfile({ userId: customer.id, defaultLocation: home, updatedAt: createdAt }));
  }

  for (const seed of PROFESSIONALS) {
    const memberSince = t.daysAgo(seed.memberSinceDaysAgo);
    const fullName = `${seed.firstName} ${seed.lastName}`;
    const place = getPlace(seed.base.placeId);
    const baseLocation = b.location(seed.base.placeId, seed.base.streetIndex, seed.base.houseNumber);
    b.db.users.insert(
      createUser({
        id: seed.id,
        role: 'professional',
        firstName: seed.firstName,
        lastName: seed.lastName,
        displayName: seed.businessName,
        email: seed.email,
        phone: seed.phone,
        avatarUrl: seed.avatarUrl,
        createdAt: memberSince,
        isDemo: seed.isDemo,
        demoDescription: seed.demoDescription,
      }),
    );
    b.db.professionals.insert(
      createProfessional({
        id: seed.id,
        userId: seed.id,
        fullName,
        displayName: seed.businessName,
        avatarUrl: seed.avatarUrl,
        headline: seed.headline,
        bio: seed.bio,
        categoryIds: [...seed.categoryIds],
        yearsOfExperience: seed.yearsOfExperience,
        serviceArea: {
          center: streetCoordinates(place, seed.base.streetIndex, seed.base.houseNumber),
          radiusKm: seed.radiusKm,
          label: place.city.en,
        },
        baseLocation,
        availability: seed.availability,
        contact: { phone: seed.phone, email: seed.email, website: seed.website },
        business: {
          businessName: seed.businessName,
          licenseNumber: seed.licenseNumber,
          isInsured: seed.isInsured,
          languages: [...seed.languages],
        },
        startingPrice: seed.startingPrice === null ? null : { amount: seed.startingPrice, currency: APP_CONFIG.defaultCurrency },
        isVerified: seed.isVerified,
        memberSince,
        updatedAt: memberSince,
      }),
    );
  }
}
