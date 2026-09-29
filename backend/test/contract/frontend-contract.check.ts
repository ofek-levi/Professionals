/**
 * Compile-time contract check against the app's own types (`frontend/src/types`), run by
 * `npm run typecheck:contract` (skipped when the frontend is not next to the backend).
 * - Responses: every DTO the server returns must be assignable to the type the app reads.
 * - Payloads: every body the app sends must be accepted by the server's zod input type.
 * Documented contract changes (lists that became `Paginated`, multipart uploads, …) are listed at
 * the bottom with the shape the app will read after its next phase.
 */
import type { z } from 'zod';

import type * as App from '@/types/api';
import type * as AppDomain from '@/types/domain';
import type { RealtimeEvent as AppRealtimeEvent } from '@/services/realtime/types';

import type { CategoryCatalog } from '../../src/shared/catalog/index.js';
import type * as Api from '../../src/shared/contract/index.js';
import type { registerBody, loginBody, googleBody, passwordResetBody } from '../../src/modules/auth/auth.schemas.js';
import type { registerDeviceBody } from '../../src/modules/users/users.schemas.js';
import type { updateCustomerProfileBody } from '../../src/modules/customers/customers.schemas.js';
import type { updateProfessionalProfileBody } from '../../src/modules/professionals/professionals.schemas.js';
import type { createRequestBody, updateDraftRequestBody, cancelRequestBody } from '../../src/modules/requests/requests.schemas.js';
import type { createOfferBody, updateOfferBody } from '../../src/modules/offers/offers.schemas.js';
import type { createReviewBody } from '../../src/modules/reviews/reviews.schemas.js';
import type { sendMessageBody } from '../../src/modules/conversations/conversations.schemas.js';

type Assignable<From, To> = [From] extends [To] ? true : false;
/** Fails to compile unless `T` is `true`. */
type Check<T extends true> = T;
type Accepts<Schema extends z.ZodType, Payload> = Assignable<Payload, z.input<Schema>>;

export type ResponseChecks = [
  Check<Assignable<Api.AuthSession, App.AuthSession>>,
  Check<Assignable<Api.GoogleAuthResponse, App.GoogleAuthResponse>>,
  Check<Assignable<Api.CurrentUserResponse, App.CurrentUserResponse>>,
  Check<Assignable<Api.User, AppDomain.User>>,
  Check<Assignable<Api.CustomerProfile, AppDomain.CustomerProfile>>,
  Check<Assignable<Api.OwnProfessionalProfile, AppDomain.OwnProfessionalProfile>>,
  Check<Assignable<Api.ProfessionalProfile, AppDomain.ProfessionalProfile>>,
  Check<Assignable<Api.Paginated<Api.ProfessionalSummary>, App.Paginated<AppDomain.ProfessionalSummary>>>,
  Check<Assignable<Api.Paginated<Api.Review> & { breakdown: Api.RatingBreakdown }, App.Paginated<AppDomain.Review> & { breakdown: AppDomain.RatingBreakdown }>>,
  Check<Assignable<CategoryCatalog, AppDomain.CategoryCatalog>>,
  Check<Assignable<Api.PlaceSuggestion, AppDomain.PlaceSuggestion>>,
  Check<Assignable<Api.UploadedImage, App.UploadedImage>>,
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
];

export type PayloadChecks = [
  Check<Accepts<typeof registerBody, App.RegisterRequest>>,
  Check<Accepts<typeof loginBody, App.LoginRequest>>,
  Check<Accepts<typeof googleBody, App.GoogleAuthRequest>>,
  Check<Accepts<typeof passwordResetBody, App.PasswordResetRequest>>,
  Check<Accepts<typeof registerDeviceBody, App.RegisterDeviceRequest>>,
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

/**
 * Documented contract changes (docs/API.md "Contract changes"): these lists are `Paginated` on the
 * server while the current app reads arrays; the item types must still match.
 */
export type ChangedListChecks = [
  Check<Assignable<Api.Paginated<Api.Conversation>['items'], AppDomain.Conversation[]>>,
  Check<Assignable<Api.Paginated<Api.OfferWithProfessional>['items'], AppDomain.OfferWithProfessional[]>>,
  Check<Assignable<Api.Paginated<Api.JobSummary>['items'], AppDomain.JobSummary[]>>,
];
