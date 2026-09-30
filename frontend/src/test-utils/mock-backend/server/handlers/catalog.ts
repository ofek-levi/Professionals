/** `/catalog/*` and `/geo/*` routes (reference data & utilities). */
import { DEFAULT_CATEGORY_CATALOG } from '@/constants/professional-categories';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import { isValidCoordinates } from '@/utils/geo';

import { route } from '../router';
import { reverseGeocode, searchPlaces } from '../services/geo-service';

export const catalogRoutes = [
  route({ method: 'GET', path: '/catalog/categories', auth: 'public', handler: () => DEFAULT_CATEGORY_CATALOG }),
  route({
    method: 'GET',
    path: '/geo/search',
    // Public: professionals choose their base address while signing up.
    auth: 'public',
    handler: ({ query, language }) =>
      searchPlaces(query.string('q') ?? '', { limit: query.integer('limit', { min: 1, max: 50 }), language }),
  }),
  route({
    method: 'GET',
    path: '/geo/reverse',
    auth: 'public',
    handler: ({ query, language }) => {
      const coordinates = { latitude: query.number('lat') ?? NaN, longitude: query.number('lng') ?? NaN };
      if (!isValidCoordinates(coordinates)) {
        const message = vm('location.coordinatesInvalid');
        throw DomainError.validation({ lat: [message], lng: [message] });
      }
      return reverseGeocode(coordinates, language);
    },
  }),
];
