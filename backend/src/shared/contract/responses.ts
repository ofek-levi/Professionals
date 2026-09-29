/** Composite response bodies of specific endpoints. */
import type { EntityId, ISODateTimeString } from './common.js';
import type { Job, JobSummary } from './job.js';
import type { AppNotification } from './notification.js';
import type { Offer, OfferWithRequest } from './offer.js';
import type { OwnProfessionalProfile } from './professional.js';
import type { CustomerRequestView, ProfessionalRequestView, ServiceRequest } from './request.js';
import type { CustomerProfile, User } from './user.js';

/**
 * Login / register / Google `signed_in`. Contract change vs the app's `AuthSession`
 * (`{accessToken, user}`): adds the access-token expiry and the rotating refresh token.
 */
export interface AuthSession {
  accessToken: string;
  accessTokenExpiresAt: ISODateTimeString;
  refreshToken: string;
  user: User;
}

/** `POST /auth/refresh` */
export interface RefreshResponse {
  accessToken: string;
  accessTokenExpiresAt: ISODateTimeString;
  refreshToken: string;
}

export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export type GoogleAuthResponse =
  | { status: 'signed_in'; session: AuthSession }
  | { status: 'registration_required'; profile: GoogleProfile };

export type CurrentUserResponse =
  | { user: User & { role: 'customer' }; customerProfile: CustomerProfile; professionalProfile: null }
  | { user: User & { role: 'professional' }; customerProfile: null; professionalProfile: OwnProfessionalProfile };

export type RequestDetailsResponse =
  | { viewerRole: 'customer'; request: CustomerRequestView }
  | { viewerRole: 'professional'; request: ProfessionalRequestView };

export interface AcceptOfferResponse {
  offer: Offer;
  request: ServiceRequest;
  job: Job;
}

export interface UploadedImage {
  id: EntityId;
  url: string;
  width: number | null;
  height: number | null;
}

export interface UnreadCountResponse {
  count: number;
}

export interface CustomerDashboard {
  openRequestsCount: number;
  requestsWithOffersCount: number;
  pendingOffersCount: number;
  activeJobsCount: number;
  recentRequests: CustomerRequestView[];
  upcomingJobs: JobSummary[];
  jobsAwaitingReview: JobSummary[];
}

export interface ProfessionalDashboard {
  nearbyOpenRequestsCount: number;
  newRequests: ProfessionalRequestView[];
  pendingOffersCount: number;
  pendingOffers: OfferWithRequest[];
  activeJobsCount: number;
  upcomingAppointments: JobSummary[];
  recentNotifications: AppNotification[];
  earningsThisMonth: { amount: number; currency: string };
  completedJobsCount: number;
}
