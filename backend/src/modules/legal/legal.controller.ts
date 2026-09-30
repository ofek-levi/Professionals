/**
 * The legal documents as JSON for the app and as public pages. Both answer in `?lang=`, else in the
 * browser's language, and anyone may cache them for 5 minutes: the texts only change with a deploy.
 */
import type { Request, Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { validateRequest } from '../../lib/validate.js';
import type { LegalDocumentId, LegalDocumentResponse } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { isLegalDocument } from './content/index.js';
import { legalPageUrls } from './legal-placeholders.js';
import { legalDocumentParams, legalDocumentQuery } from './legal.schemas.js';
import { legalDocument } from './legal.service.js';
import { renderLegalPage, renderTooManyRequestsPage } from './pages/render-legal-page.js';

const CACHE_CONTROL = 'public, max-age=300';

/** The pages need nothing but their inline styles. */
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";

function browserLanguage(req: Request): AppLanguage {
  return req.acceptsLanguages('en', 'he') === 'he' ? 'he' : 'en';
}

function documentOf(req: Request): LegalDocumentId {
  const { params } = validateRequest(req, { params: legalDocumentParams });
  if (!isLegalDocument(params.document)) throw ApiError.notFound('Legal document');
  return params.document;
}

/** Without `?lang=` the answer depends on `Accept-Language`, so shared caches keep one per language. */
function setCaching(res: Response): void {
  res.set('Cache-Control', CACHE_CONTROL).vary('Accept-Language');
}

/** `GET /v1/legal/:document?lang=` → `LegalDocumentResponse` (placeholders filled). */
export const getLegalDocument =
  (deps: Pick<AppDeps, 'env'>) =>
  (req: Request, res: Response): LegalDocumentResponse => {
    const document = documentOf(req);
    const { query } = validateRequest(req, { query: legalDocumentQuery });
    setCaching(res);
    return legalDocument(document, query.lang ?? browserLanguage(req), deps.env.publicApiUrl);
  };

/** `GET /legal/:document?lang=`: the page. An unknown `lang` is ignored (a page never answers 400). */
export const getLegalPage =
  (deps: Pick<AppDeps, 'env'>) =>
  (req: Request, res: Response): void => {
    const document = documentOf(req);
    const { lang } = req.query;
    const language = lang === 'en' || lang === 'he' ? lang : browserLanguage(req);
    const html = renderLegalPage(legalDocument(document, language, deps.env.publicApiUrl), legalPageUrls(deps.env.publicApiUrl));
    setCaching(res);
    res.set('Content-Security-Policy', PAGE_CSP).type('html').send(html);
  };

/** Rate-limit refusal of the pages (`onRefused`): a 429 page in the browser's language. */
export function tooManyRequestsPage(req: Request, res: Response): void {
  res
    .status(429)
    .set({ 'Cache-Control': 'no-store', 'Content-Security-Policy': PAGE_CSP })
    .type('html')
    .send(renderTooManyRequestsPage(browserLanguage(req)));
}
