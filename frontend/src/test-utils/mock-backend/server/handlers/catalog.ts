/** `/catalog/*` and `/geo/*` and `/uploads/*` routes (reference data & utilities). */
import { DEFAULT_CATEGORY_CATALOG } from '@/constants/professional-categories';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import type { UploadedImage } from '@/types/api';
import { isValidCoordinates } from '@/utils/geo';

import { created, route } from '../router';
import { reverseGeocode, searchPlaces } from '../services/geo-service';
import { readUploadedImage } from '../uploads';

/** The double cannot decode images: every stored image reports these dimensions. */
const UPLOADED_WIDTH = 1600;
const UPLOADED_HEIGHT = 1200;

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
      const file = readUploadedImage(body);
      if (!file) throw DomainError.validation({ file: [vm('upload.invalid')] }, 'Expected a JPEG, PNG, WebP or HEIC image of at most 8 MB');
      const id = ctx.newId('upl');
      const upload = ctx.db.uploads.insert({
        id,
        ownerId: actor.userId,
        url: `https://images.test/${id}.${file.extension}`,
        width: UPLOADED_WIDTH,
        height: UPLOADED_HEIGHT,
        mimeType: file.type,
        fileName: file.name,
        createdAt: ctx.nowIso(),
      });
      const image: UploadedImage = { id: upload.id, url: upload.url, width: upload.width, height: upload.height };
      return created(image);
    },
  }),
];
