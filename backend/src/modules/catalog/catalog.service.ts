/**
 * The category catalog is a code constant, so its JSON and ETag are computed once per process
 * and served from memory (no database, no Redis).
 */
import { createHash } from 'node:crypto';

import { CATEGORY_CATALOG, type CategoryCatalog } from '../../shared/catalog/index.js';

export interface CatalogPayload {
  catalog: CategoryCatalog;
  /** Strong ETag of the serialized catalog. */
  etag: string;
}

let cached: CatalogPayload | null = null;

export function getCatalog(): CatalogPayload {
  if (!cached) {
    const hash = createHash('sha256').update(JSON.stringify(CATEGORY_CATALOG)).digest('base64url').slice(0, 27);
    cached = { catalog: CATEGORY_CATALOG, etag: `"${CATEGORY_CATALOG.version}-${hash}"` };
  }
  return cached;
}
