/** Payload builders and small helpers shared by the auth tests. */
import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';

import type { TestDeps } from '../../../../test/app.js';
import type { MailMessage } from '../../../infra/mail/index.js';
import type { AuthSession } from '../../../shared/contract/index.js';

let sequence = 0;

export const STRONG_PASSWORD = 'Sunny-Garden-42';

export function customerPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  sequence += 1;
  return {
    role: 'customer',
    firstName: 'Noa',
    lastName: 'Levi',
    email: `noa.levi${sequence}@example.com`,
    phone: '050-123-4567',
    password: STRONG_PASSWORD,
    googleIdToken: null,
    acceptedTerms: true,
    preferredLanguage: 'en',
    professional: null,
    ...overrides,
  };
}

export function professionalPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return customerPayload({
    role: 'professional',
    firstName: 'Avi',
    lastName: 'Cohen',
    preferredLanguage: 'he',
    professional: {
      businessName: 'Avi Fix',
      categoryIds: ['plumbing', 'handyman', 'plumbing'],
      baseLocation: {
        coordinates: { latitude: 32.0853, longitude: 34.7818 },
        addressLine: 'Ibn Gabirol St 50',
        city: 'Tel Aviv-Yafo',
        neighborhood: null,
        details: '',
      },
      serviceRadiusKm: 15,
    },
    ...overrides,
  });
}

export async function registerAccount(app: Express, payload: Record<string, unknown>): Promise<AuthSession> {
  const res = await request(app).post('/v1/auth/register').send(payload).expect(201);
  return res.body as AuthSession;
}

export async function loginAccount(app: Express, email: string, password = STRONG_PASSWORD): Promise<AuthSession> {
  const res = await request(app).post('/v1/auth/login').send({ email, password }).expect(200);
  return res.body as AuthSession;
}

/** The single-use link of the newest email sent to `to` (after background work finished). */
export async function linkSentTo(deps: TestDeps, to: string): Promise<{ mail: MailMessage; url: URL; token: string }> {
  await deps.background.drain();
  const mail = deps.mailer.lastTo(to);
  expect(mail).toBeDefined();
  const href = /href="([^"]+)"/.exec(mail?.html ?? '')?.[1] ?? '';
  const url = new URL(href.replaceAll('&amp;', '&'));
  return { mail: mail as MailMessage, url, token: url.searchParams.get('token') ?? '' };
}

/** Path + query of an emailed link, to request it from the test app. */
export function pathOf(url: URL): string {
  return `${url.pathname}${url.search}`;
}
