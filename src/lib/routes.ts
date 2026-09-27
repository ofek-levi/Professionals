/**
 * Central route builder. Always navigate with these helpers instead of string literals so
 * deep links (notifications, push payloads) and screens agree on the URL structure.
 *
 * URL map (Expo Router, files under src/app):
 *   /sign-in                              demo account picker
 *   /customer/(home|requests|notifications|profile)             customer tabs
 *   /customer/requests?section=           My Requests opened on a section (CustomerRequestSection)
 *   /professional/(home|explore|offers|jobs|notifications|profile) professional tabs
 *   /requests/new?categoryId=             create request wizard (customer)
 *   /requests/:requestId                  request details (role aware)
 *   /requests/:requestId/offer?offerId=   submit / edit an offer (professional)
 *   /offers/:offerId                      offer details
 *   /professionals/:professionalId        public professional profile
 *   /professionals/:professionalId/reviews all reviews
 *   /jobs/:jobId                          job tracking (both roles)
 *   /jobs/:jobId/review                   leave a review (customer)
 *   /conversations                        conversation list
 *   /conversations/:conversationId        chat
 *   /profile/edit                         edit own profile (role aware)
 *   /settings                             language, theme, notifications, demo tools
 */
import type { Href } from 'expo-router';

import type { CategoryId } from '@/constants/professional-categories';
import type { CustomerRequestSection } from '@/constants/request-statuses';
import type { UserRole } from '@/types/domain';

const enc = encodeURIComponent;

/** Search param of the My Requests tab that preselects a section (`routes.customerRequests`). */
export const REQUESTS_SECTION_PARAM = 'section';

export const routes = {
  root: '/' as Href,
  signIn: '/sign-in' as Href,

  customer: {
    home: '/customer/home' as Href,
    requests: '/customer/requests' as Href,
    notifications: '/customer/notifications' as Href,
    profile: '/customer/profile' as Href,
  },

  professional: {
    home: '/professional/home' as Href,
    explore: '/professional/explore' as Href,
    offers: '/professional/offers' as Href,
    jobs: '/professional/jobs' as Href,
    notifications: '/professional/notifications' as Href,
    profile: '/professional/profile' as Href,
  },

  /** My Requests tab, optionally opened on a section (e.g. `'has_offers'`). */
  customerRequests: (section?: CustomerRequestSection | null): Href =>
    (section ? `/customer/requests?${REQUESTS_SECTION_PARAM}=${enc(section)}` : '/customer/requests') as Href,

  /** Home tab for a role. */
  homeFor: (role: UserRole): Href => (role === 'customer' ? '/customer/home' : '/professional/home'),
  notificationsFor: (role: UserRole): Href =>
    role === 'customer' ? '/customer/notifications' : '/professional/notifications',

  newRequest: (params: { categoryId?: CategoryId; draftId?: string } = {}): Href => {
    const query = [
      params.categoryId ? `categoryId=${enc(params.categoryId)}` : null,
      params.draftId ? `draftId=${enc(params.draftId)}` : null,
    ].filter(Boolean);
    return `/requests/new${query.length ? `?${query.join('&')}` : ''}` as Href;
  },
  request: (requestId: string): Href => `/requests/${enc(requestId)}` as Href,
  submitOffer: (requestId: string, offerId?: string): Href =>
    `/requests/${enc(requestId)}/offer${offerId ? `?offerId=${enc(offerId)}` : ''}` as Href,
  offer: (offerId: string): Href => `/offers/${enc(offerId)}` as Href,
  professionalProfile: (professionalId: string): Href => `/professionals/${enc(professionalId)}` as Href,
  professionalReviews: (professionalId: string): Href => `/professionals/${enc(professionalId)}/reviews` as Href,
  job: (jobId: string): Href => `/jobs/${enc(jobId)}` as Href,
  reviewJob: (jobId: string): Href => `/jobs/${enc(jobId)}/review` as Href,
  conversations: '/conversations' as Href,
  conversation: (conversationId: string): Href => `/conversations/${enc(conversationId)}` as Href,
  editProfile: '/profile/edit' as Href,
  settings: '/settings' as Href,
} as const;
