/**
 * Compile-time contract check against the app's own types (`frontend/src/types`), run by
 * `npm run typecheck:contract` (skipped when the frontend is not next to the backend; CI runs it).
 * - Responses: every DTO the server returns must be assignable to the type the app reads.
 * - Payloads: every body the app sends must be accepted by the server's zod input type (for the
 *   multipart routes: the JSON field `data`); `PayloadKeyChecks`: the app sends no key the server
 *   drops (zod strips unknown keys, so a removed field would otherwise be ignored silently);
 *   `MultipartFieldChecks`: both sides name the multipart fields alike.
 * - Queries: every query parameter the app sends (`WireQueries`, by wire name) must be a key of the
 *   server's query schema. zod strips unknown keys, so a renamed parameter would otherwise be
 *   ignored silently (no 400) instead of failing here.
 */
import type { z } from 'zod';

import type * as App from '@/types/api';
import type * as AppDomain from '@/types/domain';
import type * as AppLegal from '@/types/api/legal';
import type { PushData as AppPushData } from '@/services/push/types';
import type { RealtimeEvent as AppRealtimeEvent } from '@/services/realtime/types';

import type { CategoryCatalog } from '../../src/shared/catalog/index.js';
import type { MULTIPART_FIELDS } from '../../src/shared/multipart-fields.js';
import type * as Api from '../../src/shared/contract/index.js';
import type { registerBody, loginBody, googleBody, passwordResetBody, refreshBody, logoutBody } from '../../src/modules/auth/auth.schemas.js';
import type { deleteAccountBody, registerDeviceBody, updateMeBody } from '../../src/modules/users/users.schemas.js';
import type { updateCustomerProfileBody } from '../../src/modules/customers/customers.schemas.js';
import type { updateProfessionalProfileBody } from '../../src/modules/professionals/professionals.schemas.js';
import type {
  createRequestBody,
  updateDraftRequestBody,
  cancelRequestBody,
  customerRequestsQuery,
  nearbyRequestsQuery,
} from '../../src/modules/requests/requests.schemas.js';
import type { createOfferBody, updateOfferBody, requestOffersQuery, professionalOffersQuery } from '../../src/modules/offers/offers.schemas.js';
import type { createReviewBody } from '../../src/modules/reviews/reviews.schemas.js';
import type { sendMessageBody, conversationsPageQuery } from '../../src/modules/conversations/conversations.schemas.js';
import type { listNotificationsQuery, unreadCountQuery } from '../../src/modules/notifications/notifications.schemas.js';
import type { listJobsQuery } from '../../src/modules/jobs/jobs.schemas.js';
import type { professionalReviewsQuery, searchProfessionalsQuery } from '../../src/modules/professionals/professionals.schemas.js';
import type { searchPlacesQuery, reverseGeocodeQuery } from '../../src/modules/geo/geo.schemas.js';
import type { legalDocumentQuery } from '../../src/modules/legal/legal.schemas.js';

type Assignable<From, To> = [From] extends [To] ? true : false;
/** Fails to compile unless `T` is `true`. */
type Check<T extends true> = T;
type Accepts<Schema extends z.ZodType, Payload> = Assignable<Payload, z.input<Schema>>;
/** Every key the app sends is one the server's schema reads (the server may read more). */
type ReadsKeys<Schema extends z.ZodType, Query> = [Exclude<keyof Query, keyof z.input<Schema>>] extends [never] ? true : false;

export type ResponseChecks = [
  Check<Assignable<Api.AuthSession, App.AuthSession>>,
  // The token manager persists exactly these after `POST /auth/refresh`.
  Check<Assignable<Api.RefreshResponse, App.SessionTokens>>,
  Check<Assignable<Api.CustomerProfileResponse, App.CustomerProfileResponse>>,
  Check<Assignable<Api.PushData, AppPushData>>,
  Check<Assignable<Api.GoogleAuthResponse, App.GoogleAuthResponse>>,
  Check<Assignable<Api.CurrentUserResponse, App.CurrentUserResponse>>,
  Check<Assignable<Api.AccountDeletionImpact, App.AccountDeletionImpact>>,
  Check<Assignable<Api.User, AppDomain.User>>,
  Check<Assignable<Api.CustomerProfile, AppDomain.CustomerProfile>>,
  Check<Assignable<Api.OwnProfessionalProfile, AppDomain.OwnProfessionalProfile>>,
  Check<Assignable<Api.ProfessionalProfile, AppDomain.ProfessionalProfile>>,
  Check<Assignable<Api.Paginated<Api.ProfessionalSummary>, App.Paginated<AppDomain.ProfessionalSummary>>>,
  Check<Assignable<Api.Paginated<Api.Review> & { breakdown: Api.RatingBreakdown }, App.Paginated<AppDomain.Review> & { breakdown: AppDomain.RatingBreakdown }>>,
  Check<Assignable<CategoryCatalog, AppDomain.CategoryCatalog>>,
  Check<Assignable<Api.PlaceSuggestion, AppDomain.PlaceSuggestion>>,
  Check<Assignable<Api.CustomerRequestView, AppDomain.CustomerRequestView>>,
  Check<Assignable<Api.ProfessionalRequestView, AppDomain.ProfessionalRequestView>>,
  Check<Assignable<Api.RequestDetailsResponse, App.RequestDetailsResponse>>,
  Check<Assignable<Api.Paginated<Api.CustomerRequestView>, App.Paginated<AppDomain.CustomerRequestView>>>,
  Check<Assignable<Api.Paginated<Api.ProfessionalRequestView>, App.Paginated<AppDomain.ProfessionalRequestView>>>,
  Check<Assignable<Api.Offer, AppDomain.Offer>>,
  Check<Assignable<Api.OfferDetails, AppDomain.OfferWithProfessional & Pick<AppDomain.OfferWithRequest, 'request'>>>,
  Check<Assignable<Api.AcceptOfferResponse, App.AcceptOfferResponse>>,
  Check<Assignable<Api.Paginated<Api.OfferWithRequest>, App.Paginated<AppDomain.OfferWithRequest>>>,
  Check<Assignable<Api.Job, AppDomain.Job>>,
  Check<Assignable<Api.JobDetails, AppDomain.JobDetails>>,
  Check<Assignable<Api.Review, AppDomain.Review>>,
  Check<Assignable<Api.Conversation, AppDomain.Conversation>>,
  Check<Assignable<Api.Paginated<Api.Message>, App.Paginated<AppDomain.Message>>>,
  Check<Assignable<Api.Message, AppDomain.Message>>,
  Check<Assignable<Api.Paginated<Api.AppNotification>, App.Paginated<AppDomain.AppNotification>>>,
  Check<Assignable<Api.AppNotification, AppDomain.AppNotification>>,
  Check<Assignable<Api.UnreadCountResponse, App.UnreadCountResponse>>,
  Check<Assignable<Api.SuccessResponse, App.SuccessResponse>>,
  Check<Assignable<Api.CustomerDashboard, App.CustomerDashboard>>,
  Check<Assignable<Api.ProfessionalDashboard, App.ProfessionalDashboard>>,
  Check<Assignable<Api.RealtimeEvent, AppRealtimeEvent>>,
  Check<Assignable<Api.ApiErrorBody, App.ApiErrorBody>>,
  Check<Assignable<Api.LegalDocumentResponse, AppLegal.LegalDocumentResponse>>,
];

export type PayloadChecks = [
  Check<Accepts<typeof registerBody, App.RegisterRequest>>,
  Check<Accepts<typeof loginBody, App.LoginRequest>>,
  Check<Accepts<typeof refreshBody, App.RefreshSessionRequest>>,
  Check<Accepts<typeof logoutBody, App.LogoutRequest>>,
  Check<Accepts<typeof updateMeBody, App.UpdateMeRequest>>,
  Check<Accepts<typeof googleBody, App.GoogleAuthRequest>>,
  Check<Accepts<typeof passwordResetBody, App.PasswordResetRequest>>,
  Check<Accepts<typeof registerDeviceBody, App.RegisterDeviceRequest>>,
  Check<Accepts<typeof deleteAccountBody, App.DeleteAccountRequest>>,
  Check<Accepts<typeof updateCustomerProfileBody, App.UpdateCustomerProfilePayload>>,
  Check<Accepts<typeof updateProfessionalProfileBody, App.UpdateProfessionalProfilePayload>>,
  Check<Accepts<typeof createRequestBody, App.CreateServiceRequestPayload>>,
  Check<Accepts<typeof updateDraftRequestBody, App.UpdateDraftRequestPayload>>,
  Check<Accepts<typeof cancelRequestBody, App.CancelRequestPayload>>,
  Check<Accepts<typeof createOfferBody, App.CreateOfferPayload>>,
  Check<Accepts<typeof updateOfferBody, App.UpdateOfferPayload>>,
  Check<Accepts<typeof createReviewBody, App.CreateReviewPayload>>,
  Check<Accepts<typeof sendMessageBody, App.SendMessagePayload>>,
];

/** Payloads whose fields changed shape (the avatar left the profile PATCHes, photos became files). */
export type PayloadKeyChecks = [
  Check<ReadsKeys<typeof updateCustomerProfileBody, App.UpdateCustomerProfilePayload>>,
  Check<ReadsKeys<typeof updateProfessionalProfileBody, App.UpdateProfessionalProfilePayload>>,
  Check<ReadsKeys<typeof createRequestBody, App.CreateServiceRequestPayload>>,
  Check<ReadsKeys<typeof updateDraftRequestBody, App.UpdateDraftRequestPayload>>,
  // Both fields are optional: a renamed one would be dropped and answer "password required".
  Check<ReadsKeys<typeof deleteAccountBody, App.DeleteAccountRequest>>,
];

/** Field names of the multipart routes: the same on both sides (a renamed field would pass every app test against the double). */
export type MultipartFieldChecks = [
  Check<Assignable<typeof MULTIPART_FIELDS, typeof App.MULTIPART_FIELDS>>,
  Check<Assignable<typeof App.MULTIPART_FIELDS, typeof MULTIPART_FIELDS>>,
];

/** Query parameters by wire name (`frontend/src/types/api/queries.ts`, used with `satisfies`). */
export type QueryChecks = [
  Check<ReadsKeys<typeof listNotificationsQuery, App.WireQueries['/notifications']>>,
  Check<ReadsKeys<typeof unreadCountQuery, App.WireQueries['/notifications/unread-count']>>,
  Check<ReadsKeys<typeof customerRequestsQuery, App.WireQueries['/customer/requests']>>,
  Check<ReadsKeys<typeof nearbyRequestsQuery, App.WireQueries['/professional/requests/nearby']>>,
  Check<ReadsKeys<typeof requestOffersQuery, App.WireQueries['/requests/:id/offers']>>,
  Check<ReadsKeys<typeof professionalOffersQuery, App.WireQueries['/professional/offers']>>,
  Check<ReadsKeys<typeof listJobsQuery, App.WireQueries['/jobs']>>,
  Check<ReadsKeys<typeof conversationsPageQuery, App.WireQueries['/conversations']>>,
  Check<ReadsKeys<typeof conversationsPageQuery, App.WireQueries['/conversations/:id/messages']>>,
  Check<ReadsKeys<typeof professionalReviewsQuery, App.WireQueries['/professionals/:id/reviews']>>,
  Check<ReadsKeys<typeof searchProfessionalsQuery, App.WireQueries['/professionals']>>,
  Check<ReadsKeys<typeof searchPlacesQuery, App.WireQueries['/geo/search']>>,
  Check<ReadsKeys<typeof reverseGeocodeQuery, App.WireQueries['/geo/reverse']>>,
  Check<ReadsKeys<typeof legalDocumentQuery, AppLegal.LegalDocumentQuery>>,
  // The enum filters also take the app's values.
  Check<Assignable<App.NotificationsParams['excludeTypes'], z.input<typeof listNotificationsQuery>['excludeTypes']>>,
  Check<Assignable<App.JobsParams['scope'], z.input<typeof listJobsQuery>['scope']>>,
  Check<Assignable<AppLegal.LegalDocumentQuery['lang'], z.input<typeof legalDocumentQuery>['lang']>>,
];

/** The lists the app pages through (`Paginated`, with the items the app renders). */
export type PaginatedListChecks = [
  Check<Assignable<Api.Paginated<Api.Conversation>, App.Paginated<AppDomain.Conversation>>>,
  Check<Assignable<Api.Paginated<Api.OfferWithProfessional>, App.Paginated<AppDomain.OfferWithProfessional>>>,
  Check<Assignable<Api.Paginated<Api.JobSummary>, App.Paginated<AppDomain.JobSummary>>>,
];
