/**
 * The query strings the app sends, by their names on the wire (the endpoint modules build them
 * with `satisfies`). The backend's contract check (`backend/test/contract`) compares these keys
 * with its query schemas: the server strips unknown keys, so a renamed parameter would otherwise
 * be ignored silently instead of failing.
 */
import type { CustomerRequestsParams, NearbyRequestsParams } from './requests';
import type { JobsParams } from './jobs';
import type { NotificationsParams, UnreadNotificationsCountParams } from './notifications';
import type { PaginationParams } from './common';
import type { ProfessionalOffersParams, RequestOffersParams } from './offers';
import type { SearchProfessionalsParams } from './profiles';

export interface WireQueries {
  '/notifications': NotificationsParams;
  '/notifications/unread-count': UnreadNotificationsCountParams;
  '/customer/requests': CustomerRequestsParams;
  '/professional/requests/nearby': NearbyRequestsParams;
  '/requests/:id/offers': RequestOffersParams;
  '/professional/offers': ProfessionalOffersParams;
  '/jobs': JobsParams;
  '/conversations': PaginationParams;
  '/conversations/:id/messages': PaginationParams;
  '/professionals/:id/reviews': PaginationParams;
  '/professionals': Omit<SearchProfessionalsParams, 'near'> & { lat?: number; lng?: number };
  '/geo/search': { q: string; limit?: number };
  '/geo/reverse': { lat: number; lng: number };
}
