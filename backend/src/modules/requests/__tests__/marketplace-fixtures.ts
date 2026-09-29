/**
 * Payload builders and HTTP shortcuts shared by the marketplace tests (requests, offers, jobs,
 * reviews, dashboard). Default clock: 2026-10-01T09:00Z (12:00 in Israel).
 */
import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';

import type { TestDeps } from '../../../../test/app.js';
import { TEL_AVIV } from '../../../../test/factories.js';
import type { GeoCoordinates } from '../../../shared/contract/index.js';

export const HOUR = 60 * 60_000;

export interface Caller {
  headers: { Authorization: string };
}

export function inHours(deps: Pick<TestDeps, 'clock'>, hours: number): string {
  return new Date(deps.clock.now().getTime() + hours * HOUR).toISOString();
}

/** A valid `POST /requests` body (published, plumbing in Tel Aviv). */
export function requestBody(overrides: Record<string, unknown> = {}, coordinates: GeoCoordinates = TEL_AVIV): Record<string, unknown> {
  return {
    categoryId: 'plumbing',
    description: 'The kitchen sink is leaking under the cabinet.',
    location: { coordinates, addressLine: 'Dizengoff St 120', city: 'Tel Aviv-Yafo', neighborhood: 'Old North', details: 'Floor 3, apt 7' },
    urgency: 'normal',
    preferredSchedule: null,
    photoIds: [],
    notes: 'Gate code 1234',
    publish: true,
    ...overrides,
  };
}

/** A valid `POST /requests/:id/offers` body (start in two days). */
export function offerBody(deps: Pick<TestDeps, 'clock'>, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { price: 350, currency: 'ILS', proposedStartAt: inHours(deps, 48), estimatedDurationMinutes: 90, message: 'Can come with parts', ...overrides };
}

export async function postRequest(
  app: Express,
  customer: Caller,
  overrides: Record<string, unknown> = {},
  coordinates: GeoCoordinates = TEL_AVIV,
): Promise<{ id: string } & Record<string, unknown>> {
  const res = await request(app).post('/v1/requests').set(customer.headers).send(requestBody(overrides, coordinates));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string };
}

export async function postOffer(
  app: Express,
  deps: Pick<TestDeps, 'clock'>,
  professional: Caller,
  requestId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string } & Record<string, unknown>> {
  const res = await request(app).post(`/v1/requests/${requestId}/offers`).set(professional.headers).send(offerBody(deps, overrides));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string };
}

export async function acceptOffer(app: Express, customer: Caller, offerId: string): Promise<{ job: { id: string; conversationId: string } } & Record<string, unknown>> {
  const res = await request(app).post(`/v1/offers/${offerId}/accept`).set(customer.headers);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as { job: { id: string; conversationId: string } };
}

/** Types of the notifications a user received (realtime `notification.created`). */
export function notificationTypes(deps: TestDeps, userId: string): string[] {
  return deps.realtime
    .eventsFor(userId)
    .flatMap((event) => (event.type === 'notification.created' ? [event.notification.type] : []));
}

/** Types of the entity events a user received. */
export function eventTypes(deps: TestDeps, userId: string): string[] {
  return deps.realtime.eventsFor(userId).map((event) => event.type);
}
