/** Offer reads: `GET /offers/:id`, `GET /requests/:id/offers`, `GET /professional/offers`. */
import { Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { decodeCursor, encodeCursor, findPage, RECENTLY_UPDATED, type SortSpec } from '../../lib/pagination.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { OfferDetails, OfferWithProfessional, OfferWithRequest, Paginated } from '../../shared/contract/index.js';
import { OFFER_STATUSES } from '../../shared/statuses.js';
import { vm } from '../../shared/validation-messages.js';
import { loadOwnedRequest, loadRequest } from '../requests/request-access.js';
import { sortOffers } from './offer-sorting.js';
import { OfferModel, type OfferDoc } from './offer.model.js';
import type { ProfessionalOffersQuery, RequestOffersQuery } from './offers.schemas.js';
import { toOfferDetails, toOffersWithProfessional, toOffersWithRequest } from './offers.views.js';

/** Cursor of the ranked offers list: its position (index) and the id of the offer there. */
const RANKED_CURSOR: SortSpec = [
  { path: 'index', direction: 1 },
  { path: '_id', direction: 1 },
];

/** The request's owner or the offering professional. */
export async function getOfferDetails(auth: AuthContext, offerId: Types.ObjectId): Promise<OfferDetails> {
  const offer = await OfferModel.findById(offerId).lean<OfferDoc>();
  if (!offer) throw ApiError.notFound('Offer');
  const request = await loadRequest(offer.request);
  const allowed = auth.role === 'customer' ? request.customer.equals(auth.userId) : offer.professional.equals(auth.userId);
  if (!allowed) throw ApiError.forbidden('You cannot view this offer');
  return toOfferDetails(offer, request, auth);
}

/**
 * The customer's comparison list, ranked like the app (`sortOffers`: the recommended score is
 * relative to the other offers, so the whole — naturally small — set of a request is ranked and
 * then paged). The cursor holds the last offer returned and its position: the next page resumes
 * after that offer, or at the same position when it left the list meanwhile (withdrawn, expired,
 * or no longer matching the `statuses` filter).
 */
export async function listRequestOffers(auth: AuthContext, requestId: Types.ObjectId, query: RequestOffersQuery): Promise<Paginated<OfferWithProfessional>> {
  const request = await loadOwnedRequest(auth, requestId);
  const offers = await OfferModel.find({ request: request._id, ...(query.statuses ? { status: { $in: query.statuses } } : {}) })
    .sort({ createdAt: 1 })
    .lean<OfferDoc[]>();
  const ranked = sortOffers(await toOffersWithProfessional(offers, request), query.sort ?? 'recommended');
  let start = 0;
  if (query.cursor) {
    const [index, lastId] = decodeCursor(query.cursor, RANKED_CURSOR).values;
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) throw ApiError.validation({ cursor: [vm('invalid')] }, 'Invalid pagination cursor');
    const found = ranked.findIndex((offer) => offer.id === String(lastId));
    start = found >= 0 ? found + 1 : Math.min(index, ranked.length);
  }
  const items = ranked.slice(start, start + query.limit);
  const last = items[items.length - 1];
  const hasMore = start + items.length < ranked.length;
  const nextCursor = hasMore && last ? encodeCursor({ values: [start + items.length - 1, new Types.ObjectId(last.id)], totalCount: ranked.length }) : null;
  return { items, nextCursor, totalCount: ranked.length };
}

/** The professional's offers, most recently updated first (every status listed: see the index). */
export async function listProfessionalOffers(auth: AuthContext, query: ProfessionalOffersQuery): Promise<Paginated<OfferWithRequest>> {
  const page = await findPage<OfferDoc, OfferDoc>(OfferModel, {
    filter: { professional: auth.userId, status: { $in: query.statuses ?? [...OFFER_STATUSES] } },
    sort: RECENTLY_UPDATED,
    page: { cursor: query.cursor, limit: query.limit },
  });
  return { ...page, items: await toOffersWithRequest(page.items, auth) };
}
