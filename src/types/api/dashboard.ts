import type {
  AppNotification,
  CustomerRequestView,
  JobSummary,
  OfferWithRequest,
  ProfessionalRequestView,
} from '../domain';

/** `GET /customer/dashboard` */
export interface CustomerDashboard {
  openRequestsCount: number;
  requestsWithOffersCount: number;
  pendingOffersCount: number;
  activeJobsCount: number;
  /** Most recently updated requests (max 5). */
  recentRequests: CustomerRequestView[];
  /** Next scheduled/active jobs (max 3). */
  upcomingJobs: JobSummary[];
  /** Jobs completed without a review yet. */
  jobsAwaitingReview: JobSummary[];
}

/** `GET /professional/dashboard` */
export interface ProfessionalDashboard {
  nearbyOpenRequestsCount: number;
  /** Newest matching requests (max 5). */
  newRequests: ProfessionalRequestView[];
  pendingOffersCount: number;
  pendingOffers: OfferWithRequest[];
  activeJobsCount: number;
  upcomingAppointments: JobSummary[];
  recentNotifications: AppNotification[];
  earningsThisMonth: { amount: number; currency: string };
  completedJobsCount: number;
}
