/**
 * Drift check: the backend's copies of the app's constants (`src/shared/*`) must match the app
 * (`frontend/src/...`). Fails when an id, status, error code, limit or validation key diverges.
 * Skipped when the frontend is not next to the backend (e.g. a backend-only Docker build).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CATEGORY_CATALOG, CATEGORY_GROUP_IDS, CATEGORY_IDS } from '../catalog/index.js';
import * as domain from '../domain.js';
import { API_ERROR_CODES } from '../error-codes.js';
import { APP_CONFIG } from '../limits.js';
import { NOTIFICATION_TYPE_PREFERENCE, NOTIFICATION_TYPES } from '../notification-types.js';
import {
  ACTIVE_JOB_STATUSES,
  ACTIVE_OFFER_STATUSES,
  CUSTOMER_REQUEST_SECTIONS,
  JOB_STATUSES,
  OFFER_STATUSES,
  REQUEST_STATUS_FOR_JOB_STATUS,
  REQUEST_STATUSES,
  REQUEST_STATUSES_ACCEPTING_OFFERS,
} from '../statuses.js';
import { URGENCY_LEVELS, URGENCY_META } from '../urgency.js';
import { VALIDATION_MESSAGE_KEYS } from '../validation-messages.js';

const FRONTEND_SRC = new URL('../../../../frontend/src/', import.meta.url);

type Module = Record<string, unknown>;

async function app(path: string): Promise<Module> {
  return (await import(fileURLToPath(new URL(path, FRONTEND_SRC)))) as Module;
}

function entriesWhere(meta: unknown, predicate: (value: Record<string, unknown>) => boolean): string[] {
  return Object.entries(meta as Record<string, Record<string, unknown>>)
    .filter(([, value]) => predicate(value))
    .map(([key]) => key);
}

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe.skipIf(!existsSync(FRONTEND_SRC))('shared constants match the app', () => {
  it('category catalog (ids, groups and full content)', async () => {
    const catalog = await app('constants/professional-categories.ts');
    expect(CATEGORY_GROUP_IDS).toEqual(catalog.CATEGORY_GROUP_IDS);
    expect(CATEGORY_IDS).toEqual(catalog.CATEGORY_IDS);
    expect(CATEGORY_CATALOG).toEqual(catalog.DEFAULT_CATEGORY_CATALOG);
  });

  it('request, offer and job statuses', async () => {
    const requests = await app('constants/request-statuses.ts');
    expect(REQUEST_STATUSES).toEqual(requests.REQUEST_STATUSES);
    expect(CUSTOMER_REQUEST_SECTIONS).toEqual(requests.CUSTOMER_REQUEST_SECTIONS);
    expect(REQUEST_STATUSES_ACCEPTING_OFFERS).toEqual(entriesWhere(requests.REQUEST_STATUS_META, (meta) => meta.acceptsOffers === true));

    const offers = await app('constants/offer-statuses.ts');
    expect(OFFER_STATUSES).toEqual(offers.OFFER_STATUSES);
    expect(ACTIVE_OFFER_STATUSES).toEqual(entriesWhere(offers.OFFER_STATUS_META, (meta) => meta.isActive === true));

    const jobs = await app('constants/job-statuses.ts');
    expect(JOB_STATUSES).toEqual(jobs.JOB_STATUSES);
    expect(ACTIVE_JOB_STATUSES).toEqual(entriesWhere(jobs.JOB_STATUS_META, (meta) => meta.isActive === true));
    const mirrored = Object.fromEntries(
      Object.entries(jobs.JOB_STATUS_META as Record<string, { requestStatus: string }>).map(([status, meta]) => [status, meta.requestStatus]),
    );
    expect(REQUEST_STATUS_FOR_JOB_STATUS).toEqual(mirrored);
  });

  it('urgency levels, priorities and offer validity', async () => {
    const urgency = await app('constants/urgency-levels.ts');
    expect(URGENCY_LEVELS).toEqual(urgency.URGENCY_LEVELS);
    for (const [level, meta] of Object.entries(urgency.URGENCY_META as Record<string, Record<string, unknown>>)) {
      expect(URGENCY_META[level as keyof typeof URGENCY_META]).toEqual({ priority: meta.priority, offerValidityHours: meta.offerValidityHours });
    }
  });

  it('notification types and their preference toggles', async () => {
    const notifications = await app('constants/notification-types.ts');
    expect(NOTIFICATION_TYPES).toEqual(notifications.NOTIFICATION_TYPES);
    const preferences = Object.fromEntries(
      Object.entries(notifications.NOTIFICATION_TYPE_META as Record<string, { preference: string }>).map(([type, meta]) => [type, meta.preference]),
    );
    expect(NOTIFICATION_TYPE_PREFERENCE).toEqual(preferences);
  });

  it('API error codes', async () => {
    expect(API_ERROR_CODES).toEqual((await app('types/api/common.ts')).API_ERROR_CODES);
  });

  it('business limits (APP_CONFIG)', async () => {
    expect(APP_CONFIG).toEqual((await app('constants/app-config.ts')).APP_CONFIG);
  });

  it('contract enumerations', async () => {
    const [common, user, professional, request, review, requestsApi, offersApi, jobsApi] = await Promise.all([
      app('types/domain/common.ts'),
      app('types/domain/user.ts'),
      app('types/domain/professional.ts'),
      app('types/domain/request.ts'),
      app('types/domain/review.ts'),
      app('types/api/requests.ts'),
      app('types/api/offers.ts'),
      app('types/api/jobs.ts'),
    ]);
    expect(domain.SUPPORTED_LANGUAGES).toEqual(common.SUPPORTED_LANGUAGES);
    expect(domain.SUPPORTED_CURRENCIES).toEqual(common.SUPPORTED_CURRENCIES);
    expect(domain.USER_ROLES).toEqual(user.USER_ROLES);
    expect(domain.WEEKDAYS).toEqual(professional.WEEKDAYS);
    expect(domain.PREFERRED_TIME_WINDOWS).toEqual(request.PREFERRED_TIME_WINDOWS);
    expect(domain.REQUEST_CANCELLATION_REASONS).toEqual(request.REQUEST_CANCELLATION_REASONS);
    expect(domain.RATING_VALUES).toEqual(review.RATING_VALUES);
    expect(domain.NEARBY_REQUEST_SORTS).toEqual(requestsApi.NEARBY_REQUEST_SORTS);
    expect(domain.OFFER_PRESENCE_FILTERS).toEqual(requestsApi.OFFER_PRESENCE_FILTERS);
    expect(domain.OFFER_SORTS).toEqual(offersApi.OFFER_SORTS);
    expect(domain.JOB_SCOPES).toEqual(jobsApi.JOB_SCOPES);
  });

  it('validation message keys exist in the app translations', async () => {
    const { validation } = await app('i18n/locales/en/validation.ts');
    const appKeys = new Set(leafPaths(validation));
    expect(VALIDATION_MESSAGE_KEYS.filter((key) => !appKeys.has(key))).toEqual([]);
  });
});
