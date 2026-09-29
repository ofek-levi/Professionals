import type { Request, Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { validateRequest } from '../../lib/validate.js';
import type { AppLanguage } from '../../shared/domain.js';
import { reverseGeocode, searchPlaces } from './geo.service.js';
import { reverseGeocodeQuery, searchPlacesQuery } from './geo.schemas.js';

/** Answers are public and change rarely; they differ by language. */
function setCacheHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.vary('Accept-Language');
}

/** English unless the caller prefers Hebrew (no header → English). */
function languageOf(req: Request): AppLanguage {
  return req.acceptsLanguages('en', 'he') === 'he' ? 'he' : 'en';
}

/** `GET /v1/geo/search?q=&limit=` → `PlaceSuggestion[]` */
export const search = (deps: AppDeps) => async (req: Request, res: Response) => {
  const { query } = validateRequest(req, { query: searchPlacesQuery });
  const places = await searchPlaces(deps, query, languageOf(req));
  setCacheHeaders(res);
  return places;
};

/** `GET /v1/geo/reverse?lat=&lng=` → `PlaceSuggestion` (404 when there is no address there). */
export const reverse = (deps: AppDeps) => async (req: Request, res: Response) => {
  const { query } = validateRequest(req, { query: reverseGeocodeQuery });
  const place = await reverseGeocode(deps, query, languageOf(req));
  setCacheHeaders(res);
  return place;
};
