/** `/catalog/*` and `/geo/*` and `/uploads/*` routes (reference data & utilities). */
import { DEFAULT_CATEGORY_CATALOG } from '@/constants/professional-categories';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import { uploadImageSchema } from '@/lib/validation/upload';
import type { UploadedImage } from '@/types/api';
import { isValidCoordinates } from '@/utils/geo';

import { created, route } from '../router';
import { reverseGeocode, searchPlaces } from '../services/geo-service';
import { parseBody } from '../validate';

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
  route({
    method: 'POST',
    path: '/uploads/images',
    auth: 'user',
    handler: ({ ctx, actor, body }) => {
      const payload = parseBody(uploadImageSchema, body);
      const upload = ctx.db.uploads.insert({
        id: ctx.newId('upl'),
        ownerId: actor.userId,
        url: payload.uri,
        width: payload.width,
        height: payload.height,
        mimeType: payload.mimeType,
        fileName: payload.fileName,
        createdAt: ctx.nowIso(),
      });
      const image: UploadedImage = { id: upload.id, url: upload.url, width: upload.width, height: upload.height };
      return created(image);
    },
  }),
];
