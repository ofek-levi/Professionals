/**
 * Central route builder. Always navigate with these helpers instead of string literals so
 * deep links (notifications, push payloads) and screens agree on the URL structure.
 *
 * URL map (Expo Router, files under src/app):
 *   /sign-in                              entry: create account / sign in
 *   /auth/login                           email + password (or Google) sign-in
 *   /auth/sign-up?role=customer|professional  create account (step flow; role optional)
 *   /auth/forgot-password                 request a password reset link
 *   /customer/(home|requests|inbox|profile)                  customer tabs
 *   /customer/requests?tab=active|past    Requests tab segment
 *   /professional/(home|explore|work|inbox|profile)          professional tabs
 *   /professional/work?tab=offers|jobs    Work tab (my offers / my jobs)
 *   /(customer|professional)/inbox?tab=updates|messages     Inbox tab (notifications / chats)
 *   /requests/new?categoryId=&draftId=    create request (customer)
 *   /requests/:requestId                  request details (role aware; the place to see/act on offers)
 *   /requests/:requestId/offer?offerId=   submit / edit an offer (professional)
 *   /professionals/:professionalId        public professional profile
 *   /professionals/:professionalId/reviews all reviews
 *   /jobs/:jobId                          job tracking (both roles)
 *   /jobs/:jobId/review                   leave a review (customer)
 *   /conversations/:conversationId        chat
 *   /profile/edit                         edit own profile (role aware)
 *   /settings                             language, theme, notifications
 */
import type { Href } from 'expo-router';

import type { CategoryId } from '@/constants/professional-categories';
import type { UserRole } from '@/types/domain';

const enc = encodeURIComponent;

/** Search param selecting the segment of the Requests, Work and Inbox tabs. */
export const TAB_PARAM = 'tab';

/** Segments of the professional Work tab. */
const WORK_TABS = ['offers', 'jobs'] as const;
export type WorkTab = (typeof WORK_TABS)[number];

/** Segments of the Inbox tab (both roles). */
const INBOX_TABS = ['updates', 'messages'] as const;
export type InboxTab = (typeof INBOX_TABS)[number];

function parseTab<T extends string>(tabs: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (tabs as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** The Work tab segment for a `?tab=` value (unknown/missing → `offers`). */
export function parseWorkTab(value: unknown): WorkTab {
  return parseTab(WORK_TABS, value, 'offers');
}

/** The Inbox tab segment for a `?tab=` value (unknown/missing → `updates`). */
export function parseInboxTab(value: unknown): InboxTab {
  return parseTab(INBOX_TABS, value, 'updates');
}

/** Search param preselecting the role on the sign-up screen. */
export const ROLE_PARAM = 'role';

/** The sign-up role for a `?role=` value (unknown/missing → `null`, i.e. ask). */
export function parseSignUpRole(value: unknown): UserRole | null {
  return value === 'customer' || value === 'professional' ? value : null;
}

const work = (tab?: WorkTab): Href => (tab ? `/professional/work?${TAB_PARAM}=${enc(tab)}` : '/professional/work') as Href;

export const routes = {
  root: '/' as Href,
  signIn: '/sign-in' as Href,

  auth: {
    login: '/auth/login' as Href,
    /** Create account, optionally with the role already chosen. */
    signUp: (role?: UserRole | null): Href => (role ? `/auth/sign-up?${ROLE_PARAM}=${enc(role)}` : '/auth/sign-up') as Href,
    forgotPassword: '/auth/forgot-password' as Href,
  },

  customer: {
    home: '/customer/home' as Href,
    requests: '/customer/requests' as Href,
    profile: '/customer/profile' as Href,
  },

  professional: {
    explore: '/professional/explore' as Href,
    /** Work tab, optionally opened on a segment. */
    work,
    profile: '/professional/profile' as Href,
  },

  /** Home tab for a role. */
  homeFor: (role: UserRole): Href => (role === 'customer' ? '/customer/home' : '/professional/home'),

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
  professionalProfile: (professionalId: string): Href => `/professionals/${enc(professionalId)}` as Href,
  professionalReviews: (professionalId: string): Href => `/professionals/${enc(professionalId)}/reviews` as Href,
  job: (jobId: string): Href => `/jobs/${enc(jobId)}` as Href,
  reviewJob: (jobId: string): Href => `/jobs/${enc(jobId)}/review` as Href,
  conversation: (conversationId: string): Href => `/conversations/${enc(conversationId)}` as Href,
  editProfile: '/profile/edit' as Href,
  settings: '/settings' as Href,
} as const;
