/** PATCH payload → stored fields (only the fields the caller sent change). */
import { toLocationDoc } from '../../infra/schema-parts.js';
import { toGeoPoint } from '../../lib/geo.js';
import type { UserDoc } from '../users/user.model.js';
import type { ProfessionalDoc } from './professional.model.js';
import type { UpdateProfessionalProfileInput } from './professionals.schemas.js';

/** Drops `undefined` values (absent from the PATCH); `null` is kept (it clears a field). */
export function definedFields<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** "Avi Ben David" → first "Avi", last "Ben David" (as the app's reference backend). */
export function splitFullName(fullName: string): Pick<UserDoc, 'firstName' | 'lastName'> {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

export function professionalChanges(input: UpdateProfessionalProfileInput): Partial<ProfessionalDoc> {
  const { serviceArea, baseLocation } = input;
  return definedFields<Partial<ProfessionalDoc>>({
    displayName: input.displayName,
    headline: input.headline,
    bio: input.bio,
    categoryIds: input.categoryIds,
    yearsOfExperience: input.yearsOfExperience,
    serviceArea: serviceArea && { center: toGeoPoint(serviceArea.center), radiusKm: serviceArea.radiusKm, label: serviceArea.label },
    baseLocation: baseLocation === undefined ? undefined : baseLocation && toLocationDoc(baseLocation),
    availability: input.availability,
    contact: input.contact,
    business: input.business,
    startingPrice: input.startingPrice,
  });
}

/**
 * Account fields a professional PATCH changes: the name, the notification settings and the phone
 * (the contact phone doubles as the account phone; the contact email never changes the sign-in
 * email). The avatar is handled separately (upload claim).
 */
export function accountChanges(input: UpdateProfessionalProfileInput): Partial<UserDoc> {
  return definedFields<Partial<UserDoc>>({
    ...(input.fullName !== undefined ? splitFullName(input.fullName) : {}),
    phone: input.contact?.phone,
    notificationPreferences: input.notificationPreferences,
  });
}
