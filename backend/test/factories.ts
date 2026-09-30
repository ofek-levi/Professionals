/**
 * Test data builders. They insert documents directly (bypassing services) with sensible defaults
 * around Tel Aviv; pass overrides for what a test cares about. Timestamps follow the model clock
 * (`createTestApp` installs its FakeClock), so create the app before calling factories.
 */
import { Types } from 'mongoose';

import { SessionModel, type SessionDoc } from '../src/modules/auth/session.model.js';
import { ensureConversationForJob } from '../src/modules/conversations/conversation-lifecycle.service.js';
import { JobModel, type JobDoc } from '../src/modules/jobs/job.model.js';
import { OfferModel, type OfferDoc } from '../src/modules/offers/offer.model.js';
import { ProfessionalModel, type ProfessionalDoc } from '../src/modules/professionals/professional.model.js';
import { RequestModel, type RequestDoc } from '../src/modules/requests/request.model.js';
import { UploadModel, type UploadDoc } from '../src/modules/uploads/upload.model.js';
import { DeviceModel, type DeviceDoc } from '../src/modules/users/device.model.js';
import { UserModel, type UserDoc } from '../src/modules/users/user.model.js';
import { modelNow } from '../src/infra/model-clock.js';
import { toLocationDoc, type LocationDoc } from '../src/infra/schema-parts.js';
import { toGeoPoint } from '../src/lib/geo.js';
import type { GeoCoordinates } from '../src/shared/contract/index.js';

let sequence = 0;
const next = () => ++sequence;

export const TEL_AVIV: GeoCoordinates = { latitude: 32.0853, longitude: 34.7818 };
export const RAMAT_GAN: GeoCoordinates = { latitude: 32.0823, longitude: 34.8131 };
export const HAIFA: GeoCoordinates = { latitude: 32.794, longitude: 34.9896 };

export function testLocation(coordinates: GeoCoordinates = TEL_AVIV, addressLine = 'Dizengoff St 120'): LocationDoc {
  return toLocationDoc({ coordinates, addressLine, city: 'Tel Aviv-Yafo', neighborhood: 'Old North', details: 'Floor 3' });
}

type Overrides<T> = Partial<Omit<T, '_id'>> & { _id?: Types.ObjectId };

export async function createCustomer(overrides: Overrides<UserDoc> = {}): Promise<UserDoc> {
  const n = next();
  const doc = await UserModel.create({
    email: `customer${n}@example.com`,
    role: 'customer',
    firstName: 'Noa',
    lastName: `Levi${n}`,
    phone: '050-123-4567',
    language: 'en',
    avatar: null,
    defaultLocation: testLocation(),
    ...overrides,
  });
  return doc.toObject<UserDoc>();
}

export interface TestProfessional {
  user: UserDoc;
  professional: ProfessionalDoc;
}

/** A professional user and profile sharing one `_id`, serving `categoryIds` around `center`. */
export async function createProfessional(
  options: { user?: Overrides<UserDoc>; professional?: Overrides<ProfessionalDoc>; center?: GeoCoordinates; radiusKm?: number } = {},
): Promise<TestProfessional> {
  const n = next();
  const _id = new Types.ObjectId();
  const user = await UserModel.create({
    _id,
    email: `pro${n}@example.com`,
    role: 'professional',
    firstName: 'Avi',
    lastName: `Cohen${n}`,
    phone: '052-765-4321',
    language: 'he',
    avatar: null,
    defaultLocation: null,
    ...options.user,
  });
  const center = options.center ?? TEL_AVIV;
  const professional = await ProfessionalModel.create({
    _id,
    displayName: `Avi Fix ${n}`,
    headline: 'Fast and tidy',
    bio: '',
    categoryIds: ['plumbing', 'handyman'],
    yearsOfExperience: 8,
    serviceArea: { center: toGeoPoint(center), radiusKm: options.radiusKm ?? 20, label: 'Tel Aviv-Yafo' },
    baseLocation: testLocation(center, 'Ibn Gabirol St 50'),
    contact: { phone: '052-765-4321', email: `pro${n}.contact@example.com`, website: null },
    business: { businessName: null, licenseNumber: null, isInsured: false, languages: ['he'] },
    ...options.professional,
  });
  return { user: user.toObject<UserDoc>(), professional: professional.toObject<ProfessionalDoc>() };
}

export async function createRequest(customer: Pick<UserDoc, '_id'>, overrides: Overrides<RequestDoc> = {}): Promise<RequestDoc> {
  const doc = await RequestModel.create({
    customer: customer._id,
    categoryId: 'plumbing',
    description: 'The kitchen sink is leaking under the cabinet.',
    location: testLocation(),
    urgency: 'normal',
    preferredSchedule: null,
    photos: [],
    notes: 'Code 1234',
    status: 'open',
    publishedAt: modelNow(),
    ...overrides,
  });
  return doc.toObject<RequestDoc>();
}

export async function createOffer(
  request: Pick<RequestDoc, '_id'>,
  professional: Pick<ProfessionalDoc, '_id'>,
  overrides: Overrides<OfferDoc> = {},
): Promise<OfferDoc> {
  const now = modelNow().getTime();
  const inTwoDays = new Date(now + 2 * 24 * 60 * 60_000);
  const doc = await OfferModel.create({
    request: request._id,
    professional: professional._id,
    price: 350,
    currency: 'ILS',
    proposedStartAt: inTwoDays,
    estimatedDurationMinutes: 90,
    message: null,
    status: 'pending',
    expiresAt: new Date(now + 72 * 60 * 60_000),
    ...overrides,
  });
  return doc.toObject<OfferDoc>();
}

/** An accepted-offer job with its conversation (no status side effects on request/offer). */
export async function createJob(
  request: Pick<RequestDoc, '_id' | 'customer' | 'categoryId'>,
  offer: Pick<OfferDoc, '_id' | 'professional' | 'price' | 'currency' | 'proposedStartAt'>,
  overrides: Overrides<JobDoc> = {},
): Promise<JobDoc> {
  const jobId = overrides._id ?? new Types.ObjectId();
  const conversation = await ensureConversationForJob({
    jobId,
    requestId: request._id,
    categoryId: request.categoryId,
    customerUserId: request.customer,
    professionalUserId: offer.professional,
    now: modelNow(),
  });
  const doc = await JobModel.create({
    _id: jobId,
    request: request._id,
    offer: offer._id,
    customer: request.customer,
    professional: offer.professional,
    conversation,
    categoryId: request.categoryId,
    status: 'scheduled',
    scheduledStartAt: offer.proposedStartAt,
    estimatedDurationMinutes: 90,
    agreedPrice: offer.price,
    currency: offer.currency,
    ...overrides,
  });
  return doc.toObject<JobDoc>();
}

/** A live session of `user` (expires far in the future unless overridden). */
export async function createSession(user: Pick<UserDoc, '_id'>, overrides: Overrides<SessionDoc> = {}): Promise<SessionDoc> {
  const doc = await SessionModel.create({
    user: user._id,
    tokenHash: `hash-${next()}`,
    expiresAt: new Date('2100-01-01T00:00:00.000Z'),
    ...overrides,
  });
  return doc.toObject<SessionDoc>();
}

/** A push device registered by a new live session of `user` (or by `overrides.session`). */
export async function createDevice(user: Pick<UserDoc, '_id'>, overrides: Overrides<DeviceDoc> = {}): Promise<DeviceDoc> {
  const session = overrides.session ?? (await createSession(user))._id;
  const doc = await DeviceModel.create({
    user: user._id,
    session,
    token: `ExponentPushToken[test-${next()}]`,
    ...overrides,
  });
  return doc.toObject<DeviceDoc>();
}

export async function createUpload(owner: Pick<UserDoc, '_id'>, overrides: Overrides<UploadDoc> = {}): Promise<UploadDoc> {
  const n = next();
  const doc = await UploadModel.create({
    owner: owner._id,
    publicId: `test/requests/img-f${n}`,
    url: `https://images.test/test/requests/img-f${n}.jpg`,
    width: 800,
    height: 600,
    ...overrides,
  });
  return doc.toObject<UploadDoc>();
}
