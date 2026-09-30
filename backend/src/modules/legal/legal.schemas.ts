import { z } from 'zod';

import { queryEnum } from '../../lib/query-schemas.js';
import { SUPPORTED_LANGUAGES } from '../../shared/domain.js';

/** Any name: an unknown document is a 404, not a validation error. */
export const legalDocumentParams = z.object({ document: z.string() });

/** `GET /v1/legal/:document?lang=en|he`; without `lang`, the `Accept-Language` header decides. */
export const legalDocumentQuery = z.object({ lang: queryEnum(SUPPORTED_LANGUAGES) });
