import { z } from 'zod';

import { queryNumber, queryString } from '../../lib/query-schemas.js';
import { vm } from '../../shared/validation-messages.js';

export const GEO_SEARCH = {
  defaultLimit: 8,
  /** Larger limits are accepted (as the mock backend) but capped: autocomplete shows a few rows. */
  maxResults: 20,
  maxLimit: 50,
  /** Shorter queries answer `[]` without calling the provider (the app waits for 2 characters). */
  minQueryLength: 2,
  maxQueryLength: 200,
} as const;

export const searchPlacesQuery = z.object({
  q: queryString(GEO_SEARCH.maxQueryLength).transform((value) => value ?? ''),
  limit: queryNumber({ min: 1, max: GEO_SEARCH.maxLimit })
    .refine((value) => value === undefined || Number.isInteger(value), vm('invalid'))
    .transform((value) => Math.min(value ?? GEO_SEARCH.defaultLimit, GEO_SEARCH.maxResults)),
});

function coordinate(value: unknown): number {
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
}

/** `?lat=&lng=`; anything but a valid pair flags both fields (the app shows one message). */
export const reverseGeocodeQuery = z.object({ lat: z.unknown().optional(), lng: z.unknown().optional() }).transform((query, ctx) => {
  const latitude = coordinate(query.lat);
  const longitude = coordinate(query.lng);
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    return { latitude, longitude };
  }
  for (const path of ['lat', 'lng']) ctx.addIssue({ code: 'custom', message: vm('location.coordinatesInvalid'), path: [path] });
  return z.NEVER;
});

export type SearchPlacesInput = z.output<typeof searchPlacesQuery>;
