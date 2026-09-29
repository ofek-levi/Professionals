import type { Request, Response } from 'express';

import type { CategoryCatalog } from '../../shared/catalog/index.js';
import { getCatalog } from './catalog.service.js';

/** Clients may reuse the catalog for an hour and revalidate cheaply (304) with the ETag. */
const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

/** `GET /v1/catalog/categories` → `CategoryCatalog` (304 when `If-None-Match` matches). */
export function getCategories(req: Request, res: Response): CategoryCatalog | undefined {
  const { catalog, etag } = getCatalog();
  res.setHeader('Cache-Control', CACHE_CONTROL);
  res.setHeader('ETag', etag);
  const ifNoneMatch = req.get('If-None-Match');
  if (ifNoneMatch?.split(',').some((tag) => tag.trim() === etag || tag.trim() === `W/${etag}`)) {
    res.status(304).end();
    return undefined;
  }
  return catalog;
}
