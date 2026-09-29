import type {
  CategoryId,
  CustomerRequestView,
  ISODateString,
  PreferredSchedule,
  ProfessionalRequestView,
  RequestCancellationReason,
  RequestStatus,
  ServiceLocation,
  UrgencyLevel,
} from '../domain';
import type { CustomerRequestSection } from '@/constants/request-statuses';
import type { PaginationParams } from './common';

/** `POST /requests` */
export interface CreateServiceRequestPayload {
  categoryId: CategoryId;
  description: string;
  location: Omit<ServiceLocation, 'isApproximate'>;
  urgency: UrgencyLevel;
  preferredSchedule: PreferredSchedule | null;
  /** Ids returned by `POST /uploads/images`. */
  photoIds: string[];
  notes: string | null;
  /** `false` saves the request as a draft. Defaults to `true`. */
  publish: boolean;
}

/** `PATCH /requests/:id` – only allowed while in `draft`. */
export type UpdateDraftRequestPayload = Partial<Omit<CreateServiceRequestPayload, 'publish'>>;

/** `POST /requests/:id/cancel` */
export interface CancelRequestPayload {
  reason: RequestCancellationReason;
  comment?: string | null;
}

/** `GET /customer/requests` */
export interface CustomerRequestsParams extends PaginationParams {
  section?: CustomerRequestSection;
  statuses?: RequestStatus[];
}

/** Sort options for the professional job explorer. */
export const NEARBY_REQUEST_SORTS = ['newest', 'nearest', 'most_urgent', 'fewest_offers'] as const;
export type NearbyRequestSort = (typeof NEARBY_REQUEST_SORTS)[number];

export const OFFER_PRESENCE_FILTERS = ['any', 'no_offers', 'has_offers'] as const;
export type OfferPresenceFilter = (typeof OFFER_PRESENCE_FILTERS)[number];

/** `GET /professional/requests/nearby` */
export interface NearbyRequestsParams extends PaginationParams {
  /** Subset of the professional's own categories. Empty/undefined = all of them. */
  categoryIds?: CategoryId[];
  /** Max distance from the professional's service-area center, capped by the service radius. */
  maxDistanceKm?: number;
  urgencies?: UrgencyLevel[];
  /** Preferred-date window (inclusive). Requests without a preferred date are included unless `requirePreferredDate`. */
  preferredDateFrom?: ISODateString;
  preferredDateTo?: ISODateString;
  offerPresence?: OfferPresenceFilter;
  /** Hide requests the professional already sent an offer to. */
  excludeWithMyOffer?: boolean;
  sort?: NearbyRequestSort;
}

export type RequestDetailsResponse =
  | { viewerRole: 'customer'; request: CustomerRequestView }
  | { viewerRole: 'professional'; request: ProfessionalRequestView };
